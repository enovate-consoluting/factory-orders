/**
 * SSO Token Verification API
 * Verifies JWT tokens from Admin app
 * Last Modified: January 2026
 */

import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SSO_SECRET = new TextEncoder().encode(
  process.env.SSO_SECRET || 'birdhaus-sso-secret-key-change-in-production'
);

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token required' },
        { status: 400 }
      );
    }

    // Verify the token
    const { payload } = await jwtVerify(token, SSO_SECRET);

    // Return user data from token
    return NextResponse.json({
      success: true,
      user: {
        id: payload.id,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      },
    });
  } catch (error) {
    console.error('SSO verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Invalid or expired token' },
      { status: 401 }
    );
  }
}
