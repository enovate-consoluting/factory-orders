// app/api/users/route.ts
import { NextResponse } from 'next/server'
import { syncClientToPortal } from '@/lib/client-portal/api'
import { getSupabaseAdmin, isAdminClientAvailable, hashPassword } from '@/lib/auth'

export async function POST(request: Request) {
  // Check if admin client is available
  if (!isAdminClientAvailable()) {
    return NextResponse.json(
      {
        error: 'Server configuration error',
        details: 'SUPABASE_SERVICE_ROLE_KEY not configured. Add it to your .env.local.dev and .env.local.prod files.'
      },
      { status: 500 }
    )
  }

  const supabaseAdmin = getSupabaseAdmin()

  try {
  const { email, password, name, role, userType, createdBy, phone_number, logo_url, logo } = await request.json()

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
      // phone_number,
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

    // Hash the password before storing
    const hashedPassword = await hashPassword(password)

    // Step 2: Insert into users table with service role (bypasses RLS)
    const userInsertData: any = {
      id: authData.user.id,
      email,
      name,
      role,
      password: hashedPassword,
      phone_number,
      logo_url
    };
    if (createdBy) {
      userInsertData.created_by = createdBy;
      // For manufacturer-created roles, also set manufacturer_id so they can access manufacturer data
      if (['manufacturer_team_member', 'sub_manufacturer', 'manufacturer_inventory_manager'].includes(role)) {
        userInsertData.manufacturer_id = createdBy;
      }
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
          phone_number,
          logo_url,
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
          phone_number,
          logo_url,
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

      // Step 4: Sync client to Client Portal
      console.log('Syncing client to Client Portal...')
      const portalResult = await syncClientToPortal({
        name,
        email,
        phone_number: phone_number || undefined,
        logo_url: logo_url || null
      })

      if (!portalResult.success) {
        console.error('Client Portal sync error:', portalResult.error)
        // Note: We don't rollback the local client creation if Portal sync fails
        // The client is still created locally, but we log the error
        console.warn('Client created locally but failed to sync with Client Portal:', portalResult.error)
      } else {
        console.log('Client successfully synced to Client Portal')
      }
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
  if (!isAdminClientAvailable()) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    )
  }

  const supabaseAdmin = getSupabaseAdmin()

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
  if (!isAdminClientAvailable()) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    )
  }

  const supabaseAdmin = getSupabaseAdmin()

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

    // If name, email, phone_number, or logo_url changed, update the related table too
    if (updates.name || updates.email || updates.phone_number !== undefined || updates.logo_url !== undefined) {
      if (userType === 'manufacturer') {
        const updateData: any = {}
        if (updates.name) updateData.name = updates.name
        if (updates.email) updateData.email = updates.email
        if (updates.phone_number !== undefined) updateData.phone_number = updates.phone_number
        if (updates.logo_url !== undefined) updateData.logo_url = updates.logo_url

        const { error: manuError } = await supabaseAdmin
          .from('manufacturers')
          .update(updateData)
          .eq('user_id', userId)

        if (manuError) {
          console.error('Manufacturer update error:', manuError)
        }
      } else if (userType === 'client') {
        const updateData: any = {}
        if (updates.name) updateData.name = updates.name
        if (updates.email) updateData.email = updates.email
        if (updates.phone_number !== undefined) updateData.phone_number = updates.phone_number
        if (updates.logo_url !== undefined) updateData.logo_url = updates.logo_url

        const { error: clientError } = await supabaseAdmin
          .from('clients')
          .update(updateData)
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