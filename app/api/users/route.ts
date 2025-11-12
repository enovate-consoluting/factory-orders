// app/api/users/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Check if service role key exists
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables')
  console.error('Make sure it exists in both .env.local.dev and .env.local.prod files')
}

// Create admin client with service role key (bypasses RLS)
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY 
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  : null

export async function POST(request: Request) {
  // Check if admin client is available
  if (!supabaseAdmin) {
    return NextResponse.json(
      { 
        error: 'Server configuration error', 
        details: 'SUPABASE_SERVICE_ROLE_KEY not configured. Add it to your .env.local.dev and .env.local.prod files.' 
      }, 
      { status: 500 }
    )
  }

  try {
  const { email, password, name, role, userType, createdBy } = await request.json()

    // Validate userType
    if (!userType || !['admin', 'manufacturer', 'client'].includes(userType)) {
      return NextResponse.json({ 
        error: 'Invalid user type',
        details: 'userType must be one of: admin, manufacturer, client'
      }, { status: 400 })
    }

    console.log('Creating user:', { email, name, role, userType })

    // Step 1: Create auth user using admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name,
        role
      }
    })

    if (authError) {
      console.error('Auth error:', authError)
      // Check for specific error messages
      if (authError.message?.includes('already been registered')) {
        return NextResponse.json({ 
          error: 'A user with this email address has already been registered',
          details: 'Email already exists in the system'
        }, { status: 400 })
      }
      return NextResponse.json({ 
        error: authError.message,
        details: 'Failed to create authentication user'
      }, { status: 400 })
    }

    console.log('Auth user created:', authData.user.id)

    // Step 2: Insert into users table with service role (bypasses RLS)
    const userInsertData: any = {
      id: authData.user.id,
      email,
      name,
      role,
      password
    };
    if (createdBy) {
      userInsertData.created_by = createdBy;
    }
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .insert(userInsertData)
      .select()
      .single()

    if (userError) {
      console.error('Database error:', userError)
      // If users table insert fails, delete the auth user we just created
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ 
        error: userError.message,
        details: 'Failed to create user record in database. Auth user was rolled back.'
      }, { status: 400 })
    }

    // Step 3: Create additional records based on userType
    if (userType === 'manufacturer') {
      const { error: manuError } = await supabaseAdmin
        .from('manufacturers')
        .insert({
          name,
          email,
          user_id: authData.user.id
        })

      if (manuError) {
        console.error('Manufacturer creation error:', manuError)
        // Rollback: delete user and auth user
        await supabaseAdmin.from('users').delete().eq('id', authData.user.id)
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return NextResponse.json({ 
          error: manuError.message,
          details: 'Failed to create manufacturer record. All changes rolled back.'
        }, { status: 400 })
      }
      console.log('Manufacturer record created')
    } else if (userType === 'client') {
      const { error: clientError } = await supabaseAdmin
        .from('clients')
        .insert({
          name,
          email,
          user_id: authData.user.id
        })

      if (clientError) {
        console.error('Client creation error:', clientError)
        // Rollback: delete user and auth user
        await supabaseAdmin.from('users').delete().eq('id', authData.user.id)
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return NextResponse.json({ 
          error: clientError.message,
          details: 'Failed to create client record. All changes rolled back.'
        }, { status: 400 })
      }
      console.log('Client record created')
    }

    console.log('User creation completed successfully')
    return NextResponse.json({ 
      user: userData,
      userType 
    }, { status: 201 })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ 
      error: error.message || 'An unexpected error occurred',
      details: 'Check server logs for more information'
    }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server configuration error' }, 
      { status: 500 }
    )
  }

  try {
    const { userId, userType } = await request.json()

    // Step 1: Delete from related table first if applicable
    if (userType === 'manufacturer') {
      const { error } = await supabaseAdmin
        .from('manufacturers')
        .delete()
        .eq('user_id', userId)
      
      if (error) {
        console.error('Error deleting manufacturer:', error)
      }
    } else if (userType === 'client') {
      const { error } = await supabaseAdmin
        .from('clients')
        .delete()
        .eq('user_id', userId)
      
      if (error) {
        console.error('Error deleting client:', error)
      }
    }

    // Step 2: Delete from users table (with service role to bypass RLS)
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId)

    if (dbError) {
      console.error('Error deleting from users table:', dbError)
    }

    // Step 3: Delete auth user
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (authError) {
      console.error('Error deleting auth user:', authError)
      return NextResponse.json({ 
        error: authError.message,
        details: 'Failed to delete authentication user'
      }, { status: 400 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('Delete error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to delete user'
    }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server configuration error' }, 
      { status: 500 }
    )
  }

  try {
    const { userId, updates, userType } = await request.json()

    // Update users table with service role (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('Update error:', error)
      return NextResponse.json({ 
        error: error.message,
        details: 'Failed to update user record'
      }, { status: 400 })
    }

    // If name changed, update the related table too
    if (updates.name || updates.email) {
      if (userType === 'manufacturer') {
        const { error: manuError } = await supabaseAdmin
          .from('manufacturers')
          .update({ 
            name: updates.name || data.name,
            email: updates.email || data.email 
          })
          .eq('user_id', userId)

        if (manuError) {
          console.error('Manufacturer update error:', manuError)
        }
      } else if (userType === 'client') {
        const { error: clientError } = await supabaseAdmin
          .from('clients')
          .update({ 
            name: updates.name || data.name,
            email: updates.email || data.email 
          })
          .eq('user_id', userId)

        if (clientError) {
          console.error('Client update error:', clientError)
        }
      }
    }

    // If email changed, update auth user too (rarely needed since email usually can't be changed)
    if (updates.email) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        userId, 
        { email: updates.email }
      )
      
      if (authError) {
        console.error('Auth update error:', authError)
        // Revert database change if auth update fails
        await supabaseAdmin
          .from('users')
          .update({ email: data.email }) // revert to old email
          .eq('id', userId)
        
        return NextResponse.json({ 
          error: authError.message,
          details: 'Failed to update authentication email'
        }, { status: 400 })
      }
    }

    return NextResponse.json({ user: data }, { status: 200 })
  } catch (error: any) {
    console.error('Update error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to update user'
    }, { status: 500 })
  }
}