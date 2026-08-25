import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";

import { adminRole, authAccessControl, userRole } from "./auth-permissions";
import { tryWriteAuditLog } from "./audit";
import { prisma } from "./database";
import { requireEnvironmentVariable, requireHttpUrl } from "./environment";

const authBaseUrl = requireHttpUrl("BETTER_AUTH_URL");

export const auth = betterAuth({
  appName: "Humanum Hukuk",
  baseURL: authBaseUrl,
  secret: requireEnvironmentVariable("BETTER_AUTH_SECRET"),
  trustedOrigins: [authBaseUrl],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  databaseHooks: {
    user: {
      create: {
        after: async (user, context) => {
          await tryWriteAuditLog({
            actorUserId: context?.context.session?.user.id ?? null,
            event: "user.created",
            targetType: "user",
            targetId: user.id,
          });
        },
      },
      update: {
        after: async (user, context) => {
          await tryWriteAuditLog({
            actorUserId: context?.context.session?.user.id ?? user.id,
            event: "user.updated",
            targetType: "user",
            targetId: user.id,
          });
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          await tryWriteAuditLog({
            actorUserId: session.userId,
            event: "auth.signed_in",
            targetType: "session",
            targetId: session.id,
            ipAddress: session.ipAddress,
          });
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
  },
  advanced: {
    database: {
      joins: true,
    },
  },
  plugins: [
    admin({
      ac: authAccessControl,
      roles: {
        admin: adminRole,
        user: userRole,
      },
      defaultRole: "user",
    }),
    nextCookies(),
  ],
});
