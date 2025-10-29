import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    // Get environment variables at runtime, not build time
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Check if environment variables are available
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment variables:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey
      });
      
      return NextResponse.json(
        { error: 'Server configuration error. Please check environment variables.' },
        { status: 500 }
      );
    }

    // Initialize Supabase Admin client only when the function is called
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Parse request body
    const { email, password, name, role, is_active } = await request.json();

    // Validate required fields
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    console.log('Creating user in Auth with email:', email);

    // Step 1: Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: name,
        role: role
      }
    });

    if (authError) {
      console.error('Auth creation error:', authError);
      
      // Handle specific error cases
      if (authError.message?.includes('already registered')) {
        return NextResponse.json(
          { error: 'A user with this email already exists' },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: authError.message || 'Failed to create user in authentication system' },
        { status: 400 }
      );
    }

    console.log('Auth user created successfully:', authData.user?.id);

    // Step 2: Create user record in the database
    const { data: dbData, error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user!.id,
        email: email,
        name: name,
        role: role || 'order_creator',
        is_active: is_active !== undefined ? is_active : true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database creation error:', dbError);
      
      // If database insert fails, try to clean up the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user!.id);
      
      return NextResponse.json(
        { error: 'Failed to create user record in database' },
        { status: 500 }
      );
    }

    console.log('User created successfully in both Auth and Database');

    return NextResponse.json({
      success: true,
      user: {
        id: dbData.id,
        email: dbData.email,
        name: dbData.name,
        role: dbData.role
      }
    });

  } catch (error) {
    console.error('Unexpected error in create user API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}