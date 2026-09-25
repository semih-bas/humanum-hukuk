export type AuthEmailAccountState = {
  banned: boolean | null;
  deletionRequestedAt: Date | null;
} | null;

export function authEmailAccountMayReceiveEmail(account: AuthEmailAccountState): boolean {
  return Boolean(account && account.banned !== true && account.deletionRequestedAt === null);
}
