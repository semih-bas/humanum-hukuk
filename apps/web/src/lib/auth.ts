import { prismaAdapter } from "@better-auth/prisma-adapter";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";

import { adminRole, authAccessControl, userRole } from "./auth-permissions";
import { tryWriteAuditLog } from "./audit";
import { prisma } from "./database";
import { sendEmailVerificationEmail, sendPasswordResetEmail } from "./email";
import { consumeAuthEmailRequest, type TransactionalEmailCategory } from "./email-rate-limit";
import { requireEnvironmentVariable, requireHttpUrl } from "./environment";
import { adminUserCreationContainsPassword } from "./new-user-enrollment";

const authBaseUrl = requireHttpUrl("BETTER_AUTH_URL");
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

function dispatchAuthenticationEmail(options: {
  category: TransactionalEmailCategory;
  eventPrefix: string;
  send: () => ReturnType<typeof sendEmailVerificationEmail>;
  userId: string;
}): void {
  void options.send().then(async (result) => {
    await tryWriteAuditLog({
      actorUserId: null,
      event: result.status === "sent" ? `${options.eventPrefix}_sent` : `${options.eventPrefix}_suppressed`,
      targetType: "user",
      targetId: options.userId,
      context: result.status === "suppressed" ? { category: options.category, retryAfterSeconds: result.retryAfterSeconds } : { category: options.category },
    });
  }).catch(async (error: unknown) => {
    console.error("Failed to deliver authentication email", {
      category: options.category,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    await tryWriteAuditLog({
      actorUserId: null,
      event: `${options.eventPrefix}_failed`,
      targetType: "user",
      targetId: options.userId,
      context: { category: options.category, error: error instanceof Error ? error.name : "UnknownError" },
    });
  });
}

const authEmailRequestGuard = createAuthMiddleware(async (context) => {
  if (context.path === "/admin/create-user" && adminUserCreationContainsPassword(context.body)) {
    throw new APIError("BAD_REQUEST", {
      code: "ADMIN_PASSWORD_PROVISIONING_DISABLED",
      message: "Administrators cannot choose user passwords.",
    });
  }

  const category = context.path === "/request-password-reset"
    ? "password-reset"
    : context.path === "/send-verification-email"
      ? "verification"
      : null;
  if (!category) return;

  const email = typeof context.body?.email === "string" ? context.body.email.trim().toLowerCase() : "";
  if (!email) return;

  const decision = await consumeAuthEmailRequest(category, email);
  if (!decision.allowed) {
    return category === "password-reset"
      ? context.json({ status: true, message: "If this email exists in our system, check your email for the reset link" })
      : context.json({ status: true });
  }
});

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
      dispatchAuthenticationEmail({
        category: "verification",
        eventPrefix: "auth.email_verification_delivery",
        userId: user.id,
        send: () => sendEmailVerificationEmail({
          to: user.email,
          recipientName: user.name,
          verificationUrl: url,
        }),
      });
      await tryWriteAuditLog({
        actorUserId: null,
        event: "auth.email_verification_requested",
        targetType: "user",
        targetId: user.id,
      });
    },
    afterEmailVerification: async (user) => {
      await tryWriteAuditLog({
        actorUserId: null,
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
      dispatchAuthenticationEmail({
        category: "password-reset",
        eventPrefix: "auth.password_reset_delivery",
        userId: user.id,
        send: () => sendPasswordResetEmail({
          to: user.email,
          recipientName: user.name,
          resetUrl: url,
        }),
      });
      await tryWriteAuditLog({
        actorUserId: null,
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
        actorUserId: null,
        event: "auth.password_reset_completed",
        targetType: "user",
        targetId: user.id,
      });
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/request-password-reset": { window: 5 * 60, max: 3 },
      "/reset-password": { window: 5 * 60, max: 5 },
      "/send-verification-email": { window: 5 * 60, max: 3 },
    },
  },
  hooks: {
    before: authEmailRequestGuard,
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
