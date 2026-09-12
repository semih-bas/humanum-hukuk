import AppShell from "@/components/app-shell/AppShell";
import { requireSession } from "@/lib/session";

export default async function Page() {
  await requireSession();
  return <AppShell><section aria-label="Sigorta ve Tahkim" /></AppShell>;
}
