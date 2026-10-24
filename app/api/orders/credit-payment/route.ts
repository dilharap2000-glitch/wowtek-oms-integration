import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getServerStore, saveServerOrder } from '@/lib/serverStore';
import { Order, CreditPaymentRecord } from '@/types';
import { formatSriLankanPhone } from '@/lib/phoneUtils';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      orderId,
      amount,
      paymentMethod = 'Cash',
      notes = '',
      receiptNumber = '',
      recordedBy = 'POS Cashier',
      sendSms = true,
    } = body;

    const paymentAmount = Number(amount);
    if (!orderId || isNaN(paymentAmount) || paymentAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid orderId and payment amount greater than zero are required.' },
        { status: 400 }
      );
    }

    let foundOrder: Order | null = null;
    let mongoConn: any = null;

    try {
      mongoConn = await connectToMongoDB();
      if (mongoConn) {
        const queryConditions: any[] = [
          { id: String(orderId) },
          { orderId: String(orderId) },
          { invoiceNumber: String(orderId) },
        ];
        if (ObjectId.isValid(String(orderId)) && String(orderId).length === 24) {
          try {
            queryConditions.unshift({ _id: new ObjectId(String(orderId)) });
          } catch {}
        }

        const doc = await mongoConn.db.collection('orders').findOne({
          $or: queryConditions,
        });

        if (doc) {
          const { _id, ...rest } = doc;
          foundOrder = rest as Order;
        }
      }
    } catch (err: any) {
      console.warn('[Credit Payment API] Mongo query error:', err.message);
    }

    if (!foundOrder) {
      const store = getServerStore();
      foundOrder =
        store.orders.find(
          (o) => o.id === orderId || o.invoiceNumber === orderId
        ) || null;
    }

    if (!foundOrder) {
      return NextResponse.json(
        { success: false, error: `Order with ID ${orderId} not found.` },
        { status: 404 }
      );
    }

    const currentGross = Number(foundOrder.grossTotal || 0);
    const prevAdvance = Number(foundOrder.advancePaid || 0);
    const currentBalanceDue =
      foundOrder.balanceDue !== undefined
        ? Number(foundOrder.balanceDue)
        : Math.max(0, currentGross - prevAdvance);

    const actualPayAmount = Math.min(paymentAmount, currentBalanceDue > 0 ? currentBalanceDue : paymentAmount);
    const newAdvancePaid = prevAdvance + actualPayAmount;
    const newBalanceDue = Math.max(0, currentBalanceDue - actualPayAmount);
    const isSettled = newBalanceDue <= 0;

    const paymentRecord: CreditPaymentRecord = {
      id: `pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      orderId: foundOrder.id,
      invoiceNumber: foundOrder.invoiceNumber,
      amount: actualPayAmount,
      paymentMethod,
      date: new Date().toISOString(),
      notes: notes || 'Credit balance settlement payment',
      receiptNumber: receiptNumber || `RCP-${Date.now().toString().slice(-6)}`,
      recordedBy,
    };

    const existingHistory = Array.isArray(foundOrder.creditPaymentHistory)
      ? foundOrder.creditPaymentHistory
      : [];
    const updatedHistory = [...existingHistory, paymentRecord];

    const updates: Partial<Order> = {
      advancePaid: newAdvancePaid,
      balanceDue: newBalanceDue,
      creditSettled: isSettled,
      creditSettledAt: isSettled ? new Date().toISOString() : undefined,
      creditPaymentHistory: updatedHistory,
      updatedAt: new Date().toISOString(),
      notes: `${foundOrder.notes || ''} [Paid Rs. ${actualPayAmount.toLocaleString()} via ${paymentMethod} on ${new Date().toLocaleDateString('en-GB')}]`.trim(),
    };

    const updatedOrder: Order = {
      ...foundOrder,
      ...updates,
    };

    // Save to MongoDB
    if (mongoConn) {
      try {
        await mongoConn.db.collection('orders').updateOne(
          { $or: [{ id: foundOrder.id }, { invoiceNumber: foundOrder.invoiceNumber }] },
          { $set: updates }
        );
      } catch (err: any) {
        console.warn('[Credit Payment API] Mongo update error:', err.message);
      }
    }

    // Save to serverStore
    saveServerOrder(updatedOrder as any);

    // Send SMS receipt if enabled and customer phone exists
    let smsDispatched = false;
    const customerPhone = foundOrder.customerPhone ? formatSriLankanPhone(foundOrder.customerPhone) : '';
    if (sendSms && customerPhone && customerPhone.length >= 9) {
      try {
        const formattedDate = new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
        const smsMessage = `WOWTEK: Payment received for Invoice ${foundOrder.invoiceNumber}. Paid: Rs. ${actualPayAmount.toLocaleString()} (${paymentMethod}) on ${formattedDate}. Remaining Credit Balance: Rs. ${newBalanceDue.toLocaleString()}${
          isSettled ? ' (Fully Settled - Thank you!)' : ` (Settlement Due: ${foundOrder.creditDueDate ? new Date(foundOrder.creditDueDate).toLocaleDateString('en-GB') : 'As Agreed'})`
        }. Helpline: 0779673004.`;

        // Direct call to SMSlenz API
        const smsRes = await fetch(new URL('/api/sms/send', req.url).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact: customerPhone,
            message: smsMessage,
            triggerType: 'order_confirmed',
            referenceId: foundOrder.invoiceNumber,
          }),
        });
        smsDispatched = smsRes.ok;
      } catch (smsErr) {
        console.warn('[Credit Payment API] SMS notification error:', smsErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: isSettled
        ? `Invoice ${foundOrder.invoiceNumber} credit balance has been fully settled!`
        : `Payment of Rs. ${actualPayAmount.toLocaleString()} recorded. Remaining balance: Rs. ${newBalanceDue.toLocaleString()}.`,
      order: updatedOrder,
      paymentRecord,
      smsDispatched,
      isSettled,
      newBalanceDue,
    });
  } catch (error: any) {
    console.error('[Credit Payment API] Exception:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
