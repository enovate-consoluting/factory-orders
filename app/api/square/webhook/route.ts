/**
 * Square Webhook Handler - /api/square/webhook
 * Handles payment.completed events to auto-mark invoices and sample fees as paid
 * Last Modified: January 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase with service role for webhook (no user context)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Verify Square webhook signature
function verifySignature(body: string, signature: string, signatureKey: string): boolean {
  if (!signatureKey) {
    console.warn('SQUARE_WEBHOOK_SIGNATURE_KEY not set - skipping signature verification');
    return true; // Allow in development without key
  }

  try {
    const hmac = crypto.createHmac('sha256', signatureKey);
    hmac.update(body);
    const expectedSignature = hmac.digest('base64');
    return signature === expectedSignature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  console.log('=== Square Webhook Received ===');

  try {
    // Get raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get('x-square-hmacsha256-signature') || '';
    const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || '';

    // Verify signature
    if (!verifySignature(rawBody, signature, signatureKey)) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse the event
    const event = JSON.parse(rawBody);
    console.log('Event type:', event.type);
    console.log('Event ID:', event.event_id);

    // Handle payment.completed event
    if (event.type === 'payment.completed' || event.type === 'payment.updated') {
      const payment = event.data?.object?.payment;

      if (!payment) {
        console.log('No payment data in event');
        return NextResponse.json({ received: true, message: 'No payment data' });
      }

      console.log('Payment ID:', payment.id);
      console.log('Payment status:', payment.status);
      console.log('Order ID (Square):', payment.order_id);

      // Only process completed payments
      if (payment.status !== 'COMPLETED') {
        console.log('Payment not completed, skipping');
        return NextResponse.json({ received: true, message: 'Payment not completed' });
      }

      // Try to find invoice by Square checkout/order ID
      let invoice = null;

      // First try by square_checkout_id
      if (payment.order_id) {
        const { data } = await supabase
          .from('invoices')
          .select('*, orders(*)')
          .eq('square_checkout_id', payment.order_id)
          .single();
        invoice = data;
      }

      // If not found, try to extract invoice number from line items
      if (!invoice && payment.order_id) {
        // Fetch the order details from Square to get line items
        try {
          const squarePackage = require('square');
          const squareClient = new squarePackage.Client({
            accessToken: process.env.SQUARE_ACCESS_TOKEN,
            environment: process.env.SQUARE_ENVIRONMENT === 'production' ? 'production' : 'sandbox'
          });

          const orderResponse = await squareClient.ordersApi.retrieveOrder(payment.order_id);
          const lineItems = orderResponse.result?.order?.lineItems || [];

          for (const item of lineItems) {
            // Look for invoice number in line item name (format: "Invoice #XXX-00001")
            const match = item.name?.match(/Invoice\s*#?\s*([A-Z]{3}-\d{5})/i);
            if (match) {
              const invoiceNumber = match[1];
              console.log('Found invoice number in line item:', invoiceNumber);

              const { data } = await supabase
                .from('invoices')
                .select('*, orders(*)')
                .eq('invoice_number', invoiceNumber)
                .single();

              if (data) {
                invoice = data;
                break;
              }
            }
          }
        } catch (squareError) {
          console.error('Error fetching Square order:', squareError);
        }
      }

      if (!invoice) {
        console.log('No matching invoice found for this payment');
        return NextResponse.json({ received: true, message: 'No matching invoice' });
      }

      console.log('Found invoice:', invoice.invoice_number);

      // Update invoice as paid
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_amount: payment.amount_money?.amount ? payment.amount_money.amount / 100 : invoice.amount,
          paid_at: new Date().toISOString(),
          square_transaction_id: payment.id,
          payment_status: 'completed'
        })
        .eq('id', invoice.id);

      if (invoiceError) {
        console.error('Error updating invoice:', invoiceError);
      } else {
        console.log('Invoice marked as paid:', invoice.invoice_number);
      }

      // Check if this invoice is linked to a sample fee
      if (invoice.order_id) {
        const { data: order } = await supabase
          .from('orders')
          .select('id, sample_fee_invoice_id, sample_fee_paid, client_sample_fee')
          .eq('id', invoice.order_id)
          .single();

        // If this invoice is the sample fee invoice, mark sample fee as paid
        if (order && order.sample_fee_invoice_id === invoice.id && !order.sample_fee_paid) {
          const { error: sampleFeeError } = await supabase
            .from('orders')
            .update({
              sample_fee_paid: true,
              sample_fee_paid_at: new Date().toISOString(),
              sample_fee_paid_by_name: 'Square Payment'
            })
            .eq('id', order.id);

          if (sampleFeeError) {
            console.error('Error updating sample fee:', sampleFeeError);
          } else {
            console.log('Sample fee marked as paid for order:', invoice.order_id);
          }
        }
      }

      return NextResponse.json({
        received: true,
        message: 'Payment processed',
        invoice_number: invoice.invoice_number
      });
    }

    // Handle other event types
    console.log('Unhandled event type:', event.type);
    return NextResponse.json({ received: true, message: 'Event type not handled' });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({
      error: 'Webhook processing failed',
      details: error.message
    }, { status: 500 });
  }
}

// GET endpoint for testing/verification
export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Square webhook endpoint ready',
    endpoint: '/api/square/webhook',
    events_handled: ['payment.completed', 'payment.updated'],
    setup_instructions: {
      step1: 'Go to Square Developer Dashboard → Webhooks',
      step2: 'Add webhook URL: https://your-domain.com/api/square/webhook',
      step3: 'Subscribe to events: payment.completed',
      step4: 'Copy Signature Key to env: SQUARE_WEBHOOK_SIGNATURE_KEY'
    }
  });
}
