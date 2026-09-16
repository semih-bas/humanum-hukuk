import AppShell from "@/components/app-shell/AppShell";
import { requireSession } from "@/lib/session";
import GeneralLegalCasesClient from "./GeneralLegalCasesClient";

export default async function Page() {
  await requireSession();
  return <AppShell><GeneralLegalCasesClient /></AppShell>;
}
