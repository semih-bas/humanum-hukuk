import { config } from "dotenv";
import { defineConfig } from "prisma/config";

import { buildDatabaseUrl } from "./src/lib/database-url";

config({ path: ".env.docker", quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: buildDatabaseUrl("migration"),
  },
});
