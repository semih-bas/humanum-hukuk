-- AlterTable
ALTER TABLE "case_file" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedById" TEXT;

-- CreateIndex
CREATE INDEX "case_file_archivedAt_idx" ON "case_file"("archivedAt");

-- AddForeignKey
ALTER TABLE "case_file" ADD CONSTRAINT "case_file_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Legal case records are archived instead of physically deleted by the runtime application.
REVOKE DELETE ON TABLE
    "case_file",
    "case_file_change",
    "case_note",
    "case_document",
    "case_reminder"
FROM humanum_app;

-- Case history is append-only for the runtime application role.
REVOKE UPDATE ON TABLE "case_file_change" FROM humanum_app;
