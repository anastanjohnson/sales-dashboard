// Server-only connection settings for the isolated Supabase copy.
export function databaseConfig(env = process.env) {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const url = new URL(env.DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection string");
  }
  // node-postgres URL SSL options can override the verified TLS object below.
  for (const key of ["sslmode", "ssl", "sslcert", "sslkey", "sslrootcert"]) {
    url.searchParams.delete(key);
  }
  url.searchParams.delete("options");
  return {
    connectionString: url.toString(),
    ssl: {
      rejectUnauthorized: true,
      ...(env.DATABASE_CA_CERT ? { ca: env.DATABASE_CA_CERT.replace(/\\n/g, "\n") } : {}),
    },
    options: "-c search_path=dashboard_private,pg_catalog",
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  };
}
