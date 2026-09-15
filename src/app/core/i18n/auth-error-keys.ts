// Presentation-only mapping; unknown server messages remain intact.
const AUTH_ERROR_KEYS: Readonly<Record<string, string>> = {
  "Not authenticated.": "auth.error.notAuthenticated",
  "Incorrect current password.": "auth.error.incorrectCurrent",
  "Invalid login credentials": "auth.error.invalidCredentials",
  "Email not confirmed": "auth.error.emailNotConfirmed",
  "New password should be different from the old password.": "auth.error.samePassword"
};
export function authErrorKey(message: string | undefined): string | undefined {
  return message ? (AUTH_ERROR_KEYS[message] ?? message) : message;
}
