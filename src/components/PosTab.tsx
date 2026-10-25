'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart,
  Camera,
  Barcode,
  Scan,
  Plus,
  Minus,
  Trash2,
  Printer,
  RotateCcw,
  Edit,
  Search,
  CheckCircle2,
  X,
  CreditCard,
  Tag,
  DollarSign,
  TrendingUp,
  FileText,
  Package,
  Truck,
  AlertTriangle,
  Percent,
  Clock,
  Users,
  Calendar,
  Send,
  UserCheck,
} from 'lucide-react';
import {
  Order,
  OrderItem,
  Product,
  PlatformConfig,
  PaymentGatewayConfig,
} from '@/types';
import { formatSriLankanPhone, handleLivePhoneInput, isValidSriLankanPhone } from '@/lib/phoneUtils';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { A4WarrantyInvoiceModal } from './A4WarrantyInvoiceModal';
import { ThermalWaybillModal } from './ThermalWaybillModal';
import { CreditCustomersTab } from './CreditCustomersTab';

interface PosTabProps {
  products: Product[];
  orders: Order[];
  platforms: PlatformConfig[];
  gateways: PaymentGatewayConfig[];
  onCreateOrder: (order: Order) => void;
  onUpdateOrder: (id: string, updates: Partial<Order>) => void;
  onDeleteOrder: (id: string) => void;
  onProcessReturn: (orderId: string, itemSkus?: string[], reason?: string) => void;
  onAddProduct?: (product: Product) => void;
  onLoadSampleProducts?: () => void;
}

export const PosTab: React.FC<PosTabProps> = ({
  products,
  orders,
  platforms,
  gateways,
  onCreateOrder,
  onUpdateOrder,
  onDeleteOrder,
  onProcessReturn,
  onAddProduct,
  onLoadSampleProducts,
}) => {
  // POS Cart State
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [selectedPlatformCode, setSelectedPlatformCode] = useState<string>('pos');
  const [selectedGatewayCode, setSelectedGatewayCode] = useState<string>('cash_cod');
  
  // 1. Customer Details: default to "Cash Customer" and empty phone (clean input, no forced +94 77)
  const [customerName, setCustomerName] = useState('Cash Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCity, setCustomerCity] = useState('Colombo 04');
  const [customerAddress, setCustomerAddress] = useState('Walk-in / In-Store Checkout');
  const [courierFee, setCourierFee] = useState<number>(0);
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

  // 2. Barcode & Serial Scanner State
  const [activeScanInput, setActiveScanInput] = useState('');
  const [scanStatus, setScanStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const scannerInputRef = React.useRef<HTMLInputElement | null>(null);

  // 3. Price & Discount Customization State
  const [editingPriceSku, setEditingPriceSku] = useState<string | null>(null);
  const [tempPriceInput, setTempPriceInput] = useState<string>('');
  const [discountingSku, setDiscountingSku] = useState<string | null>(null);
  const [tempDiscountType, setTempDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [tempDiscountVal, setTempDiscountVal] = useState<string>('');
  const [billDiscountType, setBillDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [billDiscountValue, setBillDiscountValue] = useState<number>(0);

  // 4. Credit Customer State, Partial Payment & Settlement
  const [isCreditSale, setIsCreditSale] = useState<boolean>(false);
  const [advancePaidAmount, setAdvancePaidAmount] = useState<number>(0);
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<string>('Cash');
  const [creditDueDate, setCreditDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [creditNotes, setCreditNotes] = useState<string>('');
  const [creditToast, setCreditToast] = useState<string | null>(null);

  // Modals & General state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Order | null>(null);
  const [selectedOrderForThermalPrint, setSelectedOrderForThermalPrint] = useState<Order | null>(null);
  const [returnModalOrder, setReturnModalOrder] = useState<Order | null>(null);
  const [returnReason, setReturnReason] = useState('Customer Return & Restock');
  const [editModalOrder, setEditModalOrder] = useState<Order | null>(null);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'terminal' | 'invoices' | 'credit'>('terminal');

  // Count active credit orders with remaining balances
  const creditUnsettledCount = React.useMemo(() => {
    return (orders || []).filter((o) => {
      const isCredit =
        o.isCreditSale ||
        o.paymentGateway === 'credit' ||
        (o.balanceDue !== undefined && o.balanceDue > 0);
      const gross = Number(o.grossTotal || 0);
      const paid = Number(o.advancePaid || 0);
      const bal = o.balanceDue !== undefined ? Number(o.balanceDue) : Math.max(0, gross - paid);
      return isCredit && bal > 0;
    }).length;
  }, [orders]);

  // Load Customers for search & autocomplete
  const fetchCustomerDirectory = useCallback(async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      if (data.success && Array.isArray(data.customers)) {
        setCustomerList(data.customers);
      }
    } catch (err) {
      console.warn('Customer list fetch notice:', err);
    }
  }, []);

  useEffect(() => {
    fetchCustomerDirectory();
  }, [fetchCustomerDirectory]);

  // Ensure Credit Customer is always present in gateway list
  const allGateways = React.useMemo(() => {
    const list = [...(gateways || [])];
    if (!list.some((g) => g.code === 'credit')) {
      list.push({
        id: 'gw-credit',
        name: 'Credit Customer (Pay Later)',
        code: 'credit',
        feePercent: 0,
        isCustom: false,
        active: true,
      });
    }
    return list;
  }, [gateways]);

  // Active configurations
  const activePlatform = platforms.find((p) => p.code === selectedPlatformCode) || platforms[0] || {
    id: 'p1',
    name: 'POS In-store',
    code: 'pos',
    feePercent: 0,
    isCustom: false,
    active: true,
  };

  const activeGateway = allGateways.find((g) => g.code === selectedGatewayCode) || allGateways[0] || {
    id: 'g1',
    name: 'Cash / COD',
    code: 'cash_cod',
    feePercent: 0,
    isCustom: false,
    active: true,
  };

  // -------------------------------------------------------------
  // CART CALCULATIONS (Item Discounts, Bill Discounts, Surcharges)
  // -------------------------------------------------------------
  const safeCart = cart || [];

  // 1. Calculate per-item lines with custom price & item-level discounts
  const itemCalculations = safeCart.map((item) => {
    const unitPrice = item.unitPrice || 0;
    const qty = item.quantity || 1;
    let itemDiscountAmount = 0;

    if (item.discountType === 'percent' && item.discountPercent && item.discountPercent > 0) {
      itemDiscountAmount = Math.round((unitPrice * item.discountPercent) / 100);
    } else if (item.discountAmount && item.discountAmount > 0) {
      itemDiscountAmount = item.discountAmount;
    }

    const effectiveUnitPrice = Math.max(0, unitPrice - itemDiscountAmount);
    return {
      ...item,
      itemDiscountAmount,
      effectiveUnitPrice,
      lineTotal: effectiveUnitPrice * qty,
      cogsTotal: (item.costPrice || 0) * qty,
      totalItemDiscount: itemDiscountAmount * qty,
    };
  });

  const grossItemSubtotal = itemCalculations.reduce((sum, it) => sum + it.lineTotal, 0);
  const totalItemDiscounts = itemCalculations.reduce((sum, it) => sum + it.totalItemDiscount, 0);
  const totalCostOfGoods = itemCalculations.reduce((sum, it) => sum + it.cogsTotal, 0);

  // 2. Bill-level discount calculation
  let billDiscountAmount = 0;
  if (billDiscountValue > 0) {
    if (billDiscountType === 'percent') {
      billDiscountAmount = Math.round((grossItemSubtotal * billDiscountValue) / 100);
    } else {
      billDiscountAmount = Math.min(grossItemSubtotal, billDiscountValue);
    }
  }

  // Base Item Price after all item & bill discounts
  const baseItemPrice = Math.max(0, grossItemSubtotal - billDiscountAmount);
  const totalDiscount = totalItemDiscounts + billDiscountAmount;

  // 3. Gateway Fee Percentage determination (Credit Sales have 0% Surcharge)
  const isCreditActive =
    selectedGatewayCode === 'credit' ||
    isCreditSale ||
    (advancePaidAmount > 0 && advancePaidAmount < (baseItemPrice + (courierFee || 0)));
  let gatewayFeePercentage = 0;
  const gwName = activeGateway?.name || '';
  const gwCode = (activeGateway?.code || selectedGatewayCode || '').toLowerCase();

  if (!isCreditActive) {
    if (
      gwName === 'Payzy BNPL' ||
      gwName === 'Koko' ||
      gwName === 'Mintpay' ||
      gwName.toLowerCase().includes('payzy') ||
      gwName.toLowerCase().includes('koko') ||
      gwName.toLowerCase().includes('mintpay') ||
      ['payzy', 'koko', 'mintpay'].includes(gwCode)
    ) {
      gatewayFeePercentage = 0.12; // 12% BNPL
    } else if (
      gwName === 'Card' ||
      gwName.toLowerCase().includes('card') ||
      ['card', 'card_online'].includes(gwCode)
    ) {
      gatewayFeePercentage = 0.03; // 3% Card
    } else if (typeof activeGateway?.feePercent === 'number') {
      gatewayFeePercentage = activeGateway.feePercent > 1 ? activeGateway.feePercent / 100 : activeGateway.feePercent;
    }
  }

  // 4. Customer Fee Surcharge Added to Item Price (Add to Total)
  const paymentFeeAmount = isCreditActive ? 0 : Math.round(baseItemPrice * gatewayFeePercentage);
  const finalGrossTotal = baseItemPrice + paymentFeeAmount + (courierFee || 0);
  const creditBalanceDue = isCreditActive
    ? Math.max(0, finalGrossTotal - advancePaidAmount)
    : 0;
  const platformFeeAmount = Math.round((baseItemPrice * activePlatform.feePercent) / 100);

  const hasUnregisteredInCart = safeCart.some((item) => {
    const prod = products.find(
      (p) =>
        p.sku.toLowerCase() === item.sku.toLowerCase() ||
        (item.barcode && p.barcode && p.barcode.toLowerCase() === item.barcode.toLowerCase()) ||
        p.name.toLowerCase() === item.name.toLowerCase()
    );
    return !prod || !prod.costPrice || prod.costPrice <= 0 || !item.costPrice || item.costPrice <= 0;
  });

  // 5. Net Profit: Merchant keeps Discounted Base Price - COGS - Platform Fee
  const netProfit = hasUnregisteredInCart
    ? 0
    : Math.round(baseItemPrice - totalCostOfGoods - platformFeeAmount);

  // Add product to cart by barcode, SKU, or serial number
  const handleAddProductToCart = (prod: Product, serialNumber?: string) => {
    // If not explicitly provided, allocate available serial from activeSerials or serialNumbers if present
    const allocatedSerial =
      serialNumber ||
      (Array.isArray((prod as any).activeSerials)
        ? (prod as any).activeSerials.find((s: any) =>
            typeof s === 'object' ? s.status === 'Available' || !s.status : Boolean(s)
          )?.serialNumber ||
          (typeof (prod as any).activeSerials[0] === 'string'
            ? (prod as any).activeSerials[0]
            : (prod as any).activeSerials[0]?.serialNumber)
        : undefined) ||
      (Array.isArray(prod.serialNumbers) && prod.serialNumbers.length > 0 ? prod.serialNumbers[0] : undefined);

    setCart((prev) => {
      const existing = prev.find((item) => item.sku === prod.sku);
      if (existing) {
        return prev.map((item) =>
          item.sku === prod.sku
            ? {
                ...item,
                quantity: item.quantity + 1,
                serialNumber: allocatedSerial || item.serialNumber,
              }
            : item
        );
      }
      return [
        ...prev,
        {
          sku: prod.sku,
          barcode: prod.barcode,
          name: prod.name,
          quantity: 1,
          unitPrice: prod.sellingPrice,
          costPrice: prod.costPrice,
          originalPrice: prod.sellingPrice,
          serialNumber: allocatedSerial,
        },
      ];
    });
  };

  // Active Barcode & Serial Scanner Handler (Instant Add & Focus Retention)
  const handleScanSubmit = (codeToScan: string) => {
    const clean = codeToScan.trim();
    if (!clean) return;

    let matchedProduct: Product | undefined = undefined;
    let matchedSerial: string | undefined = undefined;

    for (const p of products) {
      // 1. Direct Barcode check
      if (p.barcode && p.barcode.trim().toLowerCase() === clean.toLowerCase()) {
        matchedProduct = p;
        break;
      }
      // 2. SKU / SKU Code check
      if (
        (p.sku && p.sku.trim().toLowerCase() === clean.toLowerCase()) ||
        (p.skuCode && p.skuCode.trim().toLowerCase() === clean.toLowerCase())
      ) {
        matchedProduct = p;
        break;
      }
      // 3. Serial number in activeSerials (both object and string shapes)
      const serials = (p as any).activeSerials;
      if (Array.isArray(serials)) {
        const found = serials.find((s: any) => {
          const sn = typeof s === 'string' ? s : s?.serialNumber;
          return sn && sn.trim().toLowerCase() === clean.toLowerCase();
        });
        if (found) {
          matchedProduct = p;
          matchedSerial = typeof found === 'string' ? found : found.serialNumber;
          break;
        }
      }
      // 4. Serial number in serialNumbers array
      if (Array.isArray(p.serialNumbers)) {
        const found = p.serialNumbers.find((s: string) => s && s.trim().toLowerCase() === clean.toLowerCase());
        if (found) {
          matchedProduct = p;
          matchedSerial = found;
          break;
        }
      }
    }

    if (matchedProduct) {
      handleAddProductToCart(matchedProduct, matchedSerial || clean);
      setScanStatus({
        type: 'success',
        message: `Scanned & Added: ${matchedProduct.name} (Rs. ${matchedProduct.sellingPrice.toLocaleString()})${
          matchedSerial ? ` [Allocated S/N: ${matchedSerial}]` : ''
        }`,
      });
      setActiveScanInput('');
    } else {
      setScanStatus({
        type: 'error',
        message: `No inventory product or serial found for "${clean}". You can search catalog or add as custom item.`,
      });
    }

    setTimeout(() => {
      scannerInputRef.current?.focus();
    }, 50);
  };

  // Scanned Barcode Handler from Camera Modal
  const handleBarcodeScanned = (barcode: string) => {
    const clean = barcode.trim();
    handleScanSubmit(clean);
    return true;
  };

  // Item Price Edit Handler
  const handleUpdateItemPrice = (sku: string, newPrice: number) => {
    const cleanPrice = Math.max(0, Number(newPrice) || 0);
    setCart((prev) =>
      prev.map((item) => {
        if (item.sku === sku) {
          return {
            ...item,
            originalPrice: item.originalPrice || item.unitPrice,
            unitPrice: cleanPrice,
          };
        }
        return item;
      })
    );
    setEditingPriceSku(null);
  };

  // Item Discount Handler (% or fixed Rs.)
  const handleUpdateItemDiscount = (sku: string, type: 'percent' | 'fixed', val: number) => {
    const cleanVal = Math.max(0, Number(val) || 0);
    setCart((prev) =>
      prev.map((item) => {
        if (item.sku === sku) {
          if (type === 'percent') {
            const cappedPercent = Math.min(100, cleanVal);
            return {
              ...item,
              discountType: 'percent',
              discountPercent: cappedPercent,
              discountAmount: Math.round(((item.unitPrice || 0) * cappedPercent) / 100),
            };
          } else {
            const cappedAmount = Math.min(item.unitPrice || 0, cleanVal);
            return {
              ...item,
              discountType: 'fixed',
              discountAmount: cappedAmount,
              discountPercent: item.unitPrice > 0 ? Math.round((cappedAmount / item.unitPrice) * 100) : 0,
            };
          }
        }
        return item;
      })
    );
    setDiscountingSku(null);
  };

  // Add custom uncataloged item directly to cart on the fly
  const handleAddCustomItem = (item: {
    sku: string;
    barcode: string;
    name: string;
    sellingPrice: number;
    costPrice?: number;
    saveToInventory?: boolean;
  }) => {
    setCart((prev) => {
      const existing = prev.find(
        (i) => i.sku === item.sku || (item.barcode && i.barcode === item.barcode)
      );
      if (existing) {
        return prev.map((i) =>
          i.sku === item.sku ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          sku: item.sku,
          barcode: item.barcode,
          name: item.name,
          quantity: 1,
          unitPrice: item.sellingPrice,
          originalPrice: item.sellingPrice,
          costPrice: typeof item.costPrice === 'number' && item.costPrice > 0 ? item.costPrice : 0,
        },
      ];
    });

    if (item.saveToInventory && onAddProduct) {
      const newProd: Product = {
        id: `prod-${Date.now().toString().slice(-4)}`,
        sku: item.sku,
        barcode: item.barcode,
        name: item.name,
        category: 'Scanned Items',
        costPrice: typeof item.costPrice === 'number' && item.costPrice > 0 ? item.costPrice : 0,
        sellingPrice: item.sellingPrice,
        stockWarehouse: 10,
        stockStore: 5,
        stockReserved: 1,
        grnBatch: `GRN-${new Date().getFullYear()}-POS`,
        supplier: 'Direct Scanner Entry',
        warrantyPeriodMonths: 12,
      };
      onAddProduct(newProd);
    }
  };

  const handleUpdateQuantity = (sku: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.sku === sku) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as OrderItem[]
    );
  };

  const handleRemoveFromCart = (sku: string) => {
    setCart((prev) => prev.filter((item) => item.sku !== sku));
  };

  // Complete POS Checkout with Credit Support & Automated SMS
  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      alert('Cart is empty. Please scan or select products.');
      return;
    }

    const isCredit =
      selectedGatewayCode === 'credit' ||
      isCreditSale ||
      (advancePaidAmount > 0 && advancePaidAmount < finalGrossTotal);
    const balanceDue = isCredit ? Math.max(0, finalGrossTotal - advancePaidAmount) : 0;
    const isFullySettled = !isCredit || balanceDue === 0;

    // Validation: For Credit Customers with outstanding balance, customer phone is mandatory for SMS reminder & receivable tracking!
    if (isCredit && balanceDue > 0 && (!customerPhone || customerPhone.trim().length < 9)) {
      alert('Customer mobile phone number is required for Credit / Partial Payment sales so that invoice details and the due date SMS reminder can be dispatched!');
      return;
    }

    const invoiceNum = `INV-${activePlatform.code.toUpperCase().slice(0, 3)}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    const cleanPhone = customerPhone ? formatSriLankanPhone(customerPhone) : '';
    const finalCustomerName = customerName.trim() || 'Cash Customer';

    const hasUnregistered = safeCart.some((item) => {
      const prod = products.find(
        (p) =>
          p.sku.toLowerCase() === item.sku.toLowerCase() ||
          (item.barcode && p.barcode && p.barcode.toLowerCase() === item.barcode.toLowerCase()) ||
          p.name.toLowerCase() === item.name.toLowerCase()
      );
      return !prod || !prod.costPrice || prod.costPrice <= 0 || !item.costPrice || item.costPrice <= 0;
    });

    const orderId = `ord-${Date.now().toString().slice(-4)}`;

    const initialPaymentHistory = advancePaidAmount > 0 ? [
      {
        id: `pay-${Date.now()}`,
        orderId,
        invoiceNumber: invoiceNum,
        amount: advancePaidAmount,
        paymentMethod: advancePaymentMethod || 'Cash',
        date: new Date().toISOString(),
        notes: 'Initial advance paid at checkout',
        receiptNumber: `RCP-${Date.now().toString().slice(-6)}`,
        recordedBy: 'POS Cashier',
      }
    ] : [];

    const newOrder: Order = {
      id: orderId,
      invoiceNumber: invoiceNum,
      channel: activePlatform.code,
      channelName: activePlatform.name,
      paymentGateway: isCredit ? 'credit' : activeGateway.code,
      paymentGatewayName: isCredit
        ? advancePaidAmount > 0
          ? `Split / Credit (Rs. ${advancePaidAmount.toLocaleString()} Advance)`
          : 'Credit Customer (Pay Later)'
        : activeGateway.name,
      customerName: finalCustomerName,
      customerPhone: cleanPhone,
      deliveryAddress: customerAddress || 'Walk-in / In-Store Checkout',
      city: customerCity || 'Colombo 04',
      items: [...cart],
      baseSubtotal: baseItemPrice,
      grossTotal: finalGrossTotal,
      platformFeePercent: activePlatform.feePercent,
      platformFeeAmount,
      gatewayFeePercent: isCredit ? 0 : Math.round(gatewayFeePercentage * 100),
      gatewayFeeAmount: isCredit ? 0 : paymentFeeAmount,
      courierFee,
      costOfGoods: totalCostOfGoods,
      netProfit: hasUnregistered ? 0 : netProfit,
      profitStatus: hasUnregistered ? 'Pending / Inventory Not Found' : 'Calculated',
      hasUnregisteredItems: hasUnregistered,
      unregisteredItemsCount: hasUnregistered ? safeCart.filter((item) => !products.some((p) => p.sku === item.sku && p.costPrice > 0)).length : 0,
      status: 'Completed',
      feeSurchargeAdded: !isCredit && paymentFeeAmount > 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      waybillGenerated: false,
      isPosSale: true,
      isCreditSale: isCredit,
      creditDueDate: isCredit ? creditDueDate : undefined,
      creditSettled: isFullySettled,
      creditSettledAt: isFullySettled && isCredit ? new Date().toISOString() : undefined,
      advancePaid: isCredit ? advancePaidAmount : finalGrossTotal,
      balanceDue: balanceDue,
      advancePaymentMethod: isCredit && advancePaidAmount > 0 ? advancePaymentMethod : activeGateway.name,
      creditNotes: creditNotes || undefined,
      creditPaymentHistory: initialPaymentHistory,
      billDiscountAmount: billDiscountAmount > 0 ? billDiscountAmount : undefined,
      billDiscountPercent: billDiscountType === 'percent' && billDiscountValue > 0 ? billDiscountValue : undefined,
      billDiscountType: billDiscountType,
      totalDiscount: totalDiscount > 0 ? totalDiscount : undefined,
      notes: `${isCredit ? `[CREDIT SALE - Advance: Rs. ${advancePaidAmount.toLocaleString()}, Due: Rs. ${balanceDue.toLocaleString()} by ${creditDueDate}] ` : ''}POS sale processed via ${isCredit ? 'Credit Customer' : activeGateway.name}${totalDiscount > 0 ? ` (Discount: -Rs. ${totalDiscount.toLocaleString()})` : ''}.${creditNotes ? ` Note: ${creditNotes}` : ''}`.trim(),
    };

    onCreateOrder(newOrder);

    // Auto-dispatch SMS notification via SMSlenz
    if (cleanPhone && cleanPhone.length >= 9) {
      try {
        let smsText = '';
        if (isCredit && balanceDue > 0) {
          const formattedDueDate = new Date(creditDueDate).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
          if (advancePaidAmount > 0) {
            smsText = `WOWTEK: Dear ${finalCustomerName}, Invoice ${invoiceNum} approved. Total: Rs. ${finalGrossTotal.toLocaleString()}. Advance Paid: Rs. ${advancePaidAmount.toLocaleString()} (${advancePaymentMethod}). Credit Balance Due: Rs. ${balanceDue.toLocaleString()}. Payment Due Date: ${formattedDueDate}. Helpline: 0779673004.`;
          } else {
            smsText = `WOWTEK: Dear ${finalCustomerName}, your Credit Invoice ${invoiceNum} for Rs. ${finalGrossTotal.toLocaleString()} has been approved. Payment Due Date: ${formattedDueDate}. Please settle payment on or before this date. Helpline: 0779673004.`;
          }
        } else {
          smsText = `WOWTEK: Invoice ${invoiceNum} confirmed. Total: Rs. ${finalGrossTotal.toLocaleString()}. Payment: ${activeGateway.name}. Thank you for your purchase! Helpline: 0779673004.`;
        }

        fetch('/api/sms/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact: cleanPhone,
            message: smsText,
            triggerType: isCredit ? 'credit_invoice' : 'order_confirmed',
            referenceId: invoiceNum,
          }),
        }).catch((err) => console.warn('POS SMS notice:', err));
      } catch {
        // Safe fallback
      }

      // Auto-upsert into customer database with uniform formatting
      try {
        fetch('/api/customers/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: finalCustomerName,
            phone: cleanPhone,
            source: isCredit ? 'Credit Customer' : 'POS Cash Customer',
          }),
        }).catch(() => {});
      } catch {
        // Safe fallback
      }
    }

    if (isCredit && balanceDue > 0) {
      const formattedDueDate = new Date(creditDueDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      setCreditToast(
        `Credit Sale ${invoiceNum} completed! Advance: Rs. ${advancePaidAmount.toLocaleString()} | Balance Due: Rs. ${balanceDue.toLocaleString()} (Due: ${formattedDueDate}). SMS dispatched.`
      );
      setTimeout(() => setCreditToast(null), 7000);
    }

    setSelectedInvoiceForPrint(newOrder);
    setCart([]);
    setCustomerName('Cash Customer');
    setCustomerPhone('');
    setBillDiscountValue(0);
    setIsCreditSale(false);
    setAdvancePaidAmount(0);
    setAdvancePaymentMethod('Cash');
    setCreditNotes('');
  };

  const [isProcessingReturn, setIsProcessingReturn] = useState(false);

  // Return order handler - sends orderId to /api/orders/return
  const handleReturnOrder = useCallback(
    async (orderId: string, reason?: string) => {
      if (!orderId) {
        alert("Error: Order ID is missing!");
        return;
      }
      setIsProcessingReturn(true);
      try {
        const res = await fetch('/api/orders/return', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: orderId, reason: reason || returnReason }), // Order ID එක හරියට pass වෙනවාද බලන්න
        });
        const data = await res.json();
        if (data.success) {
          alert("Return successful and stock updated!");
          window.location.reload();
        } else {
          alert("Error: " + (data.message || data.error || 'Failed to process return'));
        }
      } catch (err: any) {
        alert("Error: " + (err.message || 'Network error processing return'));
      } finally {
        setIsProcessingReturn(false);
      }
    },
    [returnReason]
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).handleReturnOrder = handleReturnOrder;
    }
  }, [handleReturnOrder]);

  // Confirm Return & Stock Restoration
  const handleConfirmReturn = async () => {
    if (!returnModalOrder) return;
    const orderIdToPass =
      (returnModalOrder as any)._id ||
      returnModalOrder.id ||
      returnModalOrder.invoiceNumber;
    await handleReturnOrder(String(orderIdToPass), returnReason);
    setReturnModalOrder(null);
  };

  // Filter products for catalog search (Supports Name, SKU, Barcode, Replacement S/Ns, and Active Serials)
  const filteredProducts = products.filter((p) => {
    const q = (productSearch || '').trim().toLowerCase();
    if (!q) return true;
    if (p.name && p.name.toLowerCase().includes(q)) return true;
    if (p.sku && p.sku.toLowerCase().includes(q)) return true;
    if (p.barcode && p.barcode.toLowerCase().includes(q)) return true;

    // Check active serial numbers (e.g. from Supplier RMA replacements)
    const activeSerials = (p as any).activeSerials;
    if (Array.isArray(activeSerials)) {
      const match = activeSerials.some((s: any) => {
        const sn = typeof s === 'string' ? s : s?.serialNumber;
        return sn && sn.toLowerCase().includes(q);
      });
      if (match) return true;
    }

    // Check serialNumbers string array
    if (Array.isArray(p.serialNumbers)) {
      const match = p.serialNumbers.some((sn: string) => sn && sn.toLowerCase().includes(q));
      if (match) return true;
    }

    return false;
  });

  // Filter orders for Invoices view
  const filteredOrders = orders.filter(
    (o) =>
      o.invoiceNumber.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
      o.channelName.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
      o.paymentGatewayName.toLowerCase().includes(orderSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Sub navigation: Terminal vs Invoices Management vs Credit Customers */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2 p-1 bg-slate-900/80 border border-slate-800/80 rounded-xl backdrop-blur-md">
          <button
            onClick={() => setActiveSubTab('terminal')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'terminal'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-950/40 border border-purple-400/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>POS Terminal & Invoicing</span>
          </button>
          <button
            onClick={() => setActiveSubTab('invoices')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'invoices'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-950/40 border border-purple-400/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Invoice History & Returns</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono border border-slate-700/60">
              {orders.length}
            </span>
          </button>
          <button
            onClick={() => setActiveSubTab('credit')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'credit'
                ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md shadow-amber-950/40 border border-amber-400/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span>Credit Customers &amp; AR</span>
            {creditUnsettledCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold">
                {creditUnsettledCount} Due
              </span>
            )}
          </button>
        </div>

        {activeSubTab === 'terminal' && (
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:brightness-110 rounded-xl transition-all shadow-md shadow-purple-950/40 border border-purple-400/30 cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Camera Barcode Scanner</span>
          </button>
        )}
      </div>

      {/* POS TERMINAL VIEW */}
      {activeSubTab === 'terminal' && (
        <div className="space-y-4">
          {/* Active Barcode & Serial Scanner Bar */}
          <div className="bg-slate-900/70 border border-purple-500/30 rounded-2xl p-4 shadow-xl shadow-purple-950/20 backdrop-blur-xl relative overflow-hidden">
            {/* Ambient subtle glow background */}
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-tr from-purple-600/20 to-indigo-600/20 text-purple-300 border border-purple-500/30 shadow-inner">
                  <Barcode className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Fast Barcode & Serial Scanner</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Scanner Ready
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Scan with handheld USB/Bluetooth scanner or type & press Enter. Auto-detects barcodes, SKUs & item serials.
                  </p>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleScanSubmit(activeScanInput);
                }}
                className="flex items-center gap-2 flex-1 max-w-xl"
              >
                <div className="relative flex-1">
                  <input
                    ref={scannerInputRef}
                    type="text"
                    value={activeScanInput}
                    onChange={(e) => setActiveScanInput(e.target.value)}
                    placeholder="Scan barcode, SKU, or serial number here (Auto-adds to cart)..."
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950/90 border border-purple-500/40 rounded-xl text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 shadow-inner"
                  />
                  <Scan className="w-4 h-4 text-purple-400 absolute left-3 top-3" />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-purple-950/50 border border-purple-400/30 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="px-3.5 py-2.5 bg-slate-800/80 hover:bg-slate-750 text-slate-300 border border-slate-700/80 text-xs rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
                  title="Open Phone Camera Scanner"
                >
                  <Camera className="w-3.5 h-3.5 text-purple-400" />
                  Camera
                </button>
              </form>
            </div>

            {scanStatus && (
              <div
                className={`mt-3 px-3 py-2 rounded-xl text-xs flex items-center justify-between border backdrop-blur-md ${
                  scanStatus.type === 'success'
                    ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
                }`}
              >
                <span className="font-mono">{scanStatus.message}</span>
                <button
                  type="button"
                  onClick={() => setScanStatus(null)}
                  className="text-[11px] underline ml-2 opacity-80 hover:opacity-100 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {creditToast && (
              <div className="mt-3 px-3 py-2 rounded-xl text-xs flex items-center justify-between border bg-amber-950/80 border-amber-500/60 text-amber-200 backdrop-blur-md animate-fadeIn">
                <span className="font-semibold">{creditToast}</span>
                <button
                  type="button"
                  onClick={() => setCreditToast(null)}
                  className="text-[11px] underline ml-2 opacity-80 hover:opacity-100 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Product Catalog & Fast Quick-Add (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Search and Category Filter */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search products by SKU, name, or barcode..."
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-900/80 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 backdrop-blur-md shadow-sm"
                  />
                </div>
              </div>

              {/* Product Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 max-h-[640px] overflow-y-auto pr-1">
                {filteredProducts.length === 0 ? (
                  <div className="col-span-full py-16 px-4 text-center bg-slate-900/50 border border-slate-800/80 rounded-2xl flex flex-col items-center justify-center gap-2 backdrop-blur-md">
                    <Package className="w-10 h-10 text-slate-600 mb-1" />
                    <h4 className="text-sm font-semibold text-white">No Products in Inventory</h4>
                    <p className="text-xs text-slate-400 max-w-sm">
                      Your store inventory is empty. Add products in the Products &amp; Barcode GRN tab or scan barcodes to begin invoicing.
                    </p>
                  </div>
                ) : (
                  (filteredProducts || []).map((prod) => {
                    const profitMargin =
                      prod.sellingPrice > 0
                        ? Math.round(((prod.sellingPrice - prod.costPrice) / prod.sellingPrice) * 100)
                        : 0;

                    return (
                      <div
                        key={prod.id}
                        onClick={() => handleAddProductToCart(prod)}
                        className="p-3.5 bg-slate-900/60 hover:bg-slate-850/80 border border-slate-800/80 hover:border-purple-500/50 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col justify-between group backdrop-blur-md shadow-sm hover:shadow-lg hover:shadow-purple-950/20 active:scale-[0.99]"
                      >
                        <div>
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] font-mono font-bold text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                              {prod.sku}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-950/80 font-mono text-slate-300 border border-slate-800">
                              {prod.stockStore} in store
                            </span>
                          </div>
                          <h4 className="text-xs font-semibold text-white mt-2 line-clamp-2 group-hover:text-purple-200 transition-colors">
                            {prod.name}
                          </h4>
                          {/* Active / Replacement S/N tags */}
                          {Array.isArray((prod as any).activeSerials) && (prod as any).activeSerials.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {(prod as any).activeSerials.slice(0, 2).map((s: any, idx: number) => {
                                const sn = typeof s === 'string' ? s : s?.serialNumber;
                                const isReplacement = typeof s === 'object' && s?.source === 'Supplier RMA Replacement';
                                return (
                                  <span
                                    key={idx}
                                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                                      isReplacement
                                        ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40 shadow-xs'
                                        : 'bg-purple-950/60 text-purple-300 border-purple-500/30'
                                    }`}
                                    title={isReplacement ? `Supplier RMA Replacement (${s.rmaRef || 'RMA'})` : 'Active Serial'}
                                  >
                                    {isReplacement ? '⚡ S/N: ' : 'S/N: '}{sn}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono font-bold text-white text-sm">
                              Rs. {prod.sellingPrice.toLocaleString()}
                            </span>
                            <span className="text-[10px] font-mono text-emerald-300 font-semibold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                              +{profitMargin}%
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 mt-1 truncate">
                            Barcode: {prod.barcode}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Active POS Cart & Dynamic Checkout (5 cols) */}
            <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between space-y-4 backdrop-blur-xl shadow-xl shadow-purple-950/10">
              <div>
                {/* Cart Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-semibold text-white">POS Checkout Cart</h3>
                    <span className="text-[11px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                      {cart.length} item{cart.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCart([])}
                      className="text-xs text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      Clear Cart
                    </button>
                  )}
                </div>

                {/* Cart Items List with Price & Discount Editing */}
                <div className="my-3 space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {cart.length === 0 ? (
                    <div className="py-12 text-center text-neutral-500 text-xs">
                      Cart is currently empty.
                      <br />
                      Scan barcodes or click items from the catalog.
                    </div>
                  ) : (
                    itemCalculations.map((item) => (
                      <div
                        key={item.sku}
                        className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-2 text-xs shadow-inner"
                      >
                        {/* Line Item Top: Name, Serial, Quantity, Total, Delete */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white truncate">{item.name}</div>
                            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                              <span>SKU: {item.sku}</span>
                              {item.serialNumber && (
                                <span className="px-1.5 py-0.2 bg-purple-500/15 text-purple-300 rounded border border-purple-500/30">
                                  SN: {item.serialNumber}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quantity Controls */}
                          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.sku, -1)}
                              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center font-mono font-semibold text-white text-xs">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.sku, 1)}
                              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Line Total */}
                          <div className="text-right font-mono min-w-[75px]">
                            <div className="font-bold text-white text-xs">
                              Rs. {item.lineTotal.toLocaleString()}
                            </div>
                            {item.itemDiscountAmount > 0 && (
                              <div className="text-[10px] text-emerald-300 font-semibold">
                                -Rs. {(item.itemDiscountAmount * item.quantity).toLocaleString()}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(item.sku)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Line Item Bottom: Price Customization & Item-level Discount */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-900 text-[11px]">
                          {/* Unit Price Customization */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">Price:</span>
                            {editingPriceSku === item.sku ? (
                              <div className="flex items-center gap-1">
                                <span className="text-slate-400 font-mono">Rs.</span>
                                <input
                                  type="number"
                                  autoFocus
                                  value={tempPriceInput}
                                  onChange={(e) => setTempPriceInput(e.target.value)}
                                  className="w-20 px-1.5 py-0.5 bg-slate-900 border border-purple-500 rounded text-white font-mono text-xs focus:outline-none"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleUpdateItemPrice(item.sku, Number(tempPriceInput));
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemPrice(item.sku, Number(tempPriceInput))}
                                  className="px-1.5 py-0.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-bold"
                                >
                                  OK
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingPriceSku(null)}
                                  className="px-1 text-slate-400 hover:text-white text-[10px]"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPriceSku(item.sku);
                                  setTempPriceInput(String(item.unitPrice));
                                }}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 font-mono hover:border-purple-500/50 transition cursor-pointer"
                                title="Click to edit unit price"
                              >
                                <span>Rs. {item.unitPrice.toLocaleString()}</span>
                                <Edit className="w-2.5 h-2.5 text-slate-400" />
                              </button>
                            )}
                          </div>

                          {/* Item Discount Controls */}
                          <div className="flex items-center gap-1.5">
                            {discountingSku === item.sku ? (
                              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                                <select
                                  value={tempDiscountType}
                                  onChange={(e) => setTempDiscountType(e.target.value as any)}
                                  className="bg-slate-950 text-white text-[10px] rounded px-1 py-0.5 border border-slate-800 focus:outline-none"
                                >
                                  <option value="percent">%</option>
                                  <option value="fixed">Rs.</option>
                                </select>
                                <input
                                  type="number"
                                  autoFocus
                                  value={tempDiscountVal}
                                  onChange={(e) => setTempDiscountVal(e.target.value)}
                                  placeholder={tempDiscountType === 'percent' ? '10' : '200'}
                                  className="w-14 px-1 py-0.5 bg-slate-950 border border-purple-500 rounded text-white font-mono text-[10px] focus:outline-none"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleUpdateItemDiscount(item.sku, tempDiscountType, Number(tempDiscountVal));
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateItemDiscount(item.sku, tempDiscountType, Number(tempDiscountVal))
                                  }
                                  className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold"
                                >
                                  Apply
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleUpdateItemDiscount(item.sku, 'fixed', 0);
                                    setDiscountingSku(null);
                                  }}
                                  className="px-1 text-rose-400 hover:text-rose-300 text-[10px]"
                                  title="Remove discount"
                                >
                                  Clear
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setDiscountingSku(item.sku);
                                  setTempDiscountType(item.discountType || 'percent');
                                  setTempDiscountVal(
                                    String(
                                      item.discountType === 'percent'
                                        ? item.discountPercent || ''
                                        : item.discountAmount || ''
                                    )
                                  );
                                }}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] border transition cursor-pointer ${
                                  item.itemDiscountAmount > 0
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-semibold'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                <Tag className="w-2.5 h-2.5" />
                                {item.itemDiscountAmount > 0
                                  ? `${item.discountType === 'percent' ? `${item.discountPercent}% OFF` : `Rs. ${item.discountAmount} OFF`}`
                                  : '+ Item Discount'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Bill / Cart Total Discount Section */}
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-2.5 mt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5 text-purple-400" />
                      Total Bill Discount
                    </span>
                    {billDiscountAmount > 0 && (
                      <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        -Rs. {billDiscountAmount.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setBillDiscountType('percent')}
                        className={`px-2.5 py-1 rounded-md transition font-semibold ${
                          billDiscountType === 'percent' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillDiscountType('fixed')}
                        className={`px-2.5 py-1 rounded-md transition font-semibold ${
                          billDiscountType === 'fixed' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Rs.
                      </button>
                    </div>

                    <input
                      type="number"
                      value={billDiscountValue || ''}
                      onChange={(e) => setBillDiscountValue(Math.max(0, Number(e.target.value) || 0))}
                      placeholder={billDiscountType === 'percent' ? 'e.g. 5%' : 'e.g. 500'}
                      className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30"
                    />

                    {billDiscountValue > 0 && (
                      <button
                        type="button"
                        onClick={() => setBillDiscountValue(0)}
                        className="px-2 py-1 text-slate-400 hover:text-rose-400 text-xs cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Presets */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-500">Presets:</span>
                    {[5, 10, 15].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setBillDiscountType('percent');
                          setBillDiscountValue(pct);
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition ${
                          billDiscountType === 'percent' && billDiscountValue === pct
                            ? 'bg-purple-600 border-purple-500 text-white font-bold shadow-sm'
                            : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                    {[500, 1000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setBillDiscountType('fixed');
                          setBillDiscountValue(amt);
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition ${
                          billDiscountType === 'fixed' && billDiscountValue === amt
                            ? 'bg-purple-600 border-purple-500 text-white font-bold shadow-sm'
                            : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        Rs. {amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Channel & Payment Gateways */}
                <div className="space-y-3 pt-3.5 border-t border-slate-800/80 text-xs">
                  {/* Platform Selector */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-slate-300 font-semibold">Sales Channel / Platform</span>
                      <span className="text-[11px] font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                        Fee: {activePlatform.feePercent}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(platforms || []).map((plt) => (
                        <button
                          key={plt.code}
                          type="button"
                          onClick={() => setSelectedPlatformCode(plt.code)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            selectedPlatformCode === plt.code
                              ? 'border-purple-500 bg-purple-500/15 text-white shadow-md shadow-purple-950/40 ring-1 ring-purple-500/30'
                              : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <div className="font-semibold text-xs truncate">{plt.name}</div>
                          <div className="text-[10px] font-mono opacity-80 mt-0.5">{plt.feePercent}% Platform Fee</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payment Gateway Selector */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-slate-300 font-semibold">Payment Gateway</span>
                      <span className="text-[11px] font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                        {isCreditActive ? 'Credit Sale (0% Surcharge)' : `Surcharge: ${Math.round(gatewayFeePercentage * 100)}% added`}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {allGateways.map((gw) => {
                        const gwLower = gw.code.toLowerCase();
                        const isCredit = gwLower === 'credit';
                        const isBnpl =
                          ['payzy', 'koko', 'mintpay'].includes(gwLower) ||
                          gw.name.includes('Payzy') ||
                          gw.name.includes('Koko') ||
                          gw.name.includes('Mintpay');
                        const isCard = gwLower.includes('card') || gw.name.includes('Card');
                        const feePct = isCredit ? 0 : isBnpl ? 12 : isCard ? 3 : gw.feePercent;
                        const isSelected = selectedGatewayCode === gw.code;

                        return (
                          <button
                            key={gw.code}
                            type="button"
                            onClick={() => {
                              setSelectedGatewayCode(gw.code);
                              setIsCreditSale(isCredit);
                            }}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? isCredit
                                  ? 'border-amber-500 bg-amber-500/20 text-white shadow-md shadow-amber-950/40 ring-1 ring-amber-500/30'
                                  : 'border-purple-500 bg-purple-500/20 text-white shadow-md shadow-purple-950/40 ring-1 ring-purple-500/30'
                                : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                            }`}
                          >
                            <div className="font-semibold text-xs truncate flex items-center gap-1.5">
                              {isCredit && <Clock className="w-3.5 h-3.5 text-amber-400" />}
                              <span>{gw.name}</span>
                            </div>
                            <div className="text-[10px] font-mono opacity-80 mt-0.5">
                              {isCredit
                                ? 'Store Credit (Pay Later)'
                                : feePct > 0
                                ? `+${feePct}% Added to Total`
                                : '0% (No Surcharge)'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Credit Customer Specific Settlement Details & Partial Payment Split */}
                  {isCreditActive && (
                    <div className="p-4 bg-gradient-to-br from-amber-950/30 via-slate-950/80 to-amber-950/20 border border-amber-500/40 rounded-2xl space-y-3.5 text-xs shadow-lg shadow-amber-950/20 backdrop-blur-md animate-fadeIn">
                      <div className="flex items-center justify-between pb-2 border-b border-amber-500/30">
                        <span className="font-bold text-amber-300 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-amber-400" />
                          <span>Partial Payment &amp; Credit Split Terms</span>
                        </span>
                        <span className="text-[10px] font-mono bg-amber-500/25 text-amber-200 px-2.5 py-0.5 rounded-full border border-amber-500/40 font-bold">
                          Accounts Receivable
                        </span>
                      </div>

                      {/* Advance Payment Input & Presets */}
                      <div className="space-y-2 bg-slate-950/90 p-3 rounded-xl border border-slate-800/80">
                        <div className="flex justify-between items-center">
                          <label className="text-[11px] font-semibold text-slate-200 flex items-center gap-1">
                            <span>Advance Paid Amount (මුලික ගෙවීම)</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              (Leave 0 for full credit)
                            </span>
                          </label>
                          {advancePaidAmount > 0 && (
                            <button
                              type="button"
                              onClick={() => setAdvancePaidAmount(0)}
                              className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                            >
                              Reset to 0
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-2 text-slate-400 font-mono text-xs">Rs.</span>
                            <input
                              type="number"
                              min="0"
                              max={finalGrossTotal}
                              value={advancePaidAmount || ''}
                              onChange={(e) =>
                                setAdvancePaidAmount(
                                  Math.min(finalGrossTotal, Math.max(0, Number(e.target.value) || 0))
                                )
                              }
                              placeholder="0 (Full Credit)"
                              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-amber-500/40 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                            />
                          </div>

                          {/* Quick Advance Presets */}
                          <div className="flex items-center gap-1">
                            {[
                              { label: '0%', val: 0 },
                              { label: '25%', val: Math.round(finalGrossTotal * 0.25) },
                              { label: '50%', val: Math.round(finalGrossTotal * 0.5) },
                              { label: '75%', val: Math.round(finalGrossTotal * 0.75) },
                            ].map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => setAdvancePaidAmount(preset.val)}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border transition-all cursor-pointer ${
                                  advancePaidAmount === preset.val
                                    ? 'bg-amber-600 border-amber-500 text-white font-bold shadow-md shadow-amber-950/40'
                                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850'
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Advance Payment Method (if advance paid > 0) */}
                        {advancePaidAmount > 0 && (
                          <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                            <span className="text-[10px] text-slate-400 font-medium">Advance Paid Via:</span>
                            <div className="flex gap-1.5 text-[10px]">
                              {['Cash', 'Card', 'Bank Transfer', 'Cheque'].map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => setAdvancePaymentMethod(m)}
                                  className={`px-2.5 py-1 rounded-md border transition cursor-pointer ${
                                    advancePaymentMethod === m
                                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-500 text-white font-bold shadow-sm'
                                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                                  }`}
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Calculation Breakdown Box */}
                      <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/90 rounded-xl border border-slate-800/90 text-[11px] font-mono shadow-inner">
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-sans">Advance Collected:</div>
                          <div className="text-emerald-400 font-bold text-sm mt-0.5">
                            Rs. {advancePaidAmount.toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-sans">Credit Balance Due:</div>
                          <div className="text-amber-400 font-bold text-sm mt-0.5 glow-amber">
                            Rs. {creditBalanceDue.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* Due Date Presets & Date Picker */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] text-slate-400 font-semibold mb-1">
                            Settlement Due Date *
                          </label>
                          <input
                            type="date"
                            value={creditDueDate}
                            onChange={(e) => setCreditDueDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-3 py-1.5 bg-slate-900 border border-amber-500/50 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 font-semibold mb-1">Due Date Presets</label>
                          <div className="flex items-center gap-1.5">
                            {[7, 14, 30].map((days) => (
                              <button
                                key={days}
                                type="button"
                                onClick={() => {
                                  const d = new Date();
                                  d.setDate(d.getDate() + days);
                                  setCreditDueDate(d.toISOString().split('T')[0]);
                                }}
                                className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-[10px] font-mono text-amber-300 font-semibold transition cursor-pointer"
                              >
                                +{days}d
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 font-semibold mb-1">
                          Payment Agreement / Terms Note
                        </label>
                        <input
                          type="text"
                          value={creditNotes}
                          onChange={(e) => setCreditNotes(e.target.value)}
                          placeholder="e.g. 50% advance received, balance payable upon monthly settlement"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div className="text-[10px] text-amber-200/90 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/25 flex items-start gap-2">
                        <Send className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>
                          Automated SMS with Advance Paid (Rs. {advancePaidAmount.toLocaleString()}), Balance Due (Rs.{' '}
                          {creditBalanceDue.toLocaleString()}), and Due Date ({creditDueDate ? new Date(creditDueDate).toLocaleDateString('en-GB') : 'Due Date'}) will be dispatched upon sale.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Customer Info (Searchable & Dynamic) */}
                  <div className="space-y-2.5 pt-3 border-t border-slate-800/80 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200 font-semibold flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-purple-400" />
                        Customer Details
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerName('Cash Customer');
                          setCustomerPhone('');
                          setCustomerCity('Colombo 04');
                          setIsCustomerDropdownOpen(false);
                        }}
                        className="text-[10px] text-purple-400 hover:text-purple-300 underline cursor-pointer"
                      >
                        Reset to Cash Customer
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 relative">
                      {/* Customer Name input with autocomplete */}
                      <div className="relative">
                        <label className="block text-[10px] text-slate-400 font-medium mb-1">Customer Name</label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => {
                            setCustomerName(e.target.value);
                            setIsCustomerDropdownOpen(true);
                          }}
                          onFocus={() => setIsCustomerDropdownOpen(true)}
                          placeholder="Cash Customer (or search/type)"
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-sans text-xs focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30"
                        />

                        {/* Customer Autocomplete Dropdown */}
                        {isCustomerDropdownOpen && customerList.length > 0 && (
                          <div className="absolute top-full left-0 z-50 w-72 mt-1 bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl backdrop-blur-xl max-h-52 overflow-y-auto p-1.5 text-xs">
                            <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center border-b border-slate-800">
                              <span>Directory Customers</span>
                              <button
                                type="button"
                                onClick={() => setIsCustomerDropdownOpen(false)}
                                className="text-slate-400 hover:text-white cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                            {customerList
                              .filter(
                                (c) =>
                                  !customerName ||
                                  customerName === 'Cash Customer' ||
                                  c.name?.toLowerCase().includes(customerName.toLowerCase()) ||
                                  c.phone?.includes(customerName)
                              )
                              .slice(0, 8)
                              .map((c, i) => (
                                <div
                                  key={i}
                                  onClick={() => {
                                    setCustomerName(c.name || 'Valued Customer');
                                    setCustomerPhone(c.phone || '');
                                    if (c.city) setCustomerCity(c.city);
                                    if (c.address) setCustomerAddress(c.address);
                                    setIsCustomerDropdownOpen(false);
                                  }}
                                  className="p-2 hover:bg-slate-800 rounded-lg cursor-pointer transition flex items-center justify-between"
                                >
                                  <div>
                                    <div className="font-semibold text-white">{c.name || 'Customer'}</div>
                                    <div className="text-[10px] font-mono text-purple-400">{c.phone}</div>
                                  </div>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 font-mono border border-slate-800">
                                    {c.source || 'POS'}
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Customer Phone */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-[10px] text-slate-400 font-medium">
                            Mobile Phone {isCreditActive && <span className="text-amber-400 font-bold">* Required</span>}
                          </label>
                          <span className="text-[9px] text-purple-400 font-mono">Auto +94</span>
                        </div>
                        <input
                          type="text"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(handleLivePhoneInput(e.target.value))}
                          onBlur={() => {
                            if (customerPhone.trim()) {
                              setCustomerPhone(formatSriLankanPhone(customerPhone));
                            }
                          }}
                          placeholder="0715330724 (or leave blank)"
                          className={`w-full px-3 py-2 bg-slate-950 border ${
                            isCreditActive && (!customerPhone || customerPhone.length < 9)
                              ? 'border-amber-500/80 ring-2 ring-amber-500/30'
                              : 'border-slate-800 focus:border-purple-500'
                          } rounded-xl text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-purple-500/30`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Summary & Checkout Button */}
              <div className="pt-3.5 border-t border-slate-800/80 space-y-3 text-xs">
                <div className="space-y-1.5 font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>Gross Item Subtotal:</span>
                    <span className="text-white">
                      Rs. {grossItemSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-emerald-400 font-semibold">
                      <span>Total Discounts Applied:</span>
                      <span>-Rs. {totalDiscount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  {billDiscountAmount > 0 && (
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>└ Bill Discount ({billDiscountType === 'percent' ? `${billDiscountValue}%` : `Rs. ${billDiscountValue}`}):</span>
                      <span>-Rs. {billDiscountAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  {paymentFeeAmount > 0 ? (
                    <div className="flex justify-between text-purple-400">
                      <span>Payment Fee (+{Math.round(gatewayFeePercentage * 100)}% Add to Total):</span>
                      <span>+Rs. {paymentFeeAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>Payment Fee (0%):</span>
                      <span>Rs. 0.00</span>
                    </div>
                  )}

                  {courierFee > 0 && (
                    <div className="flex justify-between text-slate-400">
                      <span>Courier Shipping Cost:</span>
                      <span>+Rs. {courierFee.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-white font-bold text-base pt-2 pb-1 border-t border-slate-800/80">
                    <span className="text-xs uppercase tracking-wider text-slate-300">Final Gross Total:</span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-pink-400 font-mono text-lg font-extrabold">
                      Rs. {finalGrossTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {isCreditActive && (
                    <div className="p-3 rounded-xl bg-gradient-to-r from-amber-950/40 via-slate-900/80 to-amber-950/30 border border-amber-500/40 space-y-1.5 text-xs font-mono shadow-md">
                      <div className="flex justify-between text-slate-300">
                        <span>Advance Paid Today:</span>
                        <span className="font-bold text-emerald-400">
                          Rs. {advancePaidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-amber-300 font-bold">
                        <span>Balance Due (Credit):</span>
                        <span className="font-bold text-amber-400 text-sm glow-amber">
                          Rs. {creditBalanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                        <span>Settlement Due Date:</span>
                        <span className="font-mono text-white font-semibold">
                          {creditDueDate ? new Date(creditDueDate).toLocaleDateString('en-GB') : 'As agreed'}
                        </span>
                      </div>
                    </div>
                  )}

                  {platformFeeAmount > 0 && (
                    <div className="flex justify-between text-amber-400 text-[11px]">
                      <span>Platform Fee ({activePlatform.feePercent}%):</span>
                      <span>-Rs. {platformFeeAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Cost of Goods (COGS):</span>
                    <span>-Rs. {totalCostOfGoods.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>

                  {hasUnregisteredInCart ? (
                    <div className="pt-2 pb-1 border-t border-slate-800">
                      <div className="flex justify-between items-center text-amber-400">
                        <span className="font-semibold text-[11px]">Net Estimated Profit:</span>
                        <span className="text-[10px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 font-mono">
                          Pending / Inventory Not Found
                        </span>
                      </div>
                      <p className="text-[10px] text-amber-300/80 mt-1">
                        Cart contains unregistered items with missing cost price. Arbitrary profit suppressed.
                      </p>
                    </div>
                  ) : (
                    <div className="flex justify-between text-emerald-400 font-semibold pt-1.5 border-t border-slate-800">
                      <div>
                        <span>Net Estimated Profit:</span>
                        <div className="text-[9px] text-slate-400 font-sans font-normal">
                          (Net Selling Price - COGS - Platform Fee)
                        </div>
                      </div>
                      <span className="text-sm font-bold">
                        Rs. {netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={cart.length === 0}
                  className={`w-full py-3 px-4 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] ${
                    isCreditActive
                      ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:brightness-110 shadow-amber-950/60 border border-amber-400/40'
                      : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:brightness-110 shadow-purple-950/60 border border-purple-400/40'
                  }`}
                >
                  {isCreditActive ? (
                    <>
                      <Clock className="w-4 h-4 text-amber-200" />
                      <span>
                        {advancePaidAmount > 0
                          ? `Complete Sale (Rs. ${advancePaidAmount.toLocaleString()} Advance, Rs. ${creditBalanceDue.toLocaleString()} Credit)`
                          : `Complete Credit Sale & Send SMS (Rs. ${finalGrossTotal.toLocaleString()})`}
                      </span>
                    </>
                  ) : (
                    <>
                      <Printer className="w-4 h-4" />
                      <span>Complete POS Sale &amp; Print Invoice (Rs. {finalGrossTotal.toLocaleString()})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* INVOICES & RETURNS MANAGEMENT VIEW */}
      {activeSubTab === 'invoices' && (
        <div className="space-y-4">
          {/* Search bar & Stats */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 p-3.5 bg-slate-900/70 border border-slate-800/80 rounded-2xl backdrop-blur-md shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                placeholder="Search invoice #, customer name, gateway..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950/80 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30"
              />
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-3 font-mono">
              <span>
                Total Invoiced: <strong className="text-white font-mono">{orders.length}</strong>
              </span>
              <span>·</span>
              <span>
                Returns Processed:{' '}
                <strong className="text-amber-400 font-mono">
                  {orders.filter((o) => o.status === 'Returned' || o.status === 'Partially Returned').length}
                </strong>
              </span>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800/90 bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-3.5 px-4 font-semibold">Invoice No & Date</th>
                    <th className="py-3.5 px-4 font-semibold">Customer Details</th>
                    <th className="py-3.5 px-4 font-semibold">Channel & Gateway Fee</th>
                    <th className="py-3.5 px-4 font-semibold">Items Invoiced</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Gross Total</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Net Profit</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                          <ShoppingCart className="w-10 h-10 text-slate-600 mb-1" />
                          <p className="font-semibold text-white text-sm">No Invoices Found</p>
                          <p className="text-xs text-slate-400">
                            No sales invoices have been created yet. Process an order through the POS terminal to generate your first invoice.
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveSubTab('terminal')}
                            className="mt-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white rounded-xl text-xs font-semibold shadow-md shadow-purple-950/40 transition-all cursor-pointer"
                          >
                            Open POS Terminal
                          </button>
                        </div>
                      </td>
                    </tr>
              ) : (
                (filteredOrders || []).map((order) => (
                  <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-white text-xs">{order.invoiceNumber}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-GB') : '-'}
                      </div>
                      {order.waybillNumber ? (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-cyan-300 font-mono bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20 w-fit">
                          <Truck className="w-3 h-3" />
                          <span>TX: {order.waybillNumber}</span>
                        </div>
                      ) : order.waybillError ? (
                        <div
                          className="mt-1 flex items-center gap-1 text-[10px] text-rose-300 font-mono bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 w-fit truncate max-w-[140px]"
                          title={order.waybillError}
                        >
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">Courier Failed</span>
                        </div>
                      ) : null}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{order.customerName}</div>
                      <div className="text-slate-400 font-mono text-[11px] mt-0.5">{order.customerPhone}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="text-slate-200 font-medium">{order.channelName}</div>
                      <div className="text-[11px] text-purple-300 font-mono">
                        {order.paymentGatewayName} ({order.gatewayFeePercent}%)
                      </div>
                      {order.gatewayFeeAmount > 0 && (
                        <div className="text-[10px] text-purple-400 font-mono">
                          +Rs. {order.gatewayFeeAmount.toLocaleString()} surcharge
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {((order?.items) || []).map((it, idx) => (
                        <div key={idx} className="text-slate-300 text-[11px]">
                          <span className="font-semibold text-white">{it.quantity}x</span> {it.name}
                          {it.returned && (
                            <span className="ml-1 text-[10px] text-amber-300 font-mono bg-amber-500/10 px-1 rounded">[Returned]</span>
                          )}
                        </div>
                      ))}
                    </td>

                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-white font-bold text-sm">
                          Rs. {order.grossTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          {order.baseSubtotal && order.baseSubtotal !== order.grossTotal && (
                            <div className="text-[10px] text-slate-400 font-normal">
                              Base: Rs. {order.baseSubtotal.toLocaleString()}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold">
                          {order.profitStatus === 'Pending / Inventory Not Found' || order.hasUnregisteredItems ? (
                            <span className="inline-block text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30 whitespace-nowrap">
                              Pending / Inventory Not Found
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-bold">
                              Rs. {order.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                              order.status === 'Completed' || order.status === 'Delivered'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : order.status === 'Returned'
                                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                : order.status === 'Partially Returned'
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View / Print A4 Warranty Invoice */}
                            <button
                              onClick={() => setSelectedInvoiceForPrint(order)}
                              className="px-2.5 py-1 text-purple-200 hover:text-white bg-purple-600/20 hover:bg-purple-600 border border-purple-500/30 rounded-lg transition-all flex items-center gap-1 text-[11px] font-semibold cursor-pointer shadow-sm"
                              title="Print / Download A4 Warranty Invoice"
                            >
                              <FileText className="w-3 h-3" />
                              <span>A4</span>
                            </button>

                            {/* Print 4x6 Daraz-Style Thermal Shipping Label */}
                            <button
                              onClick={() => setSelectedOrderForThermalPrint(order)}
                              className="px-2.5 py-1 text-emerald-200 hover:text-white bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 rounded-lg transition-all flex items-center gap-1 text-[11px] font-semibold cursor-pointer shadow-sm"
                              title="Print 100mm x 150mm Daraz-Style 4x6 Thermal Shipping Waybill"
                            >
                              <Printer className="w-3 h-3" />
                              <span>4x6 Label</span>
                            </button>

                            {/* Process Return & Restock */}
                            {order.status !== 'Returned' && (
                              <button
                                onClick={() => setReturnModalOrder(order)}
                                className="p-1.5 text-amber-400 hover:text-amber-300 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Process Customer Return & Restore Stock"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Edit Invoice */}
                            <button
                              onClick={() => setEditModalOrder(order)}
                              className="p-1.5 text-purple-400 hover:text-purple-300 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Edit Invoice Details"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Invoice */}
                            <button
                              onClick={() => {
                                if (confirm(`Delete invoice ${order.invoiceNumber}?`)) {
                                  onDeleteOrder(order.id);
                                }
                              }}
                              className="p-1.5 text-neutral-500 hover:text-red-400 rounded hover:bg-neutral-800 transition-colors"
                              title="Delete Invoice"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREDIT CUSTOMERS & RECEIVABLES DASHBOARD VIEW */}
      {activeSubTab === 'credit' && (
        <CreditCustomersTab
          orders={orders}
          onUpdateOrder={onUpdateOrder}
          onNavigateTab={() => setActiveSubTab('terminal')}
        />
      )}

      {/* Camera Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
        onAddCustomItem={handleAddCustomItem}
        products={products}
        title="POS Camera Barcode Scanner"
        description="Scan any product barcode or SKU to continuously add to cart"
        cartItemCount={(cart || []).reduce((sum, item) => sum + (item?.quantity || 0), 0)}
        onLoadSampleProducts={onLoadSampleProducts}
      />

      {/* Return & Stock Restoration Modal */}
      {returnModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">
                  Process Return & Restore Stock
                </h3>
              </div>
              <button
                onClick={() => setReturnModalOrder(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-1">
                <div className="flex justify-between font-mono">
                  <span className="text-neutral-400">Invoice:</span>
                  <span className="text-white font-semibold">{returnModalOrder.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Customer:</span>
                  <span className="text-white">{returnModalOrder.customerName}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-neutral-400">Gross Total Refunded:</span>
                  <span className="text-amber-400 font-bold">
                    Rs. {returnModalOrder.grossTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Items Returning to Store Stock:
                </label>
                <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg space-y-1.5">
                  {((returnModalOrder?.items) || []).map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px]">
                      <span className="text-white">
                        {it.quantity}x {it.name}
                      </span>
                      <span className="font-mono text-emerald-400 font-medium">
                        +{it.quantity} stock will be restored
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Reason for Return</label>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Customer change of mind / unopened seal"
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              <div className="p-3 bg-amber-950/40 border border-amber-800/40 rounded-lg text-[11px] text-amber-300">
                Notice: Confirming this return will automatically increment store inventory stock for all returned items and adjust business net profit calculations.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReturnModalOrder(null)}
                  className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white bg-neutral-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isProcessingReturn}
                  onClick={handleConfirmReturn}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-lg shadow-sm flex items-center gap-1.5"
                >
                  {isProcessingReturn ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Processing Return...</span>
                    </>
                  ) : (
                    <span>Confirm Return & Restore Stock</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {editModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950">
              <h3 className="text-sm font-semibold text-white">
                Edit Invoice - {editModalOrder.invoiceNumber}
              </h3>
              <button
                onClick={() => setEditModalOrder(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateOrder(editModalOrder.id, {
                  customerName: editModalOrder.customerName,
                  customerPhone: editModalOrder.customerPhone,
                  city: editModalOrder.city,
                  notes: editModalOrder.notes,
                });
                setEditModalOrder(null);
              }}
              className="p-5 space-y-3 text-xs"
            >
              <div>
                <label className="block text-neutral-300 font-medium mb-1">Customer Name</label>
                <input
                  type="text"
                  value={editModalOrder.customerName}
                  onChange={(e) =>
                    setEditModalOrder({ ...editModalOrder, customerName: e.target.value })
                  }
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Customer Phone</label>
                <input
                  type="text"
                  value={editModalOrder.customerPhone}
                  onChange={(e) =>
                    setEditModalOrder({ ...editModalOrder, customerPhone: e.target.value })
                  }
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">City / Region</label>
                <input
                  type="text"
                  value={editModalOrder.city}
                  onChange={(e) => setEditModalOrder({ ...editModalOrder, city: e.target.value })}
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Invoice Notes</label>
                <textarea
                  rows={2}
                  value={editModalOrder.notes || ''}
                  onChange={(e) => setEditModalOrder({ ...editModalOrder, notes: e.target.value })}
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalOrder(null)}
                  className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white bg-neutral-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official A4 Warranty Invoice & Print Modal */}
      {selectedInvoiceForPrint && (
        <A4WarrantyInvoiceModal
          order={selectedInvoiceForPrint}
          onClose={() => setSelectedInvoiceForPrint(null)}
          products={products}
        />
      )}

      {/* 4x6 Daraz-Style Thermal Shipping Waybill Modal */}
      {selectedOrderForThermalPrint && (
        <ThermalWaybillModal
          order={selectedOrderForThermalPrint}
          orders={orders}
          products={products}
          onClose={() => setSelectedOrderForThermalPrint(null)}
        />
      )}
    </div>
  );
};
