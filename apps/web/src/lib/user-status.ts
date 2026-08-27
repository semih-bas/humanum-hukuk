export type UserStatusAction = "ban" | "unban";

type UserStatusValidation = {
  action: UserStatusAction;
  actorUserId: string;
  targetUserId: string;
  targetRole: string | null;
  targetBanned: boolean;
  activeAdminCount: number;
};

export function validateUserStatusChange(input: UserStatusValidation): string | null {
  if (input.action === "ban" && input.actorUserId === input.targetUserId) {
    return "Kendi hesabınızı pasifleştiremezsiniz.";
  }

  if (input.action === "ban" && input.targetRole === "admin" && !input.targetBanned && input.activeAdminCount <= 1) {
    return "Sistemdeki son aktif yönetici pasifleştirilemez.";
  }

  return null;
}
