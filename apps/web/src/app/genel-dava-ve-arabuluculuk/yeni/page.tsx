import { requireSession } from "@/lib/session";
import { getGeneralCaseOverview } from "@/lib/general-legal-cases/overview";
import GeneralCaseWizard, { type WizardInitialData } from "./GeneralCaseWizard";

export default async function Page({ searchParams }: { searchParams: Promise<{ edit?: string; view?: string; step?: string }> }) {
  const session = await requireSession();
  const { edit, view, step } = await searchParams;
  const caseId = edit ?? view;
  const initialData = caseId ? await getGeneralCaseOverview(caseId, { id: session.user.id, role: session.user.role }) : null;
  const initialStep = Number.isInteger(Number(step)) ? Number(step) : 0;
  return <GeneralCaseWizard currentUser={{ id: session.user.id, name: session.user.name }} initialData={initialData as unknown as WizardInitialData | null} readOnly={Boolean(view)} initialStep={initialStep} />;
}
