// app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { supabase, verifyPassword } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Fetch user from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password (handles both hashed and legacy plain text)
    const isValid = await verifyPassword(password, userData.password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Build user object (exclude password)
    const user = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      phone_number: userData.phone_number,
      logo_url: userData.logo_url,
      manufacturer_id: userData.manufacturer_id,
      created_by: userData.created_by,
      created_at: userData.created_at,
      updated_at: userData.updated_at,
    };

    // For manufacturers, fetch manufacturer_id from manufacturers table
    if (user.role === 'manufacturer' && !user.manufacturer_id) {
      const { data: manufacturerData } = await supabase
        .from('manufacturers')
        .select('id')
        .eq('email', email.toLowerCase().trim())
        .single();

      if (manufacturerData) {
        user.manufacturer_id = manufacturerData.id;
      }
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred during authentication' },
      { status: 500 }
    );
  }
}
