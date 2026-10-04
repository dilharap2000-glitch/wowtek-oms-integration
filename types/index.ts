export interface PlatformConfig {
  id: string;
  name: string;
  code: string;
  feePercent: number; // e.g. PickMe: 20%, Uber Eats: 15.4%, WooCommerce: 0%, POS In-store: 0%
  isCustom: boolean;
  active: boolean;
}

export interface PaymentGatewayConfig {
  id: string;
  name: string;
  code: string;
  feePercent: number; // e.g. COD/Cash: 0%, Payzy: 12%, Koko: 12%, Mintpay: 12%, Card/Online: 3%
  isCustom: boolean;
  active: boolean;
}

export interface OrderItem {
  sku: string;
  barcode: string;
  name: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  returned?: boolean;
  returnedQty?: number;
}

export type OrderStatus =
  | 'Pending'
  | 'Processing'
  | 'Completed'
  | 'Delivered'
  | 'Returned'
  | 'Partially Returned'
  | 'Cancelled';

export interface Order {
  id: string;
  invoiceNumber: string;
  channel: string; // e.g. 'woocommerce' | 'pickme' | 'ubereats' | 'pos'
  channelName: string;
  paymentGateway: string; // e.g. 'cash_cod' | 'payzy' | 'koko' | 'mintpay' | 'card_online'
  paymentGatewayName: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  city: string;
  items: OrderItem[];
  grossTotal: number;
  platformFeePercent: number;
  platformFeeAmount: number;
  gatewayFeePercent: number;
  gatewayFeeAmount: number;
  courierFee: number;
  costOfGoods: number;
  netProfit: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  waybillGenerated: boolean;
  waybillNumber?: string;
  notes?: string;
  isPosSale?: boolean;
  returnedAt?: string;
  returnReason?: string;
  smsConfirmationSent?: boolean;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  stockWarehouse: number;
  stockStore: number;
  stockReserved: number;
  grnBatch: string;
  supplier: string;
  warrantyPeriodMonths: number;
}

export interface TransExpressWaybill {
  id: string;
  orderId: string;
  trackingNumber: string;
  recipientName: string;
  recipientPhone: string;
  destination: string;
  district: string;
  codAmount: number;
  weightKg: number;
  status: 'Queued' | 'Manifested' | 'Dispatched' | 'Out for Delivery' | 'Delivered' | 'Returned';
  bookingDate: string;
  courierNotes: string;
  labelPrinted: boolean;
}

export interface WarrantyRecord {
  id: string;
  serialNumber: string;
  productSku: string;
  productName: string;
  customerName: string;
  customerPhone: string;
  customerWarrantyStart: string;
  customerWarrantyMonths: number;
  customerWarrantyEnd: string;
  supplierName: string;
  supplierWarrantyEnd: string;
  smsStatus: 'Sent' | 'Scheduled' | 'Failed';
  smsGateway: 'SMSlenz' | 'Dialog' | 'Mobitel';
  lastSmsDate?: string;
  status: 'Active' | 'Expiring Soon' | 'Expired' | 'Claim In Progress';
}

export type ExpenseCategory =
  | 'Stock Purchases'
  | 'Operational'
  | 'Logistics'
  | 'Platform Fees'
  | 'Staff & Utility';

export interface ExpenseItem {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string;
  channel: string;
  reference: string;
}

export interface ApiIntegrationConfig {
  woocommerceUrl: string;
  woocommerceConsumerKey: string;
  woocommerceConsumerSecret: string;
  woocommerceWebhookSecret: string;
  pickmeMerchantId: string;
  pickmeApiKey: string;
  pickmeBranchId: string;
  uberEatsStoreId: string;
  uberEatsClientSecret: string;
  transExpressAccountId: string;
  transExpressApiKey: string;
  transExpressPickupBranch: string;
  smsGatewayProvider: 'SMSlenz' | 'Dialog' | 'Mobitel';
  smsUserId: string; // e.g. '588' for SMSlenz
  smsApiKey: string;
  smsSenderId: string; // Sender Mask, e.g. 'WOWTEK'
  smsAutoNotifyWarranty: boolean;
  smsAutoNotifyOrder: boolean;
  smsExpiryReminderDays: number;
}

export interface SmsSendRequest {
  user_id?: string;
  api_key?: string;
  sender_id?: string;
  contact: string;
  message: string;
  triggerType?: 'warranty_registered' | 'warranty_expiry' | 'order_confirmed' | 'test';
  referenceId?: string;
}

export interface SmsSendResponse {
  success: boolean;
  message: string;
  provider: string;
  messageId?: string;
  recipient: string;
  timestamp: string;
  rawResponse?: any;
}

export interface DatabaseHealthStatus {
  status: 'connected' | 'fallback';
  latencyMs: number;
  database: string;
  message: string;
  timestamp: string;
  recordCounts: {
    orders: number;
    products: number;
    waybills: number;
    warranties: number;
    expenses: number;
  };
}
