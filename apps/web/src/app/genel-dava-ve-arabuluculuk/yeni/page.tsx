import { requireSession } from "@/lib/session";
import { getGeneralCaseOverview } from "@/lib/general-legal-cases/overview";
import GeneralCaseWizard, { type WizardInitialData } from "./GeneralCaseWizard";

export default async function Page({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const session = await requireSession();
  const { edit } = await searchParams;
  const initialData = edit ? await getGeneralCaseOverview(edit, { id: session.user.id, role: session.user.role }) : null;
  return <GeneralCaseWizard currentUser={{ id: session.user.id, name: session.user.name }} initialData={initialData as unknown as WizardInitialData | null} />;
}
