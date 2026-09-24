import { requireSession } from "@/lib/session";
import NewCaseForm from "./NewCaseForm";

export default async function Page() {
  const session = await requireSession();
  return <NewCaseForm currentUserName={session.user.name} />;
}
