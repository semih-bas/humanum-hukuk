"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

import { adminRole, authAccessControl, userRole } from "./auth-permissions";

export const authClient = createAuthClient({
  plugins: [
    adminClient({
      ac: authAccessControl,
      roles: {
        admin: adminRole,
        user: userRole,
      },
    }),
  ],
});
