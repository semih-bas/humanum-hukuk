import { ReactNode } from "react";

import { requireSession } from "@/lib/session";

export default async function FilesLayout({ children }: { children: ReactNode }) {
  await requireSession();
  return children;
}
