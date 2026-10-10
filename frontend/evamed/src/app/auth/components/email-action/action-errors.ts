// Codes Firebase returns for an email link that can't be used any more:
// spent, expired, malformed, or for an account that no longer exists.
const UNUSABLE = new Set([
  'auth/invalid-action-code',
  'auth/expired-action-code',
  'auth/user-disabled',
  'auth/user-not-found',
]);

export function isUnusableLink(error: unknown): boolean {
  return UNUSABLE.has((error as { code?: string } | null)?.code ?? '');
}
