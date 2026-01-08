/**
 * API Route: /api/cleanup/old-drafts
 * Deletes draft orders older than 15 days
 * Can be called by a cron job or manually by super admin
 * Last Modified: January 2025
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Optional: Verify API key for cron jobs
    const authHeader = request.headers.get('authorization')
    const apiKey = process.env.CLEANUP_API_KEY

    // If API key is configured, require it
    if (apiKey && authHeader !== `Bearer ${apiKey}`) {
      // Also allow super admin users
      const userHeader = request.headers.get('x-user-role')
      if (userHeader !== 'super_admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Calculate date 15 days ago
    const fifteenDaysAgo = new Date()
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)
    const cutoffDate = fifteenDaysAgo.toISOString()

    console.log(`[Cleanup] Starting cleanup of drafts older than ${cutoffDate}`)

    // Find old draft orders
    const { data: oldDrafts, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, created_at')
      .eq('status', 'draft')
      .lt('created_at', cutoffDate)

    if (fetchError) {
      console.error('[Cleanup] Error fetching old drafts:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 })
    }

    if (!oldDrafts || oldDrafts.length === 0) {
      console.log('[Cleanup] No old drafts found')
      return NextResponse.json({
        success: true,
        message: 'No old drafts to clean up',
        deletedCount: 0
      })
    }

    console.log(`[Cleanup] Found ${oldDrafts.length} old drafts to delete`)

    const deletedOrders: string[] = []
    const errors: string[] = []

    // Delete each draft order with its related records
    for (const draft of oldDrafts) {
      try {
        const orderId = draft.id

        // Get order products
        const { data: orderProducts } = await supabaseAdmin
          .from('order_products')
          .select('id')
          .eq('order_id', orderId)

        const productIds = orderProducts?.map(p => p.id) || []

        // Delete related records in order (same cascade as manual delete)

        // Invoice items and invoices
        const { data: invoices } = await supabaseAdmin
          .from('invoices')
          .select('id')
          .eq('order_id', orderId)

        const invoiceIds = invoices?.map(i => i.id) || []
        if (invoiceIds.length > 0) {
          await supabaseAdmin.from('invoice_items').delete().in('invoice_id', invoiceIds)
        }
        await supabaseAdmin.from('invoices').delete().eq('order_id', orderId)

        // Email history
        await supabaseAdmin.from('email_history').delete().eq('order_id', orderId)

        // Order media
        if (productIds.length > 0) {
          await supabaseAdmin.from('order_media').delete().in('order_product_id', productIds)
        }
        await supabaseAdmin.from('order_media').delete().eq('order_id', orderId)

        // Order items
        if (productIds.length > 0) {
          await supabaseAdmin.from('order_items').delete().in('order_product_id', productIds)
        }

        // Order products
        await supabaseAdmin.from('order_products').delete().eq('order_id', orderId)

        // Notifications
        await supabaseAdmin.from('notifications').delete().eq('order_id', orderId)

        // Manufacturer notifications
        try {
          await supabaseAdmin.from('manufacturer_notifications').delete().eq('order_id', orderId)
        } catch (e) { /* table may not exist */ }

        // Manufacturer views
        try {
          await supabaseAdmin.from('manufacturer_views').delete().eq('order_id', orderId)
        } catch (e) { /* table may not exist */ }

        // Workflow log
        try {
          await supabaseAdmin.from('workflow_log').delete().eq('order_id', orderId)
        } catch (e) { /* table may not exist */ }

        // Order margins
        try {
          await supabaseAdmin.from('order_margins').delete().eq('order_id', orderId)
        } catch (e) { /* table may not exist */ }

        // Orders backup numbers
        try {
          await supabaseAdmin.from('orders_backup_numbers').delete().eq('order_id', orderId)
        } catch (e) { /* table may not exist */ }

        // Client admin notes
        try {
          await supabaseAdmin.from('client_admin_notes').delete().eq('order_id', orderId)
        } catch (e) { /* table may not exist */ }

        // Order accessories
        try {
          await supabaseAdmin.from('order_accessories').delete().eq('order_id', orderId)
        } catch (e) { /* table may not exist */ }

        // Audit log
        try {
          if (productIds.length > 0) {
            await supabaseAdmin
              .from('audit_log')
              .delete()
              .or(`target_id.eq.${orderId},target_id.in.(${productIds.join(',')})`)
          } else {
            await supabaseAdmin.from('audit_log').delete().eq('target_id', orderId)
          }
        } catch (e) { /* audit log may fail */ }

        // Finally delete the order
        const { error: deleteError } = await supabaseAdmin
          .from('orders')
          .delete()
          .eq('id', orderId)

        if (deleteError) {
          errors.push(`${draft.order_number}: ${deleteError.message}`)
        } else {
          deletedOrders.push(draft.order_number)
          console.log(`[Cleanup] Deleted draft: ${draft.order_number}`)
        }

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        errors.push(`${draft.order_number}: ${errorMsg}`)
        console.error(`[Cleanup] Error deleting ${draft.order_number}:`, err)
      }
    }

    console.log(`[Cleanup] Completed. Deleted: ${deletedOrders.length}, Errors: ${errors.length}`)

    return NextResponse.json({
      success: true,
      message: `Cleanup completed`,
      deletedCount: deletedOrders.length,
      deletedOrders,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('[Cleanup] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint for checking cleanup status / testing
export async function GET(request: NextRequest) {
  try {
    // Calculate date 15 days ago
    const fifteenDaysAgo = new Date()
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)
    const cutoffDate = fifteenDaysAgo.toISOString()

    // Count old draft orders
    const { count, error } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'draft')
      .lt('created_at', cutoffDate)

    if (error) {
      return NextResponse.json({ error: 'Failed to count drafts' }, { status: 500 })
    }

    return NextResponse.json({
      oldDraftCount: count || 0,
      cutoffDate,
      message: `Found ${count || 0} draft orders older than 15 days`
    })

  } catch (error) {
    console.error('[Cleanup] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
