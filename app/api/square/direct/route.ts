// app/api/square/direct/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Direct API call to Square without SDK
async function createSquareCheckout(
  invoiceNumber: string,
  amount: number,
  customerEmail: string,
  customerName: string
) {
  // DEBUG LOGS TO CHECK ENVIRONMENT VARIABLES
  console.log('DEBUG - Environment Variables Check:');
  console.log('NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
  console.log('SQUARE_ENVIRONMENT:', process.env.SQUARE_ENVIRONMENT);
  console.log('SQUARE_ACCESS_TOKEN exists:', !!process.env.SQUARE_ACCESS_TOKEN);
  
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const isProduction = process.env.SQUARE_ENVIRONMENT === 'production';
  
  // Square API base URL
  const baseUrl = isProduction 
    ? 'https://connect.squareup.com' 
    : 'https://connect.squareupsandbox.com';

  try {
    // First, get locations
    const locationsResponse = await fetch(`${baseUrl}/v2/locations`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Square-Version': '2024-01-18',
        'Content-Type': 'application/json'
      }
    });

    const locationsData = await locationsResponse.json();
    console.log('Locations response:', locationsData);

    const locationId = locationsData.locations?.[0]?.id || 'main';
    console.log('Using location ID:', locationId);

    // FIXED: Build redirect URL properly
    const redirectUrl = process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/invoice/success`
      : 'http://localhost:3000/invoice/success';
    
    console.log('Using redirect URL:', redirectUrl);

    // Create checkout request body
    const checkoutRequest = {
      idempotency_key: `invoice-${invoiceNumber}-${Date.now()}`,
      redirect_url: redirectUrl,
      ask_for_shipping_address: false,
      merchant_support_email: 'support@birdhaus.com',
      pre_populate_buyer_email: customerEmail,
      order: {
        order: {
          location_id: locationId,
          line_items: [
            {
              name: `Invoice #${invoiceNumber}`,
              quantity: '1',
              base_price_money: {
                amount: Math.round(amount * 100), // cents
                currency: 'USD'
              }
            }
          ]
        }
      }
    };

    console.log('Checkout request:', JSON.stringify(checkoutRequest, null, 2));

    // Create a checkout
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
    
    console.log('Checkout response status:', checkoutResponse.status);
    console.log('Checkout response data:', JSON.stringify(checkoutData, null, 2));
    
    if (checkoutData.errors) {
      console.error('Square API errors:', checkoutData.errors);
      const errorDetails = checkoutData.errors.map((e: any) => 
        `${e.code}: ${e.detail} (field: ${e.field})`
      ).join(', ');
      throw new Error(errorDetails);
    }

    return {
      success: true,
      checkoutUrl: checkoutData.checkout?.checkout_page_url,
      checkoutId: checkoutData.checkout?.id
    };

  } catch (error: any) {
    console.error('Square API Error:', error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { invoiceNumber, amount, customerEmail, customerName } = body;

    console.log('Creating Square checkout via direct API...');

    const result = await createSquareCheckout(
      invoiceNumber,
      amount,
      customerEmail,
      customerName
    );

    if (result.checkoutUrl) {
      return NextResponse.json({
        success: true,
        checkoutUrl: result.checkoutUrl,
        checkoutId: result.checkoutId,
        message: '✅ SUCCESS! Checkout created!'
      });
    }

    throw new Error('No checkout URL received');

  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create checkout'
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Square Direct API endpoint ready',
    info: 'This uses Square REST API directly without SDK'
  });
}