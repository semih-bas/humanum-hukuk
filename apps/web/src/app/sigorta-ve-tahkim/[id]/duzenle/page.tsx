import CaseRecordPage from "../../CaseRecordPage";
import type { InsuranceCaseTab } from "../../yeni/NewInsuranceCaseForm";

const tabs: InsuranceCaseTab[] = ["general", "payments", "note", "notifications", "documents"];

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const requestedTab = (await searchParams).tab;
  const initialTab = tabs.includes(requestedTab as InsuranceCaseTab) ? requestedTab as InsuranceCaseTab : "general";
  return <CaseRecordPage id={(await params).id} readOnly={false} initialTab={initialTab} />;
}
