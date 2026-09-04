import { isLoopbackHostname, requireEnvironmentVariable } from "./environment";

type DatabaseRole = "app" | "migration" | "shadow";

const roleVariables = {
  app: {
    url: "DATABASE_URL",
    user: "HUMANUM_APP_DB_USER",
    password: "HUMANUM_APP_DB_PASSWORD",
    database: "POSTGRES_DB",
  },
  migration: {
    url: "MIGRATION_DATABASE_URL",
    user: "HUMANUM_MIGRATION_DB_USER",
    password: "HUMANUM_MIGRATION_DB_PASSWORD",
    database: "POSTGRES_DB",
  },
  shadow: {
    url: "SHADOW_DATABASE_URL",
    user: "HUMANUM_MIGRATION_DB_USER",
    password: "HUMANUM_MIGRATION_DB_PASSWORD",
    database: "HUMANUM_SHADOW_DB",
  },
} as const;

export function buildDatabaseUrl(role: DatabaseRole): string {
  const variables = roleVariables[role];
  const configuredUrl = process.env[variables.url]?.trim();

  if (configuredUrl) {
    let url: URL;

    try {
      url = new URL(configuredUrl);
    } catch {
      throw new Error(`Invalid database URL in environment variable: ${variables.url}`);
    }

    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
      throw new Error(`Unsupported database protocol in environment variable: ${variables.url}`);
    }

    const forbiddenConnectionOverrides = ["host", "hostname", "hostaddr", "port", "user", "password", "database", "ssl"];
    const presentOverride = forbiddenConnectionOverrides.find((parameter) => url.searchParams.has(parameter));
    if (presentOverride) {
      throw new Error(`${variables.url} must not override connection identity or TLS through the ${presentOverride} query parameter.`);
    }

    const sslModes = url.searchParams.getAll("sslmode");
    if (sslModes.length > 1) {
      throw new Error(`${variables.url} must contain at most one sslmode parameter.`);
    }

    const localService = url.hostname.toLowerCase() === "database" || isLoopbackHostname(url.hostname);
    if (process.env.NODE_ENV === "production" && !localService && sslModes[0] !== "verify-full") {
      throw new Error(`${variables.url} must use sslmode=verify-full for an external production database.`);
    }

    return url.toString();
  }

  const url = new URL("postgresql://127.0.0.1:5432");

  url.username = requireEnvironmentVariable(variables.user);
  url.password = requireEnvironmentVariable(variables.password);
  url.pathname = `/${requireEnvironmentVariable(variables.database)}`;
  url.searchParams.set("schema", "public");

  return url.toString();
}
