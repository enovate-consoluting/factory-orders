// app/api/square/check-env/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // Check what's actually loaded
  const token = process.env.SQUARE_ACCESS_TOKEN;
  const env = process.env.SQUARE_ENVIRONMENT;
  
  return NextResponse.json({
    hasToken: !!token,
    tokenPreview: token ? `${token.substring(0, 15)}...${token.substring(token.length - 5)}` : 'NOT SET',
    environment: env || 'NOT SET',
    locationId: process.env.SQUARE_LOCATION_ID || 'NOT SET',
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET',
    tokenLength: token ? token.length : 0,
    isProduction: env === 'production',
    isSandbox: env === 'sandbox'
  });
}