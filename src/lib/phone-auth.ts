/**
 * Supabase Auth requires an email/password identity. To let staff log in with
 * just a phone number (no SMS/OTP provider needed), we derive a synthetic,
 * never-shown internal email from the normalized phone number and use that
 * as the real Supabase Auth identity under the hood. The actual phone number
 * is only ever stored/displayed via `public.users.phone`.
 */

const SYNTHETIC_EMAIL_DOMAIN = "staff.tram.internal";

export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function phoneToSyntheticEmail(phone: string): string {
  return `${normalizePhone(phone)}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

/** Given whatever the user typed in the login box, resolve the email to authenticate with. */
export function resolveLoginEmail(identifier: string): string {
  const trimmed = identifier.trim();
  if (trimmed.includes("@")) return trimmed;
  return phoneToSyntheticEmail(trimmed);
}
