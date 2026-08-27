import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "./auth";
import { prisma } from "./database";

export async function requireSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mustChangePassword: true },
  });

  if (user?.mustChangePassword) {
    redirect("/sifre-degistir");
  }

  return session;
}
