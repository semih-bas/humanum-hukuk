import { prisma } from "@/lib/database";

import type { GeneralCaseActor } from "./access";
import { listGeneralCaseDocuments } from "./document-storage";
import { getGeneralCaseFinance } from "./finance-service";
import { getGeneralCaseProcess } from "./process-service";
import { getGeneralLegalCase } from "./read";

export async function getGeneralCaseOverview(caseId: string, actor: GeneralCaseActor) {
  const [legalCase, finance, process, documents, tasks, notes] = await Promise.all([
    getGeneralLegalCase(caseId, actor),
    getGeneralCaseFinance(caseId, actor),
    getGeneralCaseProcess(caseId, actor),
    listGeneralCaseDocuments(caseId, actor),
    prisma.generalCaseTask.findMany({
      where: { caseId }, orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      select: { id: true, title: true, description: true, priority: true, dueAt: true, taskType: true, status: true, assignee: { select: { id: true, name: true } } },
    }),
    prisma.generalCaseNote.findMany({
      where: { caseId, OR: [{ visibility: "TEAM" }, { authorId: actor.id }] }, orderBy: [{ createdAt: "desc" }],
      select: { id: true, content: true, noteType: true, visibility: true, important: true, createdAt: true, author: { select: { id: true, name: true } } },
    }),
  ]);
  return {
    legalCase, finance, process, documents,
    tasks: tasks.map((task) => ({ ...task, dueAt: task.dueAt.toISOString() })),
    notes: notes.map((note) => ({ ...note, createdAt: note.createdAt.toISOString() })),
  };
}
