/**
 * Maps Sri Lankan Districts, Cities, and Regions to Courier Destination Port & Sorting Hub Codes.
 * Used for prominent header sorting badges on Daraz-style 4x6 thermal shipping labels.
 */

const DISTRICT_PORT_MAP: Record<string, string> = {
  colombo: 'CMB',
  gampaha: 'GPH',
  kalutara: 'KLU',
  kandy: 'KDY',
  matale: 'MTL',
  'nuwara eliya': 'NWE',
  galle: 'GLE',
  matara: 'MTR',
  hambantota: 'HBT',
  jaffna: 'JFN',
  kilinochchi: 'KIL',
  mannar: 'MNR',
  vavuniya: 'VAV',
  mullaitivu: 'MLT',
  batticaloa: 'BTC',
  ampara: 'AMP',
  trincomalee: 'TRC',
  kurunegala: 'KGL',
  puttalam: 'PTM',
  anuradhapura: 'ANR',
  polonnaruwa: 'PLN',
  badulla: 'BAD',
  monaragala: 'MON',
  ratnapura: 'RTP',
  kegalle: 'KEG',
};

const CITY_PORT_MAP: Record<string, string> = {
  // Colombo suburbs & zones
  mulleriyawa: 'CMB',
  udumulla: 'CMB',
  kotikawatta: 'CMB',
  angoda: 'CMB',
  kelaniya: 'GPH',
  dehiwala: 'CMB',
  mountlavinia: 'CMB',
  moratuwa: 'CMB',
  kotte: 'CMB',
  battaramulla: 'CMB',
  nugegoda: 'CMB',
  maharagama: 'CMB',
  homagama: 'CMB',
  kaduwela: 'CMB',
  rajagiriya: 'CMB',
  borella: 'CMB',
  kollupitiya: 'CMB',
  bambalapitiya: 'CMB',
  wellawatte: 'CMB',
  fort: 'CMB',
  pettah: 'CMB',
  malabe: 'CMB',
  thalawathugoda: 'CMB',
  panadura: 'KLU',
  negombo: 'GPH',
  wattala: 'GPH',
  jaela: 'GPH',
  kadawatha: 'GPH',
  gampaha: 'GPH',
  peradeniya: 'KDY',
  katugastota: 'KDY',
  hikkaduwa: 'GLE',
  unawatuna: 'GLE',
};

export function getDestinationPortCode(destinationOrDistrict?: string): string {
  if (!destinationOrDistrict) return 'CMB';
  const clean = destinationOrDistrict.toLowerCase().trim();

  // Direct match
  if (DISTRICT_PORT_MAP[clean]) {
    return DISTRICT_PORT_MAP[clean];
  }

  // Check city mapping
  for (const [city, code] of Object.entries(CITY_PORT_MAP)) {
    if (clean.includes(city)) {
      return code;
    }
  }

  // Check substring in district map
  for (const [district, code] of Object.entries(DISTRICT_PORT_MAP)) {
    if (clean.includes(district)) {
      return code;
    }
  }

  // Fallback: 3 letters uppercase or CMB
  const words = clean.split(/[\s,]+/);
  if (words.length > 0 && words[0].length >= 3) {
    return words[0].substring(0, 3).toUpperCase();
  }

  return 'CMB';
}
