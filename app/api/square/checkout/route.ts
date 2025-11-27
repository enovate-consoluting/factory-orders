// app/api/square/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  console.log('=== Square Checkout API Called ===');
  
  try {
    const body = await req.json();
    const { invoiceNumber, amount, customerEmail, customerName } = body;
    
    console.log('Request data:', { invoiceNumber, amount, customerEmail, customerName });
    
    // Check if we have token
    if (!process.env.SQUARE_ACCESS_TOKEN) {
      throw new Error('Square access token not found in environment variables');
    }
    
    console.log('Token exists:', process.env.SQUARE_ACCESS_TOKEN?.substring(0, 10) + '...');
    
    // Import Square using require - THIS SHOULD WORK
    const squarePackage = require('square');
    console.log('Square SDK imported successfully');
    
    // Initialize client
    const squareClient = new squarePackage.Client({
      accessToken: process.env.SQUARE_ACCESS_TOKEN,
      environment: process.env.SQUARE_ENVIRONMENT === 'production' 
        ? 'production' 
        : 'sandbox'
    });
    console.log('Square client initialized');

    // First, try to get locations
    console.log('Fetching locations...');
    try {
      const locationsResponse = await squareClient.locationsApi.listLocations();
      console.log('Locations found:', locationsResponse.result.locations?.length || 0);
      
      const location = locationsResponse.result.locations?.[0];
      const locationId = location?.id || 'main';
      
      console.log('Using location:', locationId);
      
      // Try the simpler createCheckout first
      const checkoutRequest = {
        idempotencyKey: `invoice-${invoiceNumber}-${Date.now()}`,
        order: {
          locationId: locationId,
          lineItems: [
            {
              name: `Invoice #${invoiceNumber}`,
              quantity: '1',
              basePriceMoney: {
                amount: Math.round(amount * 100), // Convert to cents
                currency: 'USD'
              }
            }
          ]
        }
      };
      
      const checkoutResponse = await squareClient.checkoutApi.createCheckout(
        locationId,
        checkoutRequest
      );

      if (checkoutResponse.result.checkout) {
        return NextResponse.json({
          success: true,
          checkoutUrl: checkoutResponse.result.checkout.checkoutPageUrl,
          checkoutId: checkoutResponse.result.checkout.id,
          locationUsed: locationId,
          message: 'Checkout created successfully'
        });
      }
    } catch (apiError: any) {
      console.error('Square API call error:', apiError);
      
      // If locations fail, try without
      if (apiError.message?.includes('location')) {
        console.log('Trying without location...');
        
        // Try creating a payment link instead
        const paymentLinkRequest = {
          idempotencyKey: `payment-${invoiceNumber}-${Date.now()}`,
          quickPay: {
            name: `Invoice #${invoiceNumber}`,
            priceMoney: {
              amount: Math.round(amount * 100),
              currency: 'USD'
            },
            locationId: 'main'
          }
        };
        
        const paymentResponse = await squareClient.checkoutApi.createPaymentLink(paymentLinkRequest);
        
        if (paymentResponse.result.paymentLink) {
          return NextResponse.json({
            success: true,
            checkoutUrl: paymentResponse.result.paymentLink.url,
            checkoutId: paymentResponse.result.paymentLink.id,
            message: 'Payment link created (fallback)'
          });
        }
      }
      
      throw apiError;
    }

    throw new Error('Failed to create checkout - no URL returned');

  } catch (error: any) {
    console.error('Square Checkout Error Full:', error);
    console.error('Error stack:', error.stack);
    
    // Extract meaningful error
    let errorMessage = 'Unknown error';
    let errorDetails = {};
    
    if (error.result?.errors) {
      errorMessage = error.result.errors.map((e: any) => e.detail || e.code).join(', ');
      errorDetails = error.result.errors;
    } else if (error.errors) {
      errorMessage = error.errors.map((e: any) => e.detail || e.code).join(', ');
      errorDetails = error.errors;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      details: errorDetails,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

// Simple test endpoint
export async function GET(req: NextRequest) {
  try {
    // Quick test of Square import
    const squarePackage = require('square');
    const hasClient = !!squarePackage.Client;
    
    return NextResponse.json({
      success: true,
      message: 'Square Checkout API endpoint ready',
      squareLoaded: hasClient,
      testUrl: '/api/square/checkout (POST)',
      requiredFields: ['invoiceNumber', 'amount', 'customerEmail', 'customerName']
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Square SDK not loading properly',
      details: error.message
    });
  }
}