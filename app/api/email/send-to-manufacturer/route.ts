import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabase } from '@/lib/supabase'

// Handle missing API key gracefully
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function POST(request: NextRequest) {
  try {
    console.log('Manufacturer email API called')
    
    // Check if Resend is configured
    if (!resend) {
      console.warn('Resend API key not configured - skipping email')
      return NextResponse.json({ 
        success: false, 
        message: 'Email service not configured',
        warning: 'RESEND_API_KEY not set'
      })
    }
    
    const { orderId, includeAttachments = true } = await request.json()

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
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Calculate totals
    const totalItems = order.products.reduce((sum: number, product: any) => 
      sum + product.items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0), 0
    , 0)

    // Prepare attachments if requested
    const attachments: any[] = []
    if (includeAttachments) {
      console.log('Processing attachments...')
      
      for (const product of order.products) {
        if (product.media && product.media.length > 0) {
          console.log(`Product ${product.product_order_number} has ${product.media.length} media files`)
          
          for (const media of product.media) {
            try {
              // Use public URL to fetch the file
              const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/order-media/${media.file_url}`
              console.log(`Fetching from public URL: ${publicUrl}`)
              
              // Fetch the file using the public URL
              const response = await fetch(publicUrl)
              
              if (!response.ok) {
                console.error(`Failed to fetch file: ${response.status} ${response.statusText}`)
                continue
              }
              
              // Get the file as buffer
              const arrayBuffer = await response.arrayBuffer()
              const buffer = Buffer.from(arrayBuffer)
              const fileName = media.file_url.split('/').pop() || 'attachment'
              
              // Add to attachments array
              attachments.push({
                filename: `${product.product_order_number}_${fileName}`,
                content: buffer.toString('base64'),
                encoding: 'base64'
              })
              
              console.log(`Successfully prepared attachment: ${fileName} (${buffer.length} bytes)`)
            } catch (err) {
              console.error('Error processing attachment:', media.file_url, err)
            }
          }
        }
      }
      
      console.log(`Total attachments prepared: ${attachments.length}`)
    }

    // Build product details HTML
    let productsHtml = ''
    for (const product of order.products) {
      productsHtml += `
        <div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
          <h3 style="color: #333; margin-top: 0;">
            ${product.product.title} 
            <span style="color: #666; font-size: 14px;">(${product.product_order_number})</span>
          </h3>
          ${product.product.description ? `<p style="color: #666; font-size: 14px;">${product.product.description}</p>` : ''}
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr style="background-color: #e0e0e0;">
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Variant</th>
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Quantity</th>
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Notes</th>
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${product.items.map((item: any) => `
                <tr>
                  <td style="padding: 8px; border: 1px solid #ddd;">${item.variant_combo}</td>
                  <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
                  <td style="padding: 8px; border: 1px solid #ddd; color: #666; font-size: 13px;">
                    ${item.notes || '-'}
                  </td>
                  <td style="padding: 8px; border: 1px solid #ddd;">
                    <span style="color: ${item.admin_status === 'approved' ? 'green' : item.admin_status === 'rejected' ? 'red' : 'orange'};">
                      ${item.admin_status}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          ${product.media && product.media.length > 0 ? `
            <div style="margin-top: 15px; padding: 10px; background: #e8f4f8; border-radius: 5px;">
              <strong style="color: #333;">📎 Reference Files:</strong>
              <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                ${product.media.map((media: any) => {
                  const fileName = media.file_url.split('/').pop()
                  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/order-media/${media.file_url}`
                  return `
                    <li style="margin: 5px 0;">
                      <a href="${publicUrl}" style="color: #667eea; text-decoration: none;">
                        ${fileName}
                      </a>
                    </li>
                  `
                }).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `
    }

    // Build attachment list HTML
    let attachmentListHtml = ''
    if (attachments.length > 0) {
      attachmentListHtml = `
        <div style="background: #e8f4f8; padding: 15px; border-radius: 5px; margin-top: 20px;">
          <strong>📎 Attachments:</strong> ${attachments.length} file(s) attached to this email
          <ul style="margin: 10px 0 0 20px; color: #666;">
            ${attachments.map(att => `<li>${att.filename}</li>`).join('')}
          </ul>
        </div>
      `
    }

    // Complete HTML email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
          .info-box { background: #f8f9fa; padding: 15px; border-radius: 5px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">New Factory Order</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Order #${order.order_number}</p>
          </div>
          
          <div class="content">
            <h2 style="color: #667eea; margin-top: 0;">Order Information</h2>
            
            <div class="info-grid">
              <div class="info-box">
                <strong>Client:</strong><br>
                ${order.client.name}<br>
                ${order.client.email}
              </div>
              <div class="info-box">
                <strong>Order Details:</strong><br>
                Date: ${new Date(order.created_at).toLocaleDateString()}<br>
                Total Items: ${totalItems}<br>
                Status: ${order.status}
              </div>
            </div>

            <h2 style="color: #667eea; margin-top: 30px;">Products</h2>
            ${productsHtml}

            ${attachmentListHtml}

            <div style="text-align: center; margin-top: 30px; padding-top: 30px; border-top: 1px solid #e0e0e0;">
              <p style="color: #666;">Please review the order details and set your pricing.</p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/orders/${order.id}" 
                 class="button" 
                 style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View Full Order Details
              </a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `

    console.log(`Sending email to: ${order.manufacturer.email}`)
    console.log(`Attachments: ${attachments.length}`)

    // Send email
    const { data, error: sendError } = await resend.emails.send({
      from: `BirdhausApp <${process.env.RESEND_FROM_EMAIL}>`,
      to: [order.manufacturer.email],
      subject: `New Order #${order.order_number} - ${order.client.name}`,
      html: emailHtml,
      attachments: attachments.length > 0 ? attachments : undefined,
    })

    if (sendError) {
      console.error('Resend error:', sendError)
      return NextResponse.json({ error: sendError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      messageId: data?.id,
      attachmentCount: attachments.length
    })
    
  } catch (error) {
    console.error('Email error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    )
  }
}