/**
 * High-precision ISO/IEC 15417 Code 128 (Subset B) SVG Barcode Generator.
 * Optimized for direct thermal monochrome printing (203/300 DPI, Xprinter, Gprinter, Zebra).
 */

const CODE128_PATTERNS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112', // 100-106 (106 is STOP)
];

const START_B = 104;
const STOP = 106;

export interface BarcodeRect {
  x: number;
  width: number;
}

/**
 * Encodes text using Code 128B and returns SVG bar definitions and total module width.
 */
export function generateCode128Bars(text: string, moduleWidth = 2): { rects: BarcodeRect[]; totalWidth: number } {
  const cleanText = text.trim() || 'WOWTEK-1001';
  const codes: number[] = [START_B];
  let checksum = START_B;

  for (let i = 0; i < cleanText.length; i++) {
    const charCode = cleanText.charCodeAt(i);
    // ASCII 32 to 126
    const code = charCode >= 32 && charCode <= 126 ? charCode - 32 : 0;
    codes.push(code);
    checksum += code * (i + 1);
  }

  const checkDigit = checksum % 103;
  codes.push(checkDigit);
  codes.push(STOP);

  const rects: BarcodeRect[] = [];
  let currentX = 10 * moduleWidth; // Quiet zone of 10 modules

  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code];
    if (!pattern) continue;

    for (let j = 0; j < pattern.length; j++) {
      const width = parseInt(pattern[j], 10) * moduleWidth;
      const isBar = j % 2 === 0;
      if (isBar) {
        rects.push({ x: currentX, width });
      }
      currentX += width;
    }
  }

  currentX += 10 * moduleWidth; // Right quiet zone

  return {
    rects,
    totalWidth: currentX,
  };
}
