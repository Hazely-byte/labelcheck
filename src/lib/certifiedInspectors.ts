/**
 * Server and client-side allowlist for certified Legal Metrology inspectors.
 * Authenticated user emails from Google OAuth sessions are verified against this list.
 */
export const CERTIFIED_INSPECTOR_EMAILS = [
  "sakshampanigrahi9@gmail.com",
  "adwerdadwerd8@gmail.com",
] as const;

/**
 * Checks whether the given email belongs to a certified Legal Metrology inspector.
 */
export function isCertifiedInspector(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return CERTIFIED_INSPECTOR_EMAILS.some(
    (allowedEmail) => allowedEmail.toLowerCase() === normalized
  );
}
