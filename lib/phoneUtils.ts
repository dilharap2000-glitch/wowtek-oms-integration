/**
 * Sri Lankan Phone Number Formatting and Validation Utility
 *
 * Requirements:
 * 1. Automatically prepend or format Sri Lankan phone numbers with "+94" if starting with "0"
 *    (e.g., "0715330724" -> "+94715330724").
 * 2. Ensure phone number validation and formatting clean up spaces or hyphens before saving so that
 *    all phone numbers uniformly start with "+94".
 */

/**
 * Normalizes any Sri Lankan phone number to uniform "+94XXXXXXXXX" format.
 * Strips whitespace, hyphens, brackets, dots, and handles leading 0, 94, or +94.
 */
export function formatSriLankanPhone(input: string): string {
  if (!input) return '';

  // 1. Remove all whitespace, hyphens, brackets, and periods
  let cleaned = String(input).trim().replace(/[\s\-\(\)\.]+/g, '');

  // 2. If user enters "+0...", remove the 0
  if (cleaned.startsWith('+0')) {
    cleaned = '+' + cleaned.slice(2);
  }

  // 3. Handle various prefixes:
  // - Starts with "0" (e.g., 0715330724 or 0112345678) -> replace "0" with "+94"
  // - Starts with "94" without "+" (e.g., 94715330724) -> prepend "+"
  // - Starts with "+94" -> keep prefix
  // - Starts with 9 digits (e.g., 715330724) -> prepend "+94"
  if (cleaned.startsWith('0')) {
    cleaned = '+94' + cleaned.slice(1);
  } else if (cleaned.startsWith('94')) {
    cleaned = '+' + cleaned;
  } else if (cleaned.startsWith('+94')) {
    // Already has +94 prefix
  } else if (/^[1-9]\d{8}$/.test(cleaned)) {
    cleaned = '+94' + cleaned;
  }

  return cleaned;
}

/**
 * Validates if the phone number is a valid Sri Lankan phone number in "+94XXXXXXXXX" format.
 * Sri Lankan phone numbers have 9 digits after +94 (total 12 characters).
 * Mobile: +94 7X XXXXXXX (e.g., 70, 71, 72, 74, 75, 76, 77, 78)
 * Fixed: +94 11/21/23/24/25/26/27/31/32/33/34/35/36/37/38/41/45/47/51/52/54/55/57/63/65/66/67/81/91 XXXXXXX
 */
export function isValidSriLankanPhone(phone: string): boolean {
  if (!phone) return false;
  const formatted = formatSriLankanPhone(phone);
  // Must be "+94" followed by exactly 9 digits
  return /^\+94\d{9}$/.test(formatted);
}

/**
 * Helper for live input changes:
 * If user starts typing "0", immediately transforms into "+94" while cleaning hyphens & spaces.
 */
export function handleLivePhoneInput(rawInput: string): string {
  if (!rawInput) return '';

  // Remove spaces and hyphens
  let val = rawInput.replace(/[\s\-\(\)\.]+/g, '');

  // If user typed only "0", change to "+94"
  if (val === '0') {
    return '+94';
  }

  // If user entered "0..." (e.g. pasted or typed fast), replace leading 0 with "+94"
  if (val.startsWith('0')) {
    return '+94' + val.slice(1);
  }

  // If user enters "94..." without "+", prepend "+"
  if (val.startsWith('94') && !val.startsWith('+')) {
    return '+' + val;
  }

  return val;
}
