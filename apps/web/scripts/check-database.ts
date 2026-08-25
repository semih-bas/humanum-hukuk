import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { config } from "dotenv";

import { buildDatabaseUrl } from "../src/lib/database-url";

config({ path: ".env.docker", quiet: true });

const adapter = new PrismaPg({
  connectionString: buildDatabaseUrl("app"),
});
const prisma = new PrismaClient({ adapter });

try {
  const [connection] = await prisma.$queryRaw<
    Array<{ database: string; user: string; serverVersion: string }>
  >`
    SELECT
      current_database() AS database,
      current_user AS "user",
      current_setting('server_version') AS "serverVersion"
  `;
  const [permissions] = await prisma.$queryRaw<
    Array<{ canCreateTables: boolean }>
  >`
    SELECT
      has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreateTables"
  `;

  if (!connection) {
    throw new Error("The database connection check returned no result.");
  }

  if (!permissions || permissions.canCreateTables) {
    throw new Error("The application database role has unexpected DDL privileges.");
  }

  console.log({
    status: "connected",
    ...connection,
    canCreateTables: permissions.canCreateTables,
  });
} finally {
  await prisma.$disconnect();
}
