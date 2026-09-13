import { requireSession } from "@/lib/session";
import NewInsuranceCaseForm from "./NewInsuranceCaseForm";

export default async function Page() { await requireSession(); return <NewInsuranceCaseForm />; }
