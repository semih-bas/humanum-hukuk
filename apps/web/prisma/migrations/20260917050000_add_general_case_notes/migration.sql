CREATE TYPE "GeneralNoteVisibility" AS ENUM ('TEAM', 'PRIVATE');

CREATE TABLE "general_case_note" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "noteType" VARCHAR(50) NOT NULL,
    "visibility" "GeneralNoteVisibility" NOT NULL DEFAULT 'TEAM',
    "important" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "general_case_note_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "general_case_note_caseId_createdAt_idx" ON "general_case_note"("caseId", "createdAt");
CREATE INDEX "general_case_note_caseId_noteType_important_idx" ON "general_case_note"("caseId", "noteType", "important");
CREATE INDEX "general_case_note_authorId_createdAt_idx" ON "general_case_note"("authorId", "createdAt");

ALTER TABLE "general_case_note" ADD CONSTRAINT "general_case_note_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "general_legal_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "general_case_note" ADD CONSTRAINT "general_case_note_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
