import { requireSession } from "@/lib/session";
import GeneralCaseWizard from "./GeneralCaseWizard";

export default async function Page() {
  const session = await requireSession();
  return <GeneralCaseWizard currentUser={{ id: session.user.id, name: session.user.name }} />;
}
