import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";

import { adminRole, authAccessControl, userRole } from "./auth-permissions";
import { tryWriteAuditLog } from "./audit";
import { prisma } from "./database";
import { sendEmailVerificationEmail, sendPasswordResetEmail } from "./email";
import { requireEnvironmentVariable, requireHttpUrl } from "./environment";

const authBaseUrl = requireHttpUrl("BETTER_AUTH_URL");
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

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
          if (context?.context.session?.user.role === "admin") {
            await prisma.user.update({
              where: { id: user.id },
              data: { mustChangePassword: true },
            });
          }
          await tryWriteAuditLog({
            actorUserId: context?.context.session?.user.id ?? null,
            event: "user.created",
            targetType: "user",
            targetId: user.id,
          });
        },
      },
      update: {
        before: async (user, context) => {
          if (user.banned !== true || !user.id || !context?.context.session) return;

          const target = await prisma.user.findUnique({
            where: { id: user.id },
            select: { role: true, banned: true },
          });
          if (target?.role !== "admin" || target.banned) return;

          const activeAdminCount = await prisma.user.count({
            where: { role: "admin", banned: false },
          });
          if (activeAdminCount <= 1) {
            throw new Error("The last active administrator cannot be deactivated.");
          }
        },
        after: async (user, context) => {
          if (context?.path === "/admin/ban-user" || context?.path === "/admin/unban-user") {
            await tryWriteAuditLog({
              actorUserId: context?.context.session?.user.id ?? null,
              event: user.banned ? "user.deactivated" : "user.activated",
              targetType: "user",
              targetId: user.id,
              context: { targetName: user.name },
            });
          }
          await tryWriteAuditLog({
            actorUserId: context?.context.session?.user.id ?? user.id,
            event: "user.updated",
            targetType: "user",
            targetId: user.id,
          });
        },
      },
    },
    account: {
      update: {
        before: async (_account, context) => {
          if (context?.path === "/admin/set-user-password") {
            throw new Error("Administrator password changes for other users are disabled.");
          }
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
  emailVerification: {
    expiresIn: 30 * 60,
    sendOnSignIn: true,
    sendVerificationEmail: async ({ user, url }) => {
      void sendEmailVerificationEmail({
        to: user.email,
        recipientName: user.name,
        verificationUrl: url,
      }).catch((error: unknown) => {
        console.error("Failed to send email verification", {
          error: error instanceof Error ? error.name : "UnknownError",
        });
      });
      await tryWriteAuditLog({
        actorUserId: user.id,
        event: "auth.email_verification_requested",
        targetType: "user",
        targetId: user.id,
      });
    },
    afterEmailVerification: async (user) => {
      await tryWriteAuditLog({
        actorUserId: user.id,
        event: "auth.email_verified",
        targetType: "user",
        targetId: user.id,
      });
    },
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    resetPasswordTokenExpiresIn: 30 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      void sendPasswordResetEmail({
        to: user.email,
        recipientName: user.name,
        resetUrl: url,
      }).catch((error: unknown) => {
        console.error("Failed to send password reset email", {
          error: error instanceof Error ? error.name : "UnknownError",
        });
      });
      await tryWriteAuditLog({
        actorUserId: user.id,
        event: "auth.password_reset_requested",
        targetType: "user",
        targetId: user.id,
      });
    },
    onPasswordReset: async ({ user }) => {
      await prisma.user.update({
        where: { id: user.id },
        data: { mustChangePassword: false },
      });
      await tryWriteAuditLog({
        actorUserId: user.id,
        event: "auth.password_reset_completed",
        targetType: "user",
        targetId: user.id,
      });
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: {
      "/request-password-reset": { window: 5 * 60, max: 3 },
      "/reset-password": { window: 5 * 60, max: 5 },
      "/send-verification-email": { window: 5 * 60, max: 3 },
    },
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
