import { config } from "dotenv";

import {
  assertAcceptanceFixtureEnvironment,
  readFixtureBatchId,
} from "./acceptance-fixture-data";
import {
  createAcceptanceFixturePrisma,
  verifyAcceptanceFixtures,
} from "./acceptance-fixture-database";

config({ path: [".env.acceptance.bootstrap", ".env.acceptance.app", ".env.acceptance.database"], quiet: true });
assertAcceptanceFixtureEnvironment();

const batchId = readFixtureBatchId();
const prisma = createAcceptanceFixturePrisma();

try {
  const summary = await verifyAcceptanceFixtures(prisma, batchId);
  console.log(JSON.stringify({ status: "acceptance-fixtures-verified", ...summary }, null, 2));
} finally {
  await prisma.$disconnect();
}
