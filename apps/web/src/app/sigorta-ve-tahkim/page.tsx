import AppShell from "@/components/app-shell/AppShell";
import { requireSession } from "@/lib/session";
import InsuranceArbitrationClient from "./InsuranceArbitrationClient";

export default async function Page() {
  await requireSession();
  return <AppShell><InsuranceArbitrationClient /></AppShell>;
}
