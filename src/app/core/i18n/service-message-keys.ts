import { TranslationService } from '../services/translation.service';

// Known operational errors are translated only for display. Unknown server text is preserved.
const SERVICE_MESSAGE_KEYS: Readonly<Record<string, string>> = {
  'Negative press count is not allowed.': 'production.error.negativePresses',
  'PiecesPerPress is not configured for this product.': 'production.error.piecesPerPressMissing',
  'Not authenticated.': 'auth.error.notAuthenticated',
  'Unable to reach the user-creation service. Is the "create-user" Edge Function deployed?': 'users.error.createServiceUnavailable',
  'Failed to create user.': 'users.error.createFailed'
};

export function displayServiceMessage(message: string | undefined, translation: TranslationService): string | undefined {
  if (!message) return message;
  const key = SERVICE_MESSAGE_KEYS[message];
  return key ? translation.t(key) : message;
}
