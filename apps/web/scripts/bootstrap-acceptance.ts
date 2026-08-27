import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { hashPassword, verifyPassword } from "better-auth/crypto";

config({ path: [".env.acceptance.bootstrap", ".env.acceptance.app", ".env.acceptance.database"], quiet: true });

const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const databasePassword = process.env.POSTGRES_PASSWORD;

if (!email || !name || !password || !databasePassword) {
  throw new Error("Missing acceptance bootstrap environment variables");
}

const client = new pg.Client({
  host: "127.0.0.1",
  port: 55432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: databasePassword,
});

await client.connect();
try {
  const existing = await client.query<{ id: string }>("SELECT id FROM \"user\" WHERE email = $1", [email]);
  if (existing.rowCount) {
    const passwordHash = await hashPassword(password);
    await client.query("UPDATE \"user\" SET role = 'admin' WHERE id = $1", [existing.rows[0].id]);
    await client.query(
      "UPDATE \"account\" SET issuer = 'local:credential', password = $1 WHERE \"userId\" = $2 AND \"providerId\" = 'credential'",
      [passwordHash, existing.rows[0].id],
    );
    console.log(`Acceptance administrator already exists: ${email}`);
  } else {
    const userId = randomUUID();
    const passwordHash = await hashPassword(password);
    await client.query("BEGIN");
    try {
      await client.query(
        "INSERT INTO \"user\" (id, name, email, \"emailVerified\", role, banned, \"createdAt\", \"updatedAt\") VALUES ($1, $2, $3, true, 'admin', false, NOW(), NOW())",
        [userId, name, email],
      );
      await client.query(
        "INSERT INTO \"account\" (id, issuer, \"accountId\", \"providerId\", \"userId\", password, \"createdAt\", \"updatedAt\") VALUES ($1, 'local:credential', $2, 'credential', $2, $3, NOW(), NOW())",
        [randomUUID(), userId, passwordHash],
      );
      await client.query("COMMIT");
      console.log(`Acceptance administrator created: ${email}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  const count = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM \"user\"");
  if (count.rows[0].count !== "1") {
    throw new Error(`Acceptance database contains ${count.rows[0].count} users; expected exactly 1`);
  }
  const credential = await client.query<{ password: string | null }>(
    "SELECT password FROM \"account\" WHERE \"userId\" = (SELECT id FROM \"user\" WHERE email = $1) AND \"providerId\" = 'credential' AND issuer = 'local:credential'",
    [email],
  );
  if (!credential.rows[0]?.password || !(await verifyPassword({ hash: credential.rows[0].password, password }))) {
    throw new Error("Acceptance administrator credential verification failed");
  }
  console.log("Acceptance user count verified: 1");
} finally {
  await client.end();
}
