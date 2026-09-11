import crypto from "node:crypto";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import * as z from "zod/v4";
import {
  categorySales,
  dailySales,
  listInvoices,
  paymentBreakdown,
  percentageChange,
  staffSales,
  summarizeInvoices,
  topProducts,
} from "./ready2order.js";
import { seal, unseal } from "./security.js";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

const SCOPE = "statistics.read";
const usedAuthorizationCodes = new Map();

function baseUrl(req) {
  const configured = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const protocol = String(req.headers["x-forwarded-proto"] || req.protocol).split(",")[0].trim();
  return `${protocol}://${req.get("host")}`;
}

function resourceUrl(req) {
  return `${baseUrl(req)}/mcp`;
}

function safeRedirectUri(value) {
  try {
    const url = new URL(value);
    const allowed = url.protocol === "https:"
      && (url.hostname === "chatgpt.com" || url.hostname.endsWith(".chatgpt.com"));
    const local = process.env.NODE_ENV !== "production"
      && ["localhost", "127.0.0.1"].includes(url.hostname);
    return allowed || local ? url.toString() : null;
  } catch {
    return null;
  }
}

function oauthError(res, status, error, description) {
  return res.status(status).json({ error, error_description: description });
}

function appendQuery(uri, parameters) {
  const url = new URL(uri);
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  }
  return url.toString();
}

async function requestReady2OrderApproval(req, flow) {
  const developerToken = process.env.READY2ORDER_DEVELOPER_TOKEN;
  if (!developerToken) {
    throw new Error("The ready2order Developer Token has not been configured yet.");
  }

  const callbackUri = appendQuery(`${baseUrl(req)}/oauth/ready2order/callback`, { flow });
  const apiBase = (process.env.READY2ORDER_API_BASE_URL || "https://api.ready2order.com/v1").replace(/\/$/, "");
  const response = await fetch(`${apiBase}/developerToken/grantAccessToken`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${developerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ callbackUri }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    throw new Error(`ready2order authorization returned HTTP ${response.status}.`);
  }

  const payload = await response.json();
  if (!payload.grantAccessUri) {
    throw new Error("ready2order did not return an approval URL.");
  }
  return payload.grantAccessUri;
}

function requireMcpAccess(req, res, next) {
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const access = token ? unseal(token, "access") : null;
  const resource = resourceUrl(req);
  if (!access || access.aud !== resource || access.scope !== SCOPE || !access.ready2orderAccountToken) {
    const metadata = `${baseUrl(req)}/.well-known/oauth-protected-resource`;
    res.set("WWW-Authenticate", `Bearer resource_metadata="${metadata}", scope="${SCOPE}"`);
    return res.status(401).json({ error: "unauthorized", error_description: "Connect ready2order to continue." });
  }
  req.ready2orderAccountToken = access.ready2orderAccountToken;
  return next();
}

function textResult(data, summary) {
  return {
    content: [{ type: "text", text: `${summary}\n\n${JSON.stringify(data, null, 2)}` }],
    structuredContent: data,
  };
}

const oauthSecuritySchemes = [{ type: "oauth2", scopes: [SCOPE] }];

function toolConfig(title, description, inputSchema, outputSchema) {
  return {
    title,
    description,
    inputSchema,
    outputSchema,
    securitySchemes: oauthSecuritySchemes,
    _meta: { securitySchemes: oauthSecuritySchemes },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  };
}

const dateRangeSchema = {
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("First business date, formatted YYYY-MM-DD."),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Last business date, formatted YYYY-MM-DD."),
};

const moneySchema = z.number().describe("Amount in EUR.");
const summaryOutputSchema = z.object({
  date_from: z.string(),
  date_to: z.string(),
  currency: z.literal("EUR"),
  gross_sales: moneySchema,
  net_sales: moneySchema,
  vat: moneySchema,
  tips: moneySchema,
  bill_count: z.number().int(),
  average_bill: moneySchema,
});

const dailyOutputSchema = z.object({
  date_from: z.string(),
  date_to: z.string(),
  currency: z.literal("EUR"),
  days: z.array(z.object({
    date: z.string(),
    gross_sales: moneySchema,
    tips: moneySchema,
    bill_count: z.number().int(),
    average_bill: moneySchema,
  })),
});

const productOutputSchema = z.object({
  date_from: z.string(),
  date_to: z.string(),
  currency: z.literal("EUR"),
  products: z.array(z.object({
    product_id: z.union([z.number(), z.string(), z.null()]),
    product_name: z.string(),
    category: z.string(),
    quantity: z.number(),
    gross_sales: moneySchema,
  })),
});

const categoryOutputSchema = z.object({
  date_from: z.string(),
  date_to: z.string(),
  currency: z.literal("EUR"),
  categories: z.array(z.object({
    category: z.string(),
    quantity: z.number(),
    gross_sales: moneySchema,
  })),
});

const paymentOutputSchema = z.object({
  date_from: z.string(),
  date_to: z.string(),
  currency: z.literal("EUR"),
  payment_methods: z.array(z.object({
    payment_method: z.string(),
    gross_sales: moneySchema,
  })),
});

const staffOutputSchema = z.object({
  date_from: z.string(),
  date_to: z.string(),
  currency: z.literal("EUR"),
  staff: z.array(z.object({
    staff_member: z.string(),
    gross_sales: moneySchema,
    quantity: z.number(),
  })),
});

function createMcpServer(accountToken) {
  const server = new McpServer(
    { name: "karikaala-ready2order-statistics", version: "1.0.0" },
    {
      instructions: "Read-only KARIKAALA ready2order sales analytics. Use exact YYYY-MM-DD ranges, exclude training data, and never claim guest counts because the public bill API does not provide them.",
    },
  );

  server.registerTool(
    "get_sales_summary",
    toolConfig(
      "Get sales summary",
      "Use this when the user wants ready2order revenue, VAT, tips, bill count, or average bill for one date range.",
      dateRangeSchema,
      summaryOutputSchema,
    ),
    async ({ date_from, date_to }) => {
      const invoices = await listInvoices(accountToken, { dateFrom: date_from, dateTo: date_to });
      const result = summarizeInvoices(invoices, date_from, date_to);
      return textResult(result, `Sales summary for ${date_from} to ${date_to}.`);
    },
  );

  server.registerTool(
    "compare_sales_periods",
    toolConfig(
      "Compare sales periods",
      "Use this when the user wants a ready2order sales comparison between two exact periods, such as this week versus the same week last year.",
      {
        current_from: dateRangeSchema.date_from,
        current_to: dateRangeSchema.date_to,
        comparison_from: dateRangeSchema.date_from,
        comparison_to: dateRangeSchema.date_to,
      },
      z.object({
        current: summaryOutputSchema,
        comparison: summaryOutputSchema,
        change: z.object({
          gross_sales_percent: z.number().nullable(),
          bill_count_percent: z.number().nullable(),
          average_bill_percent: z.number().nullable(),
        }),
      }),
    ),
    async ({ current_from, current_to, comparison_from, comparison_to }) => {
      const [currentInvoices, comparisonInvoices] = await Promise.all([
        listInvoices(accountToken, { dateFrom: current_from, dateTo: current_to }),
        listInvoices(accountToken, { dateFrom: comparison_from, dateTo: comparison_to }),
      ]);
      const current = summarizeInvoices(currentInvoices, current_from, current_to);
      const comparison = summarizeInvoices(comparisonInvoices, comparison_from, comparison_to);
      const result = {
        current,
        comparison,
        change: {
          gross_sales_percent: percentageChange(current.gross_sales, comparison.gross_sales),
          bill_count_percent: percentageChange(current.bill_count, comparison.bill_count),
          average_bill_percent: percentageChange(current.average_bill, comparison.average_bill),
        },
      };
      return textResult(result, "Sales-period comparison completed.");
    },
  );

  server.registerTool(
    "get_daily_sales",
    toolConfig(
      "Get daily sales",
      "Use this when the user wants ready2order sales broken down by day within a date range.",
      dateRangeSchema,
      dailyOutputSchema,
    ),
    async ({ date_from, date_to }) => {
      const invoices = await listInvoices(accountToken, { dateFrom: date_from, dateTo: date_to });
      const result = dailySales(invoices, date_from, date_to);
      return textResult(result, `Daily sales for ${date_from} to ${date_to}.`);
    },
  );

  server.registerTool(
    "get_top_products",
    toolConfig(
      "Get top products",
      "Use this when the user wants the best-selling ready2order products by quantity and gross sales for a date range.",
      {
        ...dateRangeSchema,
        limit: z.number().int().min(1).max(50).default(10).describe("Maximum products to return."),
      },
      productOutputSchema,
    ),
    async ({ date_from, date_to, limit }) => {
      const invoices = await listInvoices(accountToken, { dateFrom: date_from, dateTo: date_to, items: true });
      const result = { date_from, date_to, currency: "EUR", products: topProducts(invoices, limit) };
      return textResult(result, `Top products for ${date_from} to ${date_to}.`);
    },
  );

  server.registerTool(
    "get_category_sales",
    toolConfig(
      "Get category sales",
      "Use this when the user wants ready2order product-category sales and quantities for a date range.",
      dateRangeSchema,
      categoryOutputSchema,
    ),
    async ({ date_from, date_to }) => {
      const invoices = await listInvoices(accountToken, { dateFrom: date_from, dateTo: date_to, items: true });
      const result = { date_from, date_to, currency: "EUR", categories: categorySales(invoices) };
      return textResult(result, `Category sales for ${date_from} to ${date_to}.`);
    },
  );

  server.registerTool(
    "get_payment_breakdown",
    toolConfig(
      "Get payment breakdown",
      "Use this when the user wants ready2order sales split by payment method for a date range.",
      dateRangeSchema,
      paymentOutputSchema,
    ),
    async ({ date_from, date_to }) => {
      const invoices = await listInvoices(accountToken, { dateFrom: date_from, dateTo: date_to, payments: true });
      const result = { date_from, date_to, currency: "EUR", payment_methods: paymentBreakdown(invoices) };
      return textResult(result, `Payment breakdown for ${date_from} to ${date_to}.`);
    },
  );

  server.registerTool(
    "get_staff_sales",
    toolConfig(
      "Get staff sales",
      "Use this when the user wants ready2order item sales grouped by staff member for a date range.",
      dateRangeSchema,
      staffOutputSchema,
    ),
    async ({ date_from, date_to }) => {
      const invoices = await listInvoices(accountToken, { dateFrom: date_from, dateTo: date_to, items: true });
      const result = { date_from, date_to, currency: "EUR", staff: staffSales(invoices) };
      return textResult(result, `Staff sales for ${date_from} to ${date_to}.`);
    },
  );

  return server;
}

app.get("/", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KARIKAALA ready2order</title><style>body{font-family:system-ui;background:#0b0d0c;color:#f5f5f5;max-width:720px;margin:10vh auto;padding:32px}strong{color:#15cd8e}code{background:#171b19;padding:3px 6px;border-radius:5px}</style></head><body><h1>KARIKAALA <strong>ready2order</strong></h1><p>Private, read-only sales statistics connector for ChatGPT.</p><p>MCP endpoint: <code>${resourceUrl(req)}</code></p></body></html>`);
});

app.get("/healthz", (req, res) => {
  const tokenConfigured = Boolean(process.env.MCP_TOKEN_SECRET?.length >= 32);
  res.status(tokenConfigured ? 200 : 503).json({
    status: tokenConfigured ? "ok" : "configuration_required",
    oauth_ready: tokenConfigured && Boolean(process.env.READY2ORDER_DEVELOPER_TOKEN),
  });
});

app.get("/.well-known/oauth-protected-resource", (req, res) => {
  res.json({
    resource: resourceUrl(req),
    authorization_servers: [baseUrl(req)],
    scopes_supported: [SCOPE],
    resource_documentation: `${baseUrl(req)}/`,
  });
});

app.get("/.well-known/oauth-authorization-server", (req, res) => {
  const issuer = baseUrl(req);
  res.json({
    issuer,
    authorization_response_iss_parameter_supported: true,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [SCOPE],
  });
});

app.post("/oauth/register", (req, res) => {
  const redirectUris = Array.isArray(req.body.redirect_uris)
    ? req.body.redirect_uris.map(safeRedirectUri).filter(Boolean)
    : [];
  if (!redirectUris.length || redirectUris.length !== req.body.redirect_uris.length) {
    return oauthError(res, 400, "invalid_redirect_uri", "Only HTTPS chatgpt.com redirect URIs are accepted.");
  }

  const clientId = `r2o_${seal({ purpose: "client", redirectUris }, 10 * 365 * 24 * 60 * 60)}`;
  return res.status(201).json({
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: req.body.client_name || "ChatGPT",
    redirect_uris: redirectUris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });
});

app.get("/oauth/authorize", async (req, res) => {
  const clientId = String(req.query.client_id || "");
  const client = clientId.startsWith("r2o_") ? unseal(clientId.slice(4), "client") : null;
  const redirectUri = safeRedirectUri(String(req.query.redirect_uri || ""));
  const resource = String(req.query.resource || resourceUrl(req));
  const scope = String(req.query.scope || SCOPE);
  const codeChallenge = String(req.query.code_challenge || "");

  if (!client || !redirectUri || !client.redirectUris.includes(redirectUri)) {
    return oauthError(res, 400, "invalid_client", "The OAuth client or redirect URI is invalid.");
  }
  if (req.query.response_type !== "code" || req.query.code_challenge_method !== "S256" || !codeChallenge) {
    return oauthError(res, 400, "invalid_request", "Authorization code with PKCE S256 is required.");
  }
  if (resource !== resourceUrl(req) || scope.split(/\s+/).filter(Boolean).some((item) => item !== SCOPE)) {
    return oauthError(res, 400, "invalid_scope", "Only read-only statistics access is available.");
  }

  const flow = seal({
    purpose: "authorization_flow",
    clientId,
    redirectUri,
    state: String(req.query.state || ""),
    codeChallenge,
    resource,
    scope: SCOPE,
    issuer: baseUrl(req),
  }, 10 * 60);

  try {
    const grantAccessUri = await requestReady2OrderApproval(req, flow);
    return res.redirect(302, grantAccessUri);
  } catch (error) {
    return res.status(503).type("html").send(`<!doctype html><html><body><h1>ready2order connection unavailable</h1><p>${String(error.message).replace(/[<>&]/g, "")}</p></body></html>`);
  }
});

app.get("/oauth/ready2order/callback", (req, res) => {
  const flow = unseal(String(req.query.flow || ""), "authorization_flow");
  if (!flow) return oauthError(res, 400, "invalid_request", "The authorization session expired.");

  const approved = req.query.status === "approved" && typeof req.query.accountToken === "string";
  if (!approved) {
    return res.redirect(302, appendQuery(flow.redirectUri, {
      error: "access_denied",
      error_description: "ready2order access was not approved.",
      state: flow.state,
      iss: flow.issuer,
    }));
  }

  const code = seal({
    purpose: "authorization_code",
    clientId: flow.clientId,
    redirectUri: flow.redirectUri,
    codeChallenge: flow.codeChallenge,
    resource: flow.resource,
    scope: flow.scope,
    ready2orderAccountToken: req.query.accountToken,
  }, 5 * 60);

  return res.redirect(302, appendQuery(flow.redirectUri, {
    code,
    state: flow.state,
    iss: flow.issuer,
  }));
});

app.post("/oauth/token", (req, res) => {
  const grantType = String(req.body.grant_type || "");
  const clientId = String(req.body.client_id || "");
  const client = clientId.startsWith("r2o_") ? unseal(clientId.slice(4), "client") : null;
  if (!client) return oauthError(res, 401, "invalid_client", "The OAuth client is invalid or expired.");

  let accountToken;
  let resource;
  let scope;

  if (grantType === "authorization_code") {
    const codeValue = String(req.body.code || "");
    const code = unseal(codeValue, "authorization_code");
    if (!code || usedAuthorizationCodes.has(code.jti)) {
      return oauthError(res, 400, "invalid_grant", "The authorization code is invalid, expired, or already used.");
    }
    if (code.clientId !== clientId || code.redirectUri !== String(req.body.redirect_uri || "")) {
      return oauthError(res, 400, "invalid_grant", "The authorization code does not match this client.");
    }
    const verifier = String(req.body.code_verifier || "");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    if (!verifier || challenge !== code.codeChallenge) {
      return oauthError(res, 400, "invalid_grant", "PKCE verification failed.");
    }
    if (req.body.resource && req.body.resource !== code.resource) {
      return oauthError(res, 400, "invalid_target", "The resource does not match the authorization grant.");
    }
    usedAuthorizationCodes.set(code.jti, code.exp);
    accountToken = code.ready2orderAccountToken;
    resource = code.resource;
    scope = code.scope;
  } else if (grantType === "refresh_token") {
    const refresh = unseal(String(req.body.refresh_token || ""), "refresh");
    if (!refresh || refresh.clientId !== clientId) {
      return oauthError(res, 400, "invalid_grant", "The refresh token is invalid or expired.");
    }
    if (req.body.resource && req.body.resource !== refresh.resource) {
      return oauthError(res, 400, "invalid_target", "The resource does not match the refresh token.");
    }
    accountToken = refresh.ready2orderAccountToken;
    resource = refresh.resource;
    scope = refresh.scope;
  } else {
    return oauthError(res, 400, "unsupported_grant_type", "Only authorization_code and refresh_token are supported.");
  }

  const accessToken = seal({
    purpose: "access",
    clientId,
    aud: resource,
    scope,
    ready2orderAccountToken: accountToken,
  }, 12 * 60 * 60);
  const refreshToken = seal({
    purpose: "refresh",
    clientId,
    resource,
    scope,
    ready2orderAccountToken: accountToken,
  }, 90 * 24 * 60 * 60);

  return res.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 12 * 60 * 60,
    refresh_token: refreshToken,
    scope,
  });
});

app.post("/mcp", requireMcpAccess, async (req, res) => {
  const server = createMcpServer(req.ready2orderAccountToken);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal MCP server error" },
        id: req.body?.id ?? null,
      });
    }
  }
});

app.get("/mcp", requireMcpAccess, (req, res) => {
  res.status(405).set("Allow", "POST").json({ error: "method_not_allowed" });
});

app.delete("/mcp", requireMcpAccess, (req, res) => {
  res.status(405).set("Allow", "POST").json({ error: "method_not_allowed" });
});

setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [jti, exp] of usedAuthorizationCodes.entries()) {
    if (exp <= now) usedAuthorizationCodes.delete(jti);
  }
}, 60_000).unref();

const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => {
  console.log(`KARIKAALA ready2order MCP listening on port ${port}`);
});

export { app, createMcpServer };
