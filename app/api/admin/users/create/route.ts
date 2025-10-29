// app/api/admin/users/create/route.ts
// API route for creating users in both Supabase Auth and database

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase with service role key for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, role, is_active = true } = body;

    // Validate input
    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate password length (Supabase requires minimum 6 characters)
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Step 1: Create user in Supabase Auth with auto-confirm
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm so they can login immediately
      user_metadata: {
        name,
        role
      }
    });

    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'User creation failed' },
        { status: 500 }
      );
    }

    // Step 2: Create user record in your users table
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id, // Use the same ID from Auth
        email,
        name,
        role,
        is_active,
        created_at: new Date().toISOString()
      });

    if (dbError) {
      console.error('Database error:', dbError);
      
      // If database insert fails, delete the auth user to keep things in sync
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      
      return NextResponse.json(
        { error: 'Failed to create user record in database' },
        { status: 500 }
      );
    }

    // Log the action (if you have audit logging)
    try {
      const currentUser = { email: 'system', name: 'System' }; // Since this is admin action
      await supabaseAdmin
        .from('audit_log')
        .insert({
          user_id: authData.user.id,
          user_name: currentUser.name,
          action_type: 'CREATE_USER',
          target_type: 'users',
          target_id: authData.user.id,
          old_value: null,
          new_value: JSON.stringify({ email, name, role }),
          timestamp: new Date().toISOString()
        });
    } catch (logError) {
      // Don't fail if logging fails
      console.error('Audit log error:', logError);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name,
        role,
        is_active
      },
      message: 'User created successfully and can login immediately'
    });

  } catch (error: any) {
    console.error('User creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}