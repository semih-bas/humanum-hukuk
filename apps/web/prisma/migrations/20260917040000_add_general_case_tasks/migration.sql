CREATE TYPE "GeneralTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "GeneralTaskStatus" AS ENUM ('PLANNED', 'WAITING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE "general_case_task" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "assigneeUserId" TEXT,
    "priority" "GeneralTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "taskType" VARCHAR(100),
    "reminderOffsetMinutes" INTEGER,
    "status" "GeneralTaskStatus" NOT NULL DEFAULT 'PLANNED',
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "general_case_task_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "general_case_task_caseId_dueAt_idx" ON "general_case_task"("caseId", "dueAt");
CREATE INDEX "general_case_task_caseId_status_priority_idx" ON "general_case_task"("caseId", "status", "priority");
CREATE INDEX "general_case_task_assigneeUserId_status_dueAt_idx" ON "general_case_task"("assigneeUserId", "status", "dueAt");

ALTER TABLE "general_case_task" ADD CONSTRAINT "general_case_task_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "general_legal_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "general_case_task" ADD CONSTRAINT "general_case_task_assigneeUserId_fkey"
FOREIGN KEY ("assigneeUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "general_case_task" ADD CONSTRAINT "general_case_task_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "general_case_task" ADD CONSTRAINT "general_case_task_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
