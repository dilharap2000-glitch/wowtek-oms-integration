import { Product, ProductAlias } from '@/types';

/**
 * Common marketplace filler and noise words stripped during multi-channel keyword matching.
 * Examples: "Soundcore anker r50i True wireless earbuds" vs "Anker r50i earbuds" -> core: ["soundcore", "anker", "r50i"]
 */
export const COMMON_FILLER_WORDS = new Set([
  'true',
  'wireless',
  'earbuds',
  'earbud',
  'earphone',
  'earphones',
  'headphone',
  'headphones',
  'headset',
  'bluetooth',
  'tws',
  'original',
  'genuine',
  'official',
  'edition',
  'series',
  'version',
  'gen',
  'generation',
  'model',
  'smart',
  'portable',
  'gaming',
  'black',
  'white',
  'blue',
  'red',
  'color',
  'grey',
  'gray',
  'silver',
  'gold',
  'with',
  'for',
  'and',
  'the',
  'a',
  'an',
  'in',
  'on',
  'of',
  'by',
  'fast',
  'super',
  'cable',
  'adapter',
  'charger',
  'case',
  'cover',
  'brand',
  'new',
  'sealed',
  'pack',
  'piece',
  'pcs',
  'ltd',
  'pvt',
  'store',
  'shop',
  'direct',
  'lk',
  'sri',
  'lanka',
]);

export const DEFAULT_PRODUCT_ALIASES: ProductAlias[] = [
  {
    id: 'alias-001',
    channel: 'all',
    externalTitle: 'Soundcore anker r50i True wireless earbuds',
    targetSku: 'WT-ANK-R50I',
    targetProductName: 'Anker Soundcore R50i True Wireless Earbuds (Black)',
    notes: 'WooCommerce vs Uber Eats common title mapping',
    createdAt: '2026-10-12T00:00:00.000Z',
  },
  {
    id: 'alias-002',
    channel: 'ubereats',
    externalTitle: 'Anker r50i earbuds',
    targetSku: 'WT-ANK-R50I',
    targetProductName: 'Anker Soundcore R50i True Wireless Earbuds (Black)',
    notes: 'Uber Eats shortened title',
    createdAt: '2026-10-12T00:00:00.000Z',
  },
  {
    id: 'alias-003',
    channel: 'all',
    externalTitle: 'Logitech MX Master 3S Graphite',
    targetSku: 'WT-MOUSE-MX3S',
    targetProductName: 'Logitech MX Master 3S Wireless Mouse - Graphite',
    notes: 'Shortened multi-channel title',
    createdAt: '2026-10-12T00:00:00.000Z',
  },
  {
    id: 'alias-004',
    channel: 'all',
    externalTitle: 'Kingston NV2 1TB M.2 SSD',
    targetSku: 'WT-SSD-1TB-NVME',
    targetProductName: 'Kingston NV2 1TB PCIe 4.0 NVMe SSD',
    notes: 'Common marketplace SSD variation',
    createdAt: '2026-10-12T00:00:00.000Z',
  },
  {
    id: 'alias-005',
    channel: 'all',
    externalTitle: 'Anker 65W GaN Charger 3-Pin',
    targetSku: 'WT-CHG-ANKER-65W',
    targetProductName: 'Anker 735 GaNPrime 65W Fast Charger (UK 3-Pin)',
    notes: 'PickMe / Uber Eats charger listing',
    createdAt: '2026-10-12T00:00:00.000Z',
  },
];

/**
 * Normalizes text: trims, lowercases, removes special punctuation
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if a token looks like a product model number (contains numbers or hyphenated code)
 * e.g., 'r50i', '735', '65w', 'k2', 'nv2', '1tb', 'mx3s', 'b450m', 'gtx1650'
 */
export function isModelCode(token: string): boolean {
  if (!token) return false;
  // Has at least one number, or is a known short alphanumeric model code of length >= 2
  return /\d/.test(token) && token.length >= 2;
}

/**
 * Strips filler words and extracts core brand, model, and category keywords.
 */
export function extractCoreKeywords(text: string): string[] {
  const norm = normalizeText(text);
  if (!norm) return [];

  const rawTokens = norm.split(/[\s-]+/).filter(Boolean);
  const keywords: string[] = [];

  for (const token of rawTokens) {
    // If it has digits (like r50i or 65w), always keep it!
    if (isModelCode(token)) {
      keywords.push(token);
      continue;
    }
    // Otherwise filter out filler words and ultra-short single characters
    if (!COMMON_FILLER_WORDS.has(token) && token.length >= 2) {
      keywords.push(token);
    }
  }

  return keywords;
}

export interface MatchResult {
  matchedProduct: Product | null;
  matchScore: number; // 0 to 1
  matchReason:
    | 'sku_exact'
    | 'sku_linked'
    | 'barcode_exact'
    | 'alias_mapping'
    | 'name_exact'
    | 'smart_keyword'
    | 'none';
  matchDetail?: string;
  matchedViaAlias?: ProductAlias;
}

/**
 * SMART PRODUCT NAME & SKU MATCHING ALGORITHM FOR MULTI-CHANNEL ORDERS
 *
 * Matching priority:
 * 1. SKU Linking (Exact SKU match, stripped prefixes)
 * 2. Barcode match
 * 3. Alias Mapping Table (custom merchant rules)
 * 4. Exact Title Match
 * 5. Smart Keyword & Fuzzy Match (strips noise words, matches core brand & model tokens like 'Anker', 'r50i')
 */
export function findBestProductMatch(
  params: {
    externalName?: string;
    externalSku?: string;
    externalBarcode?: string;
    channel?: string;
  },
  catalog: Product[],
  aliases: ProductAlias[] = []
): MatchResult {
  if (!catalog || catalog.length === 0) {
    return { matchedProduct: null, matchScore: 0, matchReason: 'none' };
  }

  const orderSku = (params.externalSku || '').trim();
  const orderBarcode = (params.externalBarcode || '').trim();
  const orderName = (params.externalName || '').trim();
  const channel = (params.channel || '').toLowerCase().trim();

  // -------------------------------------------------------------
  // 1. PRIORITY 1: SKU LINKING (Exact SKU match)
  // -------------------------------------------------------------
  if (orderSku && !orderSku.startsWith('WT-WC-DIRECT') && !orderSku.startsWith('WT-PROD')) {
    const normOrderSku = orderSku.toUpperCase().replace(/^WT-/, '').replace(/[^A-Z0-9]/g, '');

    for (const prod of catalog) {
      if (!prod.sku) continue;
      const cleanProdSku = prod.sku.toUpperCase().trim();
      const normProdSku = cleanProdSku.replace(/^WT-/, '').replace(/[^A-Z0-9]/g, '');

      // Exact SKU match
      if (cleanProdSku === orderSku.toUpperCase()) {
        return {
          matchedProduct: prod,
          matchScore: 1.0,
          matchReason: 'sku_exact',
          matchDetail: `Exact SKU Match: ${prod.sku}`,
        };
      }

      // Linked normalized SKU (e.g. ANK-R50I matches WT-ANK-R50I)
      if (normOrderSku && normProdSku && (normOrderSku === normProdSku || normProdSku.includes(normOrderSku))) {
        return {
          matchedProduct: prod,
          matchScore: 0.98,
          matchReason: 'sku_linked',
          matchDetail: `SKU Linked: ${orderSku} -> ${prod.sku}`,
        };
      }
    }
  }

  // -------------------------------------------------------------
  // 2. PRIORITY 2: BARCODE MATCH
  // -------------------------------------------------------------
  if (orderBarcode) {
    const barcodeProd = catalog.find((p) => p.barcode && p.barcode.trim() === orderBarcode);
    if (barcodeProd) {
      return {
        matchedProduct: barcodeProd,
        matchScore: 1.0,
        matchReason: 'barcode_exact',
        matchDetail: `Barcode Match: ${orderBarcode}`,
      };
    }
  }

  // -------------------------------------------------------------
  // 3. PRIORITY 3: ALIAS MAPPING TABLE
  // -------------------------------------------------------------
  const allAliases = [...DEFAULT_PRODUCT_ALIASES, ...aliases];
  if (orderName && allAliases.length > 0) {
    const normOrderName = normalizeText(orderName);

    for (const alias of allAliases) {
      // Channel constraint check: 'all' or matches specific channel
      if (alias.channel !== 'all' && channel && alias.channel !== channel) {
        continue;
      }

      const normAliasTitle = normalizeText(alias.externalTitle);
      if (normAliasTitle && (normOrderName === normAliasTitle || normOrderName.includes(normAliasTitle) || normAliasTitle.includes(normOrderName))) {
        const targetProd = catalog.find(
          (p) => p.sku.toUpperCase() === alias.targetSku.toUpperCase() || p.id === alias.targetSku
        );
        if (targetProd) {
          return {
            matchedProduct: targetProd,
            matchScore: 0.99,
            matchReason: 'alias_mapping',
            matchDetail: `Merchant Alias Map: "${alias.externalTitle}" -> ${alias.targetSku}`,
            matchedViaAlias: alias,
          };
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 4. PRIORITY 4: EXACT NAME MATCH
  // -------------------------------------------------------------
  if (orderName) {
    const normOrderName = normalizeText(orderName);
    const exactNameMatch = catalog.find((p) => normalizeText(p.name) === normOrderName);
    if (exactNameMatch) {
      return {
        matchedProduct: exactNameMatch,
        matchScore: 0.95,
        matchReason: 'name_exact',
        matchDetail: `Exact Title Match: ${exactNameMatch.name}`,
      };
    }
  }

  // -------------------------------------------------------------
  // 5. PRIORITY 5: KEYWORD & FUZZY MATCHING ALGORITHM
  // -------------------------------------------------------------
  // Strips filler words ("True", "wireless", "earbuds") and matches core brand/model keywords (e.g. "Anker", "r50i")
  if (orderName) {
    const orderKeywords = extractCoreKeywords(orderName);
    if (orderKeywords.length > 0) {
      const orderModelCodes = orderKeywords.filter(isModelCode);

      let bestProduct: Product | null = null;
      let highestScore = 0;
      let bestDetail = '';

      for (const prod of catalog) {
        const prodNameKeywords = extractCoreKeywords(prod.name);
        const prodSkuKeywords = extractCoreKeywords(prod.sku);
        const prodAllKeywords = Array.from(new Set([...prodNameKeywords, ...prodSkuKeywords]));
        const prodModelCodes = prodAllKeywords.filter(isModelCode);

        // Check model code intersection (e.g., both contain 'r50i')
        const sharedModelCodes = orderModelCodes.filter((mc) => prodModelCodes.includes(mc));
        const sharedAllKeywords = orderKeywords.filter((kw) => prodAllKeywords.includes(kw));

        // Union of keywords
        const unionSet = new Set([...orderKeywords, ...prodAllKeywords]);
        const jaccardScore = unionSet.size > 0 ? sharedAllKeywords.length / unionSet.size : 0;

        let score = 0;

        // HIGH CONFIDENCE SCENARIO:
        // Shared specific model code (e.g., 'r50i', 'mx3s', 'k2', 'nv2', '735') + shared brand
        if (sharedModelCodes.length > 0) {
          score = 0.85 + Math.min(sharedAllKeywords.length * 0.04, 0.12);
        } else if (sharedAllKeywords.length >= 2) {
          // Shared at least 2 strong core keywords
          score = 0.65 + jaccardScore * 0.3;
        } else if (sharedAllKeywords.length === 1 && orderKeywords.length === 1) {
          // Single specific keyword match
          score = 0.6;
        }

        if (score > highestScore && score >= 0.6) {
          highestScore = score;
          bestProduct = prod;
          bestDetail = `Smart Keyword Match: [${sharedAllKeywords.join(', ')}] matched to "${prod.name}"`;
        }
      }

      if (bestProduct && highestScore >= 0.6) {
        return {
          matchedProduct: bestProduct,
          matchScore: Math.min(highestScore, 0.95),
          matchReason: 'smart_keyword',
          matchDetail: bestDetail,
        };
      }
    }
  }

  return { matchedProduct: null, matchScore: 0, matchReason: 'none' };
}
