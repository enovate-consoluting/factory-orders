import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { ClientEmailTemplate } from '@/components/email/ClientEmailTemplate'
import { supabase } from '@/lib/supabase'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    console.log('Client email API called')
    
    const { 
      orderId, 
      customMessage, 
      showPricing = false,
      subject 
    } = await request.json()
    
    console.log('Order ID:', orderId)

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

    // Fetch order details
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        client:clients(*),
        products:order_products(
          *,
          items:order_items(*)
        )
      `)
      .eq('id', orderId)
      .single()

    if (error || !order) {
      console.error('Order fetch error:', error)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    console.log('Order fetched successfully')
    console.log('Sending to:', order.client?.email)

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
            ClientEmailTemplate({ 
              order, 
              message: customMessage,
              showPricing 
            })
          )}
        </body>
      </html>
    `

    console.log('Attempting to send email via Resend...')

    // Send email using Resend
    const { data, error: sendError } = await resend.emails.send({
      from: `BirdhausApp <${process.env.RESEND_FROM_EMAIL}>`,
      to: [order.client.email],
      subject: subject || `Update on Order #${order.order_number}`,
      html: emailHtml,
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
        recipient_type: 'client',
        recipient_email: order.client.email,
        subject: subject || `Update on Order #${order.order_number}`,
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
      recipient: order.client.email
    })
  } catch (error) {
    console.error('Email send error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    )
  }
}