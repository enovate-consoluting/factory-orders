import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { ManufacturerEmailTemplate } from '@/components/email/ManufacturerEmailTemplate'
import { supabase } from '@/lib/supabase'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    console.log('Manufacturer email API called')
    
    const { orderId, includeAttachments = true } = await request.json()
    console.log('Order ID:', orderId, 'Include Attachments:', includeAttachments)

    // Check if Resend is configured
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured')
      return NextResponse.json(
        { error: 'Email service not configured. Please add RESEND_API_KEY to environment variables.' },
        { status: 500 }
      )
    }

    if (!process.env.RESEND_FROM_EMAIL) {
      console.error('RESEND_FROM_EMAIL is not configured')
      return NextResponse.json(
        { error: 'From email not configured. Please add RESEND_FROM_EMAIL to environment variables.' },
        { status: 500 }
      )
    }

    // Fetch complete order details
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        client:clients(*),
        manufacturer:manufacturers(*),
        products:order_products(
          *,
          product:products(*),
          items:order_items(*),
          media:order_media(*)
        )
      `)
      .eq('id', orderId)
      .single()

    if (error || !order) {
      console.error('Order fetch error:', error)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    console.log('Order fetched successfully')
    console.log('Sending to:', order.manufacturer?.email)

    // For now, skip attachments to test basic email sending
    const attachments: any[] = []
    
    // TODO: Add attachment handling later
    // if (includeAttachments) {
    //   for (const product of order.products) {
    //     if (product.media && product.media.length > 0) {
    //       // Add attachment logic here
    //     }
    //   }
    // }

    // Generate HTML from React component
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
          ${require('react-dom/server').renderToStaticMarkup(
            ManufacturerEmailTemplate({ order })
          )}
        </body>
      </html>
    `

    console.log('Attempting to send email via Resend...')

    // Send email using Resend
    const { data, error: sendError } = await resend.emails.send({
      from: `BirdhausApp <${process.env.RESEND_FROM_EMAIL}>`,
      to: [order.manufacturer.email],
      subject: `New Order #${order.order_number} - ${order.client.name}`,
      html: emailHtml,
      attachments,
    })

    if (sendError) {
      console.error('Resend error:', sendError)
      return NextResponse.json({ error: sendError.message }, { status: 500 })
    }

    console.log('Email sent successfully:', data)

    // Optionally save to email_history table if it exists
    try {
      await supabase.from('email_history').insert({
        order_id: orderId,
        recipient_type: 'manufacturer',
        recipient_email: order.manufacturer.email,
        subject: `New Order #${order.order_number} - ${order.client.name}`,
        message_id: data?.id,
        status: 'sent',
      })
    } catch (historyError) {
      // Ignore if table doesn't exist
      console.log('Could not save to email_history (table might not exist)')
    }

    return NextResponse.json({ 
      success: true, 
      messageId: data?.id,
      recipient: order.manufacturer.email 
    })
  } catch (error) {
    console.error('Email send error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    )
  }
}