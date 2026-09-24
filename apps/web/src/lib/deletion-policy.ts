export const DELETION_RETENTION_DAYS = 30;
export function deletionDueAt(now = new Date()) { return new Date(now.getTime() + DELETION_RETENTION_DAYS * 86_400_000); }
export function validateUserDeletion(input: { actorUserId: string; targetUserId: string; targetBanned: boolean; alreadyScheduled: boolean }) {
  if (input.actorUserId === input.targetUserId) return "Kendi hesabınızı silemezsiniz.";
  if (!input.targetBanned) return "Kullanıcı silinmeden önce pasifleştirilmelidir.";
  if (input.alreadyScheduled) return "Kullanıcı zaten silinmek üzere işaretlendi.";
  return null;
}
