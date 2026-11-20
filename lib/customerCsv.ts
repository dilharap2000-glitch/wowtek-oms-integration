import { formatSriLankanPhone, isValidSriLankanPhone } from '@/lib/phoneUtils';

export interface ParsedCustomerCsvRow {
  rowNumber: number;
  name: string;
  rawPhone: string;
  formattedPhone: string;
  source: string;
  isValid: boolean;
  isDuplicateInFile: boolean;
  error?: string;
}

export interface CustomerCsvParseSummary {
  rows: ParsedCustomerCsvRow[];
  validRows: ParsedCustomerCsvRow[];
  invalidRows: ParsedCustomerCsvRow[];
  duplicateRows: ParsedCustomerCsvRow[];
  totalRows: number;
}

/**
 * RFC-4180 compliant CSV line parser supporting quoted values and escaped quotes ("").
 */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Splits raw CSV text into normalized rows (handling CRLF/LF and UTF-8 BOM).
 */
export function parseCsvMatrix(csvText: string): string[][] {
  const cleaned = csvText.replace(/^\uFEFF/, '');
  const rawLines = cleaned.split(/\r?\n/);
  const rows: string[][] = [];

  for (const line of rawLines) {
    if (!line.trim()) continue;
    rows.push(parseCsvLine(line));
  }

  return rows;
}

/**
 * Parses and validates a customer CSV file with Sri Lankan phone number normalization.
 */
export function parseCustomerCsv(
  csvText: string,
  defaultSource = 'CSV Import'
): CustomerCsvParseSummary {
  const matrix = parseCsvMatrix(csvText);
  if (matrix.length === 0) {
    return {
      rows: [],
      validRows: [],
      invalidRows: [],
      duplicateRows: [],
      totalRows: 0,
    };
  }

  const firstRowLower = matrix[0].map((c) => c.toLowerCase().replace(/[\s_-]+/g, ''));

  const nameHeaderNames = ['name', 'customername', 'fullname', 'customer', 'clientname'];
  const phoneHeaderNames = ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'tel', 'telephone', 'contact', 'contactnumber', 'whatsapp'];
  const sourceHeaderNames = ['source', 'channel', 'origin', 'tag'];

  const detectedNameIdx = firstRowLower.findIndex((h) => nameHeaderNames.includes(h));
  const detectedPhoneIdx = firstRowLower.findIndex((h) => phoneHeaderNames.includes(h));
  const detectedSourceIdx = firstRowLower.findIndex((h) => sourceHeaderNames.includes(h));

  const hasHeaderRow = detectedNameIdx !== -1 || detectedPhoneIdx !== -1 || detectedSourceIdx !== -1;

  let nameIdx = detectedNameIdx;
  let phoneIdx = detectedPhoneIdx;
  let sourceIdx = detectedSourceIdx;

  if (!hasHeaderRow) {
    // Positional fallback: single column = phone only; 2+ columns = [name, phone, source?]
    if (matrix[0].length === 1) {
      nameIdx = -1;
      phoneIdx = 0;
      sourceIdx = -1;
    } else {
      nameIdx = 0;
      phoneIdx = 1;
      sourceIdx = matrix[0].length >= 3 ? 2 : -1;
    }
  } else if (phoneIdx === -1) {
    // Header existed (e.g. "name,contact_no"), fallback to second column if available
    phoneIdx = matrix[0].length > 1 ? (nameIdx === 0 ? 1 : 0) : 0;
  }

  const dataRows = hasHeaderRow ? matrix.slice(1) : matrix;
  const seenPhones = new Set<string>();
  const parsedRows: ParsedCustomerCsvRow[] = [];

  dataRows.forEach((cols, idx) => {
    const rowNumber = hasHeaderRow ? idx + 2 : idx + 1;
    const rawName = nameIdx >= 0 && cols[nameIdx] !== undefined ? cols[nameIdx].trim() : '';
    const rawPhone = phoneIdx >= 0 && cols[phoneIdx] !== undefined ? cols[phoneIdx].trim() : '';
    const rawSource = sourceIdx >= 0 && cols[sourceIdx] !== undefined ? cols[sourceIdx].trim() : '';

    if (!rawName && !rawPhone) return;

    const formattedPhone = formatSriLankanPhone(rawPhone);
    const validFormat = isValidSriLankanPhone(formattedPhone);

    if (!rawPhone) {
      parsedRows.push({
        rowNumber,
        name: rawName || 'CSV Customer',
        rawPhone: '',
        formattedPhone: '',
        source: rawSource || defaultSource,
        isValid: false,
        isDuplicateInFile: false,
        error: 'Missing phone number',
      });
      return;
    }

    if (!validFormat) {
      parsedRows.push({
        rowNumber,
        name: rawName || 'CSV Customer',
        rawPhone,
        formattedPhone,
        source: rawSource || defaultSource,
        isValid: false,
        isDuplicateInFile: false,
        error: 'Invalid Sri Lankan phone format (expected 07XXXXXXXX, +947XXXXXXXX, or 011XXXXXXX)',
      });
      return;
    }

    const isDuplicateInFile = seenPhones.has(formattedPhone);
    if (!isDuplicateInFile) {
      seenPhones.add(formattedPhone);
    }

    parsedRows.push({
      rowNumber,
      name: rawName || 'CSV Customer',
      rawPhone,
      formattedPhone,
      source: rawSource || defaultSource,
      isValid: !isDuplicateInFile,
      isDuplicateInFile,
      error: isDuplicateInFile ? `Duplicate phone number in CSV (${formattedPhone})` : undefined,
    });
  });

  return {
    rows: parsedRows,
    validRows: parsedRows.filter((r) => r.isValid),
    invalidRows: parsedRows.filter((r) => !r.isValid && !r.isDuplicateInFile),
    duplicateRows: parsedRows.filter((r) => r.isDuplicateInFile),
    totalRows: parsedRows.length,
  };
}

export const SAMPLE_CUSTOMER_CSV = [
  'name,phone,source',
  'Kasun Perera,0771234567,CSV Import',
  'Nimali Silva,+94715330724,Retail VIP',
  'Dilshan Fernando,94768889900,POS Walk-In',
  'Amaya Jayawardena,011 234 5678,Colombo Store',
].join('\n');
