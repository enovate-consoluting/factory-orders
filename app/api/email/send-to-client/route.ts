import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabase } from '@/lib/supabase'

// Handle missing API key gracefully
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function POST(request: NextRequest) {
  try {
    // Check if Resend is configured
    if (!resend) {
      console.warn('Resend API key not configured - skipping email')
      return NextResponse.json({ 
        success: false, 
        message: 'Email service not configured',
        warning: 'RESEND_API_KEY not set'
      })
    }
    
    const { orderId, customMessage, showPricing, subject } = await request.json()

    // Fetch order details
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        client:clients(*),
        products:order_products(
          *,
          product:products(*),
          items:order_items(*)
        )
      `)
      .eq('id', orderId)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Calculate totals
    const totalQuantity = order.products.reduce((sum: number, product: any) => 
      sum + product.items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0), 0
    , 0)

    let totalPrice = 0
    if (showPricing) {
      totalPrice = order.products.reduce((sum: number, product: any) => 
        sum + product.items.reduce((itemSum: number, item: any) => {
          const price = item.bulk_price || item.standard_price || 0
          return itemSum + (price * item.quantity)
        }, 0), 0
      )
    }

    // Build product summary
    let productSummaryHtml = ''
    for (const product of order.products) {
      const productTotal = product.items.reduce((sum: number, item: any) => sum + item.quantity, 0)
      productSummaryHtml += `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">${product.product.title}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: center;">${productTotal}</td>
        </tr>
      `
    }

    // Client-friendly HTML email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
          .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; }
          .status-badge { display: inline-block; padding: 5px 15px; background: #667eea; color: white; border-radius: 20px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Order Update</h1>
          </div>
          
          <div class="content">
            <p>Dear ${order.client.name},</p>
            
            ${customMessage ? `
              <div style="background: #f0f7ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
                ${customMessage}
              </div>
            ` : ''}
            
            <h2 style="color: #667eea;">Order Summary</h2>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Order Number:</strong> ${order.order_number}</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> <span class="status-badge">${order.status.toUpperCase()}</span></p>
              <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
            </div>

            <h3 style="color: #333;">Products</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #f0f0f0;">
                  <th style="padding: 10px; text-align: left;">Product</th>
                  <th style="padding: 10px; text-align: center;">Quantity</th>
                </tr>
              </thead>
              <tbody>
                ${productSummaryHtml}
              </tbody>
              <tfoot>
                <tr style="font-weight: bold; background-color: #f8f9fa;">
                  <td style="padding: 10px;">Total Items:</td>
                  <td style="padding: 10px; text-align: center;">${totalQuantity}</td>
                </tr>
                ${showPricing && totalPrice > 0 ? `
                  <tr style="font-weight: bold; background-color: #f0f7ff;">
                    <td style="padding: 10px;">Estimated Total:</td>
                    <td style="padding: 10px; text-align: center;">$${totalPrice.toFixed(2)}</td>
                  </tr>
                ` : ''}
              </tfoot>
            </table>

            <p style="margin-top: 30px; color: #666;">
              We'll keep you updated on the progress of your order. If you have any questions, please don't hesitate to contact us.
            </p>

            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              This is an automated message from BirdhausApp. Please do not reply to this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `

    console.log(`Sending email to: ${order.client.email}`)

    // Send email
    const { data, error: sendError } = await resend.emails.send({
      from: `BirdhausApp <${process.env.RESEND_FROM_EMAIL}>`,
      to: [order.client.email],
      subject: subject || `Update on Order #${order.order_number}`,
      html: emailHtml,
    })

    if (sendError) {
      return NextResponse.json({ error: sendError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, messageId: data?.id })
    
  } catch (error) {
    console.error('Email error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    )
  }
}