/**
 * Profit Calculator Utility for WOWTEK OMS
 *
 * Implements standard Sri Lankan e-commerce fee deduction & net profit formulas:
 * 1. Base Values: unitPrice, costPrice
 * 2. Gateway Commission:
 *    - Payzy BNPL, Koko, Mintpay => 12% (0.12)
 *    - Card / Online => 3% (0.03)
 *    - Cash on Delivery (COD) / Cash => 0% (0.00)
 *    - Custom configured percentage if provided
 * 3. Courier Shipping Cost: order.shippingCost || 350
 * 4. Net Profit = unitPrice - costPrice - gatewayFeeAmount - courierShippingCost (per item or aggregated across order)
 */

export interface ProfitCalculationParams {
  unitPrice: number;
  costPrice: number;
  paymentGateway?: string;
  gatewayFeePercentage?: number;
  courierShippingCost?: number;
  quantity?: number;
}

export interface ProfitCalculationResult {
  unitPrice: number;
  costPrice: number;
  quantity: number;
  gatewayFeePercentage: number;
  gatewayFeeAmount: number;
  courierShippingCost: number;
  grossRevenue: number;
  totalCostOfGoods: number;
  netProfit: number;
  profitMarginPercent: number;
}

/**
 * Determines gateway fee percentage (as decimal, e.g. 0.12 for 12%)
 */
export function getGatewayFeePercentage(
  paymentGateway?: string,
  explicitPercentage?: number
): number {
  if (typeof explicitPercentage === 'number' && !isNaN(explicitPercentage)) {
    return explicitPercentage > 1 ? explicitPercentage / 100 : explicitPercentage;
  }

  if (!paymentGateway) return 0;

  const normalized = paymentGateway.trim().toLowerCase();

  // 12% BNPL / Split payment gateways
  if (
    normalized.includes('payzy') ||
    normalized.includes('koko') ||
    normalized.includes('mintpay') ||
    paymentGateway === 'Payzy BNPL' ||
    paymentGateway === 'Koko' ||
    paymentGateway === 'Mintpay'
  ) {
    return 0.12; // 12% commission
  }

  // 3% standard credit/debit card gateway
  if (
    normalized.includes('card') ||
    normalized.includes('online') ||
    normalized.includes('stripe') ||
    normalized.includes('webxpay') ||
    normalized.includes('payhere')
  ) {
    return 0.03; // 3%
  }

  // Cash / COD => 0%
  if (normalized.includes('cash') || normalized.includes('cod')) {
    return 0.0;
  }

  return 0.0;
}

/**
 * Calculates net profit for a single item sale according to the exact user formula:
 * 1. Base values (unitPrice, costPrice)
 * 2. Gateway fee = unitPrice * gatewayFeePercentage
 * 3. Courier shipping cost (default 350)
 * 4. Net Profit = unitPrice - costPrice - gatewayFeeAmount - courierShippingCost
 */
export function calculateItemNetProfit({
  unitPrice,
  costPrice,
  paymentGateway,
  gatewayFeePercentage,
  courierShippingCost = 350,
  quantity = 1,
}: ProfitCalculationParams): ProfitCalculationResult {
  const safeUnitPrice = Number(unitPrice) || 0;
  const safeCostPrice = Number(costPrice) || 0;
  const safeQty = Math.max(1, Number(quantity) || 1);

  const feePct =
    typeof gatewayFeePercentage === 'number'
      ? gatewayFeePercentage > 1
        ? gatewayFeePercentage / 100
        : gatewayFeePercentage
      : getGatewayFeePercentage(paymentGateway);

  const unitGatewayFeeAmount = safeUnitPrice * feePct;
  const totalGatewayFeeAmount = Math.round(unitGatewayFeeAmount * safeQty);

  const safeCourierShippingCost = Number(courierShippingCost) || 350;

  const grossRevenue = safeUnitPrice * safeQty;
  const totalCostOfGoods = safeCostPrice * safeQty;

  // Single-item net profit per formula: unitPrice - costPrice - gatewayFeeAmount - courierShippingCost
  // For multiple quantities, revenue - cogs - totalGatewayFee - courierShippingCost
  const netProfit = Math.round(grossRevenue - totalCostOfGoods - totalGatewayFeeAmount - safeCourierShippingCost);

  const profitMarginPercent =
    grossRevenue > 0 ? Number(((netProfit / grossRevenue) * 100).toFixed(1)) : 0;

  return {
    unitPrice: safeUnitPrice,
    costPrice: safeCostPrice,
    quantity: safeQty,
    gatewayFeePercentage: feePct,
    gatewayFeeAmount: totalGatewayFeeAmount,
    courierShippingCost: safeCourierShippingCost,
    grossRevenue,
    totalCostOfGoods,
    netProfit,
    profitMarginPercent,
  };
}

/**
 * Calculates total order net profit across all line items
 */
export function calculateOrderNetProfit({
  grossTotal,
  costOfGoods,
  paymentGateway,
  gatewayFeePercent,
  shippingCost,
  platformFeeAmount = 0,
}: {
  grossTotal: number;
  costOfGoods: number;
  paymentGateway?: string;
  gatewayFeePercent?: number;
  shippingCost?: number;
  platformFeeAmount?: number;
}): {
  gatewayFeePercentage: number;
  gatewayFeeAmount: number;
  courierShippingCost: number;
  netProfit: number;
  profitMarginPercent: number;
} {
  const safeGross = Number(grossTotal) || 0;
  const safeCogs = Number(costOfGoods) || 0;

  const feePct =
    typeof gatewayFeePercent === 'number'
      ? gatewayFeePercent > 1
        ? gatewayFeePercent / 100
        : gatewayFeePercent
      : getGatewayFeePercentage(paymentGateway);

  const gatewayFeeAmount = Math.round(safeGross * feePct);
  const courierShippingCost = typeof shippingCost === 'number' ? shippingCost : 350;
  const safePlatformFee = Number(platformFeeAmount) || 0;

  const netProfit = Math.round(safeGross - safeCogs - gatewayFeeAmount - safePlatformFee - courierShippingCost);
  const profitMarginPercent =
    safeGross > 0 ? Number(((netProfit / safeGross) * 100).toFixed(1)) : 0;

  return {
    gatewayFeePercentage: feePct,
    gatewayFeeAmount,
    courierShippingCost,
    netProfit,
    profitMarginPercent,
  };
}

/**
 * Customer-Surcharged Pricing Model:
 * Implements the explicit Sri Lankan POS / Online Checkout formula:
 * 1. Base Item Price: baseItemPrice (cart subtotal)
 * 2. Cost Price: costPrice (total COGS)
 * 3. Platform / Gateway Fee Percentage:
 *    - Payzy BNPL, Koko, Mintpay => 12% (0.12)
 *    - Card => 3% (0.03)
 * 4. Customer Fee Surcharge Added to Total (Add to Total):
 *    paymentFeeAmount = baseItemPrice * feePercentage
 *    finalGrossTotal = baseItemPrice + paymentFeeAmount + courierShippingCost
 * 5. Net Estimated Profit:
 *    // Customer pays the extra fee which is passed to the gateway,
 *    // so Net Profit remains: baseItemPrice - costPrice
 *    netEstimatedProfit = baseItemPrice - costPrice
 */
export function calculateCustomerSurchargedPricing({
  baseItemPrice,
  costPrice,
  selectedGateway,
  courierShippingCost = 0,
  platformFeeAmount = 0,
}: {
  baseItemPrice: number;
  costPrice: number;
  selectedGateway?: string;
  courierShippingCost?: number;
  platformFeeAmount?: number;
}): {
  baseItemPrice: number;
  costPrice: number;
  feePercentage: number;
  paymentFeeAmount: number;
  finalGrossTotal: number;
  netEstimatedProfit: number;
  profitMarginPercent: number;
} {
  const safeBase = Number(baseItemPrice) || 0;
  const safeCost = Number(costPrice) || 0;
  const safeCourier = Number(courierShippingCost) || 0;
  const safePlatformFee = Number(platformFeeAmount) || 0;

  // Gateway fee percentage determination
  let feePercentage = 0;
  const gw = (selectedGateway || '').trim();
  const gwLower = gw.toLowerCase();

  if (
    gw === 'Payzy BNPL' ||
    gw === 'Koko' ||
    gw === 'Mintpay' ||
    gwLower.includes('payzy') ||
    gwLower.includes('koko') ||
    gwLower.includes('mintpay')
  ) {
    feePercentage = 0.12; // 12% BNPL
  } else if (
    gw === 'Card' ||
    gwLower.includes('card') ||
    gwLower === 'card_online'
  ) {
    feePercentage = 0.03; // 3% Card
  } else {
    feePercentage = getGatewayFeePercentage(selectedGateway);
  }

  // Customer fee surcharge added to item price
  const paymentFeeAmount = Math.round(safeBase * feePercentage);
  const finalGrossTotal = safeBase + paymentFeeAmount + safeCourier;

  // Merchant Net Profit: Base Selling Price - COGS - platformFee - merchantCourierCost
  // Surcharge is paid by customer and remitted to gateway, so profit is NOT reduced by payment fee!
  const netEstimatedProfit = Math.round(safeBase - safeCost - safePlatformFee);
  const profitMarginPercent =
    safeBase > 0 ? Number(((netEstimatedProfit / safeBase) * 100).toFixed(1)) : 0;

  return {
    baseItemPrice: safeBase,
    costPrice: safeCost,
    feePercentage,
    paymentFeeAmount,
    finalGrossTotal,
    netEstimatedProfit,
    profitMarginPercent,
  };
}
