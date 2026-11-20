import { formatSriLankanPhone } from '@/lib/phoneUtils';

export interface SmsRecipientContext {
  name?: string;
  phone?: string;
  source?: string;
}

export interface SmsVariableDefinition {
  key: string;
  token: string;
  label: string;
  description: string;
  example: string;
}

export const SMS_TEMPLATE_VARIABLES: SmsVariableDefinition[] = [
  {
    key: 'name',
    token: '{{name}}',
    label: 'Full Name',
    description: "Customer's full name (defaults to Valued Customer)",
    example: 'Kasun Perera',
  },
  {
    key: 'first_name',
    token: '{{first_name}}',
    label: 'First Name',
    description: "Customer's first name (defaults to Customer)",
    example: 'Kasun',
  },
  {
    key: 'date',
    token: '{{date}}',
    label: 'Today Date',
    description: 'Current date in Sri Lanka (Asia/Colombo)',
    example: '20 Nov 2026',
  },
  {
    key: 'phone',
    token: '{{phone}}',
    label: 'Phone (+94)',
    description: 'Recipient normalized +94 phone number',
    example: '+94771234567',
  },
  {
    key: 'source',
    token: '{{source}}',
    label: 'Source',
    description: 'Customer acquisition channel (e.g. POS, CSV Import)',
    example: 'POS',
  },
];

export function formatSriLankaSmsDate(date = new Date()): string {
  try {
    return date.toLocaleDateString('en-GB', {
      timeZone: 'Asia/Colombo',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return date.toISOString().split('T')[0];
  }
}

export function resolveSmsVariables(
  template: string,
  recipient: SmsRecipientContext = {},
  now = new Date()
): string {
  if (!template) return '';

  const rawName = String(recipient.name || '').trim();
  const resolvedName =
    rawName && rawName.toLowerCase() !== 'walk-in customer' ? rawName : 'Valued Customer';
  const resolvedFirstName =
    rawName && rawName.toLowerCase() !== 'walk-in customer'
      ? rawName.split(/\s+/)[0]
      : 'Customer';

  const formattedPhone = recipient.phone
    ? formatSriLankanPhone(String(recipient.phone))
    : '';
  const resolvedSource = String(recipient.source || '').trim() || 'WOWTEK';
  const resolvedDate = formatSriLankaSmsDate(now);

  return template
    .replace(/\{\{\s*name\s*\}\}/gi, resolvedName)
    .replace(/\{\{\s*first_name\s*\}\}/gi, resolvedFirstName)
    .replace(/\{\{\s*firstname\s*\}\}/gi, resolvedFirstName)
    .replace(/\{\{\s*phone\s*\}\}/gi, formattedPhone)
    .replace(/\{\{\s*date\s*\}\}/gi, resolvedDate)
    .replace(/\{\{\s*source\s*\}\}/gi, resolvedSource);
}

export interface SmsTemplatePreset {
  id: string;
  title: string;
  body: string;
}

export const SMS_SUGGESTED_TEMPLATES: SmsTemplatePreset[] = [
  {
    id: 'promo-10',
    title: 'Weekend 10% Promo',
    body: 'Hi {{first_name}}, WOWTEK Promo on {{date}}: Enjoy 10% OFF all gaming accessories this week! Show this SMS at billing in our Colombo store.',
  },
  {
    id: 'vip-15',
    title: 'VIP Discount Greeting',
    body: 'Dear {{name}}, exclusive WOWTEK VIP 15% discount coupon: VIP15 valid on store.wowtek.lk as of {{date}}.',
  },
  {
    id: 'dispatch-alert',
    title: 'Courier Dispatch Notice',
    body: 'Hi {{name}}, your WOWTEK order is packed on {{date}} and ready for Trans Express Courier dispatch to {{phone}}.',
  },
];

export function extractSmsTemplateTokens(template: string): string[] {
  if (!template) return [];
  const matches = template.match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) || [];
  return Array.from(new Set(matches.map((m) => m.replace(/\s+/g, '').toLowerCase())));
}
