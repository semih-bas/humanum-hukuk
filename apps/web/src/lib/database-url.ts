type DatabaseRole = "app" | "migration";

const roleVariables = {
  app: {
    user: "HUMANUM_APP_DB_USER",
    password: "HUMANUM_APP_DB_PASSWORD",
  },
  migration: {
    user: "HUMANUM_MIGRATION_DB_USER",
    password: "HUMANUM_MIGRATION_DB_PASSWORD",
  },
} as const;

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function buildDatabaseUrl(role: DatabaseRole): string {
  const variables = roleVariables[role];
  const url = new URL("postgresql://127.0.0.1:5432");

  url.username = requireEnvironmentVariable(variables.user);
  url.password = requireEnvironmentVariable(variables.password);
  url.pathname = `/${requireEnvironmentVariable("POSTGRES_DB")}`;
  url.searchParams.set("schema", "public");

  return url.toString();
}
