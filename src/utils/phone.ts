import { FIELD_PATTERNS } from '@/src/types/gompoco';

export interface PhoneValidationResult {
  valid: boolean;
  normalized: string; // e.g. "27821234567" (for wa.me)
  display: string; // e.g. "+27 82 123 4567"
  e164: string; // e.g. "+27821234567"
  error: string | null;
}

/**
 * Normalises and validates South African mobile/telephone numbers.
 * Accepted input formats:
 * - 0821234567
 * - 27821234567
 * - +27821234567
 * Also handles spaces, dashes, and parentheses (e.g. "+27 (82) 123-4567").
 */
export function normalizeSouthAfricanPhone(rawInput: string): PhoneValidationResult {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      normalized: '',
      display: '',
      e164: '',
      error: 'Mobile or WhatsApp number is required.',
    };
  }

  // Remove spaces, hyphens, parentheses, and dots while preserving leading '+'
  const hasLeadingPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');

  if (!digitsOnly) {
    return {
      valid: false,
      normalized: '',
      display: '',
      e164: '',
      error: 'Enter a valid South African phone number (e.g. 0821234567 or +27821234567).',
    };
  }

  let normalized = '';

  if (digitsOnly.startsWith('0027') && digitsOnly.length === 13) {
    normalized = digitsOnly.slice(2);
  } else if (digitsOnly.startsWith('27') && digitsOnly.length === 11) {
    normalized = digitsOnly;
  } else if (!hasLeadingPlus && digitsOnly.startsWith('0') && digitsOnly.length === 10) {
    normalized = `27${digitsOnly.slice(1)}`;
  } else if (hasLeadingPlus && digitsOnly.startsWith('27') && digitsOnly.length === 11) {
    normalized = digitsOnly;
  } else {
    return {
      valid: false,
      normalized: '',
      display: '',
      e164: '',
      error:
        'Use a valid 10-digit SA number (0821234567) or international format (+27821234567 / 27821234567).',
    };
  }

  if (!FIELD_PATTERNS.phoneNormalized.test(normalized)) {
    return {
      valid: false,
      normalized: '',
      display: '',
      e164: '',
      error: 'The digit after +27 cannot be 0. Check the South African number and try again.',
    };
  }

  const localPart = normalized.slice(2); // 9 digits
  const display = `+27 ${localPart.slice(0, 2)} ${localPart.slice(2, 5)} ${localPart.slice(5, 9)}`;

  return {
    valid: true,
    normalized,
    display,
    e164: `+${normalized}`,
    error: null,
  };
}

/**
 * Builds the exact WhatsApp Click-to-Chat URL required:
 * https://wa.me/INTERNATIONALPHONENUMBER?text=URL_ENCODED_MESSAGE
 */
export function buildWhatsAppClickToChatUrl(normalizedPhone: string, message: string): string {
  const cleanPhone = (normalizedPhone || '').replace(/\D/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
