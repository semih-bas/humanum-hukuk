import { requireSession } from "@/lib/session";
import NewInsuranceCaseForm from "./NewInsuranceCaseForm";

export default async function Page() { const session = await requireSession(); return <NewInsuranceCaseForm currentUserName={session.user.name} />; }
