/**
 * Dev / E2E convenience: a single fixed address that can sign in WITHOUT the
 * magic-link email round-trip.
 *
 * This is an authentication bypass for one hardcoded account. It is OFF unless
 * ALLOW_TEST_LOGIN is explicitly set to "true", and even then it only ever logs
 * in TEST_LOGIN_EMAIL, never an arbitrary address. Do not enable it on a
 * production deployment that holds real customer data.
 */
export const TEST_LOGIN_EMAIL = "skope-test-email123@skope.network";

/** Whether the test-login bypass is switched on for this environment. */
export function isTestLoginAllowed(): boolean {
  return process.env.ALLOW_TEST_LOGIN === "true";
}

/** True only for the one designated test address. */
export function isTestLoginEmail(email: string): boolean {
  return email.trim().toLowerCase() === TEST_LOGIN_EMAIL;
}
