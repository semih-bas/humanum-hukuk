import { createAccessControl } from "better-auth/plugins/access";

const statement = {
  user: ["create", "list", "set-role", "ban", "get", "update"],
  session: ["list", "revoke", "delete"],
} as const;

export const authAccessControl = createAccessControl(statement);

export const adminRole = authAccessControl.newRole({
  user: ["create", "list", "get"],
  session: ["list", "revoke", "delete"],
});

export const userRole = authAccessControl.newRole({
  user: [],
  session: [],
});
