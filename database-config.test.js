import test from "node:test";
import assert from "node:assert/strict";
import { databaseConfig } from "./database-config.js";

test("URL options cannot disable certificate validation or change the private schema", () => {
  const config = databaseConfig({
    DATABASE_URL: "postgresql://app:example@localhost:5432/postgres?sslmode=disable&ssl=false&options=-c%20search_path=public",
  });
  const url = new URL(config.connectionString);
  assert.equal(url.searchParams.has("sslmode"), false);
  assert.equal(url.searchParams.has("ssl"), false);
  assert.equal(url.searchParams.has("options"), false);
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.options, "-c search_path=dashboard_private,pg_catalog");
});

test("Supabase CA is supported without relaxing TLS verification", () => {
  const config = databaseConfig({ DATABASE_URL: "postgresql://app:example@localhost/postgres", DATABASE_CA_CERT: "line1\\nline2" });
  assert.equal(config.ssl.ca, "line1\nline2");
  assert.equal(config.ssl.rejectUnauthorized, true);
});

test("invalid connection configuration fails before starting the server", () => {
  assert.throws(() => databaseConfig({}), /required/);
  assert.throws(() => databaseConfig({ DATABASE_URL: "https://example.com" }), /PostgreSQL/);
});
