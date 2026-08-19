import crypto from "node:crypto";

function tokenSecret() {
  const secret = process.env.MCP_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("MCP_TOKEN_SECRET must contain at least 32 characters.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function seal(payload, ttlSeconds) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", tokenSecret(), iv);
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
    jti: crypto.randomUUID(),
  }));
  const encrypted = Buffer.concat([cipher.update(body), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), encrypted.toString("base64url"), tag.toString("base64url")].join(".");
}

export function unseal(token, expectedPurpose) {
  try {
    const [version, ivValue, encryptedValue, tagValue] = String(token).split(".");
    if (version !== "v1" || !ivValue || !encryptedValue || !tagValue) throw new Error("invalid token");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      tokenSecret(),
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]);
    const payload = JSON.parse(decrypted.toString("utf8"));
    if (payload.purpose !== expectedPurpose) throw new Error("wrong token purpose");
    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) throw new Error("expired token");
    return payload;
  } catch {
    return null;
  }
}
