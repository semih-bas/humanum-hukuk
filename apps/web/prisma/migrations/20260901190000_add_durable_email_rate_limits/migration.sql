CREATE TABLE "rate_limit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_rate_limit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "email_rate_limit_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "rate_limit_key_key" ON "rate_limit"("key");
CREATE INDEX "email_rate_limit_lastRequest_idx" ON "email_rate_limit"("lastRequest");
