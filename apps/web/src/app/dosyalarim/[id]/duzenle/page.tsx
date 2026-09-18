import { notFound } from "next/navigation";

import { getCaseFile } from "@/lib/cases/get-case";
import { requireSession } from "@/lib/session";
import NewCaseForm, { type EnforcementCaseTab } from "../../yeni/NewCaseForm";

const tabs: EnforcementCaseTab[] = ["general", "payments", "notifications", "notes", "documents"];

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  await requireSession();
  const id = (await params).id;
  const record = await getCaseFile(id);
  if (!record) notFound();
  const requestedTab = (await searchParams).tab;
  const initialTab = tabs.includes(requestedTab as EnforcementCaseTab) ? requestedTab as EnforcementCaseTab : "general";
  return <NewCaseForm caseId={id} initialData={record} initialTab={initialTab} />;
}
