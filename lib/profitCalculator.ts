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
