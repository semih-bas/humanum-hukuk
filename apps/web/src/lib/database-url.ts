import { requireEnvironmentVariable } from "./environment";

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

    return url.toString();
  }

  const url = new URL("postgresql://127.0.0.1:5432");

  url.username = requireEnvironmentVariable(variables.user);
  url.password = requireEnvironmentVariable(variables.password);
  url.pathname = `/${requireEnvironmentVariable(variables.database)}`;
  url.searchParams.set("schema", "public");

  return url.toString();
}
