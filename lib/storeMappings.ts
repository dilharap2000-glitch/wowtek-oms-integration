import { StoreMapping } from '@/types';

export const DEFAULT_STORE_MAPPINGS: StoreMapping[] = [
  // PickMe Food & Market Branches
  {
    id: 'store-pkm-bamba-01',
    platform: 'pickme',
    externalStoreId: 'MERCH-PKM-COL-4491',
    externalStoreName: 'WOWTEK Colombo 04 Flagship',
    branchName: 'Bambalapitiya (Main)',
    address: 'No. 142 Galle Road, Bambalapitiya',
    city: 'Colombo 04',
    phone: '0779673004',
    commissionFeePercent: 20,
    isActive: true,
    createdAt: '2026-10-12T00:00:00.000Z',
  },
  {
    id: 'store-pkm-liberty-02',
    platform: 'pickme',
    externalStoreId: 'MERCH-PKM-COL-5520',
    externalStoreName: 'WOWTEK Liberty Plaza Tech Store',
    branchName: 'Liberty Plaza (Col 03)',
    address: 'Shop 24, Liberty Plaza, R.A. De Mel Mawatha',
    city: 'Colombo 03',
    phone: '0779673005',
    commissionFeePercent: 20,
    isActive: true,
    createdAt: '2026-10-12T00:00:00.000Z',
  },
  {
    id: 'store-pkm-kandy-03',
    platform: 'pickme',
    externalStoreId: 'MERCH-PKM-KDY-1104',
    externalStoreName: 'WOWTEK Kandy City Centre',
    branchName: 'Kandy City Centre',
    address: 'Level 2, Kandy City Centre, Dalada Veediya',
    city: 'Kandy',
    phone: '0812234567',
    commissionFeePercent: 20,
    isActive: true,
    createdAt: '2026-10-12T00:00:00.000Z',
  },

  // Uber Eats Retail Branches
  {
    id: 'store-ubr-col03-01',
    platform: 'ubereats',
    externalStoreId: 'eats-store-srilanka-0914',
    externalStoreName: 'WOWTEK Electronics - Colombo 03',
    branchName: 'Bambalapitiya / Col 03',
    address: 'No. 142 Galle Road, Colombo 03',
    city: 'Colombo 03',
    phone: '0779673004',
    commissionFeePercent: 15.4,
    isActive: true,
    createdAt: '2026-10-12T00:00:00.000Z',
  },
  {
    id: 'store-ubr-kollupitiya-02',
    platform: 'ubereats',
    externalStoreId: 'eats-store-srilanka-1022',
    externalStoreName: 'WOWTEK Gadgets & Tech - Kollupitiya',
    branchName: 'Kollupitiya',
    address: 'No. 320 Galle Road, Kollupitiya',
    city: 'Colombo 03',
    phone: '0779673006',
    commissionFeePercent: 15.4,
    isActive: true,
    createdAt: '2026-10-12T00:00:00.000Z',
  },
  {
    id: 'store-ubr-rajagiriya-03',
    platform: 'ubereats',
    externalStoreId: 'eats-store-srilanka-2105',
    externalStoreName: 'WOWTEK Tech Hub - Rajagiriya',
    branchName: 'Rajagiriya / Kotte',
    address: 'No. 45 Kotte Road, Rajagiriya',
    city: 'Sri Jayawardenepura Kotte',
    phone: '0112876543',
    commissionFeePercent: 15.4,
    isActive: true,
    createdAt: '2026-10-12T00:00:00.000Z',
  },
];

/**
 * Normalizes an identifier string (trims, lowercases, strips special characters)
 */
function cleanIdentifier(id?: string): string {
  if (!id) return '';
  return id.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Intelligent Multi-Store & Branch Resolution Engine
 * Matches external payloads, headers, or query parameters from PickMe & Uber Eats
 * to the configured OMS StoreMapping.
 */
export function findMatchingStore(
  platform: 'pickme' | 'ubereats',
  params: {
    externalStoreId?: string;
    branchId?: string;
    merchantId?: string;
    storeName?: string;
    branchName?: string;
    rawPayload?: any;
  },
  configuredStores: StoreMapping[] = []
): {
  matchedStore: StoreMapping;
  isExactMatch: boolean;
  matchReason: string;
} {
  const allStores = configuredStores.length > 0 ? configuredStores : DEFAULT_STORE_MAPPINGS;
  const platformStores = allStores.filter((s) => s.platform === platform && s.isActive !== false);

  if (platformStores.length === 0) {
    // Fallback pseudo-store
    const fallback: StoreMapping = {
      id: `store-${platform}-default`,
      platform,
      externalStoreId: params.externalStoreId || params.branchId || `${platform}-main`,
      externalStoreName: `WOWTEK ${platform === 'pickme' ? 'PickMe' : 'Uber Eats'} Main Store`,
      branchName: 'Main Branch',
      commissionFeePercent: platform === 'pickme' ? 20 : 15.4,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    return {
      matchedStore: fallback,
      isExactMatch: false,
      matchReason: 'fallback_default',
    };
  }

  // 1. Gather all candidate IDs from incoming request
  const candidateIds: string[] = [
    params.externalStoreId,
    params.branchId,
    params.merchantId,
    params.rawPayload?.store_id,
    params.rawPayload?.storeId,
    params.rawPayload?.branch_id,
    params.rawPayload?.branchId,
    params.rawPayload?.merchant_id,
    params.rawPayload?.merchantId,
    params.rawPayload?.restaurant_id,
    params.rawPayload?.restaurantId,
    params.rawPayload?.location_id,
    params.rawPayload?.locationId,
    params.rawPayload?.meta?.resource_id,
    params.rawPayload?.meta?.store_id,
    params.rawPayload?.meta?.location_id,
    params.rawPayload?.meta?.branch_id,
    params.rawPayload?.store?.id,
    params.rawPayload?.branch?.id,
    params.rawPayload?.pos_branch_id,
  ]
    .filter(Boolean)
    .map((s) => String(s).trim());

  // Check exact / normalized store ID match
  for (const store of platformStores) {
    const cleanStoreExtId = cleanIdentifier(store.externalStoreId);
    const cleanStoreId = cleanIdentifier(store.id);

    for (const cand of candidateIds) {
      const cleanCand = cleanIdentifier(cand);
      if (
        cleanCand === cleanStoreExtId ||
        cleanCand === cleanStoreId ||
        (cleanCand.length >= 4 && cleanStoreExtId.includes(cleanCand)) ||
        (cleanStoreExtId.length >= 4 && cleanCand.includes(cleanStoreExtId))
      ) {
        return {
          matchedStore: store,
          isExactMatch: true,
          matchReason: `store_id_exact: "${cand}" -> ${store.branchName} (${store.externalStoreId})`,
        };
      }
    }
  }

  // 2. Gather candidate Names from incoming request
  const candidateNames: string[] = [
    params.storeName,
    params.branchName,
    params.rawPayload?.store_name,
    params.rawPayload?.storeName,
    params.rawPayload?.branch_name,
    params.rawPayload?.branchName,
    params.rawPayload?.location_name,
    params.rawPayload?.restaurant_name,
    params.rawPayload?.store?.name,
    params.rawPayload?.branch?.name,
    params.rawPayload?.pickup_address,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase().trim());

  // Check branch name fuzzy / substring match
  for (const store of platformStores) {
    const cleanBranch = store.branchName.toLowerCase();
    const cleanExtName = store.externalStoreName.toLowerCase();

    for (const cand of candidateNames) {
      if (
        cand.includes(cleanBranch) ||
        cleanBranch.includes(cand) ||
        cand.includes(cleanExtName) ||
        cleanExtName.includes(cand)
      ) {
        return {
          matchedStore: store,
          isExactMatch: true,
          matchReason: `store_name_matched: "${cand}" -> ${store.branchName}`,
        };
      }
    }
  }

  // 3. Fallback to first primary store for the platform
  const primaryStore = platformStores[0];
  return {
    matchedStore: primaryStore,
    isExactMatch: false,
    matchReason: `default_platform_branch: Assigned to primary branch "${primaryStore.branchName}"`,
  };
}
