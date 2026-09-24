CREATE TABLE "insurance_arbitration_note" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "insurance_arbitration_note_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "insurance_arbitration_note_content_check" CHECK (char_length(btrim("content")) > 0)
);

CREATE INDEX "insurance_arbitration_note_caseId_createdAt_idx" ON "insurance_arbitration_note"("caseId", "createdAt");
CREATE INDEX "insurance_arbitration_note_authorId_createdAt_idx" ON "insurance_arbitration_note"("authorId", "createdAt");
ALTER TABLE "insurance_arbitration_note" ADD CONSTRAINT "insurance_arbitration_note_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "insurance_arbitration_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "insurance_arbitration_note" ADD CONSTRAINT "insurance_arbitration_note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "insurance_arbitration_note" ("id", "caseId", "authorId", "content", "createdAt", "updatedAt")
SELECT 'legacy_' || "id", "id", "updatedById", btrim("description"), "updatedAt", "updatedAt"
FROM "insurance_arbitration_case"
WHERE "description" IS NOT NULL AND char_length(btrim("description")) > 0;
