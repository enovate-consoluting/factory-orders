import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { invoiceId, recipientEmail, ccEmails = [] } = await request.json();
    
    if (!invoiceId || !recipientEmail) {
      return NextResponse.json(
        { error: 'Invoice ID and recipient email are required' },
        { status: 400 }
      );
    }

    const supabase = createRouteHandlerClient({ cookies });

    // Fetch invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        order:orders(
          order_number,
          order_name,
          client:clients(name, email),
          order_products(
            id,
            product:products(title),
            sample_fee,
            product_price,
            order_items(quantity)
          )
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Generate invoice HTML
    const invoiceHtml = generateInvoiceHtml(invoice);

    // Send email
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'invoices@yourdomain.com',
      to: recipientEmail,
      cc: ccEmails,
      subject: `Invoice ${invoice.invoice_number} - ${invoice.order.order_name || invoice.order.order_number}`,
      html: invoiceHtml,
    });

    if (error) {
      console.error('Error sending email:', error);
      return NextResponse.json(
        { error: 'Failed to send email' },
        { status: 500 }
      );
    }

    // Update invoice status to 'sent'
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ 
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_to: recipientEmail
      })
      .eq('id', invoiceId);

    if (updateError) {
      console.error('Error updating invoice status:', updateError);
    }

    // Update product payment status if configured to mark as paid on send
    if (invoice.mark_as_paid_on_send) {
      const productIds = invoice.order.order_products.map((p: any) => p.id);
      
      const { error: paymentError } = await supabase
        .from('order_products')
        .update({
          payment_status: 'paid',
          paid_amount: invoice.amount
        })
        .in('id', productIds);

      if (paymentError) {
        console.error('Error updating payment status:', paymentError);
      }
    }

    return NextResponse.json({ 
      success: true, 
      emailId: data?.id,
      message: 'Invoice sent successfully'
    });

  } catch (error) {
    console.error('Error in send invoice API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateInvoiceHtml(invoice: any): string {
  const { order } = invoice;
  
  // Calculate totals
  let itemsHtml = '';
  let subtotal = 0;
  
  order.order_products.forEach((product: any) => {
    const totalQty = product.order_items.reduce((sum: number, item: any) => 
      sum + item.quantity, 0
    );
    
    // Add sample fee if exists
    if (product.sample_fee > 0) {
      itemsHtml += `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #f0f0f0;">
            ${product.product.title} - Sample Fee
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; text-align: center;">1</td>
          <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; text-align: right;">$${product.sample_fee}</td>
          <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; text-align: right;">$${product.sample_fee}</td>
        </tr>
      `;
      subtotal += parseFloat(product.sample_fee);
    }
    
    // Add production if exists
    if (product.product_price > 0 && totalQty > 0) {
      const lineTotal = product.product_price * totalQty;
      itemsHtml += `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #f0f0f0;">
            ${product.product.title} - Production
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; text-align: center;">${totalQty}</td>
          <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; text-align: right;">$${product.product_price}</td>
          <td style="padding: 12px; border-bottom: 1px solid #f0f0f0; text-align: right;">$${lineTotal.toFixed(2)}</td>
        </tr>
      `;
      subtotal += lineTotal;
    }
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Invoice ${invoice.invoice_number}</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px;">
      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="color: #1e40af; margin: 0;">INVOICE</h1>
        <p style="color: #666; margin: 5px 0;">Invoice Number: ${invoice.invoice_number}</p>
        <p style="color: #666; margin: 5px 0;">Date: ${new Date().toLocaleDateString()}</p>
      </div>

      <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
        <div>
          <h3 style="color: #333; margin-bottom: 10px;">From:</h3>
          <p style="margin: 5px 0;">Your Company Name</p>
          <p style="margin: 5px 0;">Your Address</p>
          <p style="margin: 5px 0;">Your Email</p>
        </div>
        
        <div>
          <h3 style="color: #333; margin-bottom: 10px;">Bill To:</h3>
          <p style="margin: 5px 0;">${order.client.name}</p>
          <p style="margin: 5px 0;">${order.client.email}</p>
        </div>
      </div>

      <div style="margin-bottom: 40px;">
        <h3 style="color: #333; margin-bottom: 10px;">Order Details:</h3>
        <p style="margin: 5px 0;">Order Number: ${order.order_number}</p>
        <p style="margin: 5px 0;">Order Name: ${order.order_name || 'N/A'}</p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
        <thead>
          <tr style="background-color: #f8f8f8;">
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #1e40af;">Item</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #1e40af;">Quantity</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #1e40af;">Unit Price</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #1e40af;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="padding: 12px; text-align: right; font-weight: bold;">Subtotal:</td>
            <td style="padding: 12px; text-align: right; font-weight: bold;">$${subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="3" style="padding: 12px; text-align: right; font-weight: bold; font-size: 1.2em; color: #1e40af;">Total Due:</td>
            <td style="padding: 12px; text-align: right; font-weight: bold; font-size: 1.2em; color: #1e40af;">$${invoice.amount}</td>
          </tr>
        </tfoot>
      </table>

      ${invoice.notes ? `
        <div style="margin-bottom: 40px;">
          <h3 style="color: #333; margin-bottom: 10px;">Notes:</h3>
          <p style="color: #666;">${invoice.notes}</p>
        </div>
      ` : ''}

      <div style="text-align: center; margin-top: 60px; padding-top: 20px; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 14px;">Thank you for your business!</p>
        <p style="color: #666; font-size: 12px;">Please remit payment within ${invoice.payment_terms || '30 days'}</p>
      </div>
    </body>
    </html>
  `;
}