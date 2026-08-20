import test from "node:test";
import assert from "node:assert/strict";
import { seal, unseal } from "../src/security.js";

process.env.MCP_TOKEN_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef";

test("encrypts and validates scoped tokens", () => {
  const token = seal({ purpose: "access", aud: "https://example.com/mcp", scope: "statistics.read" }, 60);
  const payload = unseal(token, "access");
  assert.equal(payload.aud, "https://example.com/mcp");
  assert.equal(payload.scope, "statistics.read");
  assert.equal(unseal(token, "refresh"), null);
});

test("rejects modified tokens", () => {
  const token = seal({ purpose: "access" }, 60);
  assert.equal(unseal(`${token}x`, "access"), null);
});
