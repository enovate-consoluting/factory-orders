/**
 * Create Payment Link API - /api/square/create-payment-link
 * Creates a Square payment link for an invoice
 * Used by the invoice page to generate/regenerate pay links
 */
import { NextRequest, NextResponse } from 'next/server';

async function createSquarePaymentLink(
  invoiceNumber: string,
  amount: number,
  customerEmail?: string,
  customerName?: string
) {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const isProduction = process.env.SQUARE_ENVIRONMENT === 'production';

  if (!accessToken) {
    throw new Error('Square access token not configured');
  }

  const baseUrl = isProduction
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';

  // Get location ID
  const locationsResponse = await fetch(`${baseUrl}/v2/locations`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Square-Version': '2024-01-18',
      'Content-Type': 'application/json'
    }
  });

  const locationsData = await locationsResponse.json();

  if (locationsData.errors) {
    console.error('Square locations error:', locationsData.errors);
    throw new Error('Failed to get Square location');
  }

  const locationId = locationsData.locations?.[0]?.id;
  if (!locationId) {
    throw new Error('No Square location found');
  }

  // Build redirect URL
  const redirectUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/invoice/success`
    : 'http://localhost:3000/invoice/success';

  // Create checkout request
  const checkoutRequest = {
    idempotency_key: `invoice-${invoiceNumber}-${Date.now()}`,
    redirect_url: redirectUrl,
    ask_for_shipping_address: false,
    merchant_support_email: 'support@birdhaus.com',
    pre_populate_buyer_email: customerEmail || '',
    order: {
      order: {
        location_id: locationId,
        line_items: [
          {
            name: `Invoice #${invoiceNumber}`,
            quantity: '1',
            base_price_money: {
              amount: Math.round(amount * 100), // Convert to cents
              currency: 'USD'
            }
          }
        ]
      }
    }
  };

  console.log('Creating Square payment link for invoice:', invoiceNumber);

  const checkoutResponse = await fetch(`${baseUrl}/v2/locations/${locationId}/checkouts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Square-Version': '2024-01-18',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(checkoutRequest)
  });

  const checkoutData = await checkoutResponse.json();

  if (checkoutData.errors) {
    console.error('Square checkout errors:', checkoutData.errors);
    const errorDetails = checkoutData.errors.map((e: any) =>
      `${e.code}: ${e.detail}`
    ).join(', ');
    throw new Error(errorDetails);
  }

  const paymentLink = checkoutData.checkout?.checkout_page_url;
  if (!paymentLink) {
    throw new Error('No payment link returned from Square');
  }

  console.log('Payment link created:', paymentLink);

  return {
    paymentLink,
    checkoutId: checkoutData.checkout?.id
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { invoiceNumber, amount, customerEmail, customerName, clientEmail, clientName } = body;

    if (!invoiceNumber || !amount) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: invoiceNumber and amount'
      }, { status: 400 });
    }

    // Support both customerEmail/customerName and clientEmail/clientName
    const email = customerEmail || clientEmail;
    const name = customerName || clientName;

    const result = await createSquarePaymentLink(
      invoiceNumber,
      parseFloat(amount),
      email,
      name
    );

    return NextResponse.json({
      success: true,
      paymentLink: result.paymentLink,
      checkoutId: result.checkoutId
    });

  } catch (error: any) {
    console.error('Create payment link error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create payment link'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Square Create Payment Link API',
    usage: 'POST with { invoiceNumber, amount, customerEmail?, customerName? }'
  });
}
