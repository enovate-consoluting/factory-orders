/**
 * SSO Token Generation API
 * Generates JWT token for SSO to Admin app
 * Last Modified: January 2026
 */

import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';

const SSO_SECRET = new TextEncoder().encode(
  process.env.SSO_SECRET || 'birdhaus-sso-secret-key-change-in-production'
);

export async function POST(request: Request) {
  try {
    const { user } = await request.json();

    if (!user || !user.id || !user.email) {
      return NextResponse.json(
        { success: false, error: 'Invalid user data' },
        { status: 400 }
      );
    }

    // Only allow admin roles to switch to Admin portal
    if (user.role !== 'super_admin' && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Create short-lived JWT token (30 seconds)
    const token = await new SignJWT({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30s')
      .sign(SSO_SECRET);

    return NextResponse.json({ success: true, token });
  } catch (error) {
    console.error('SSO token generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
