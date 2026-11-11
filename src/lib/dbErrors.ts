// Kept free of the Supabase client so it can be unit-tested.

export const SAVE_FAILED_TEXT = "Check your connection, then reload to see what's saved.";
export const SIGNED_OUT_TEXT = "You've been signed out. Sign in again.";

export function saveFailedMessage(count: number): string {
  return count === 1
    ? `Couldn't save your change. ${SAVE_FAILED_TEXT}`
    : `${count} changes couldn't be saved. ${SAVE_FAILED_TEXT}`;
}

// PostgREST's JWT codes (missing/invalid/expired token) and Postgres's
// insufficient_privilege, which is what an RLS-protected write hits once the
// request has fallen back to the anon key.
const AUTH_CODES = new Set(['PGRST301', 'PGRST302', 'PGRST303', '42501']);

// `status` is the HTTP status from the Supabase response; the error object
// itself doesn't carry it. Offline failures come back as status 0.
export function isAuthError(error: unknown, status?: number): boolean {
  if (status === 401 || status === 403) return true;
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (typeof code === 'string' && AUTH_CODES.has(code)) return true;
  return typeof message === 'string' && /\bjwt\b/i.test(message);
}
