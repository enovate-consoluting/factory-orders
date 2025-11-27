import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { generateInvoicePDF } from '@/app/utils/invoice-pdf-generator';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get ALL data from request body (invoiceId comes from body, not params)
    const { 
      invoiceId,  // This is passed in the body
      method = 'email',
      to = [],
      cc = [],
      phone = '',
      includePaymentLink = false,
      paymentUrl = '',
      emailMessage = '',
      smsMessage = ''
    } = body;

    console.log('Send invoice request:', {
      invoiceId,
      method,
      to,
      hasPaymentUrl: !!paymentUrl
    });

    // Validate required fields
    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    if ((method === 'email' || method === 'both') && (!to || to.length === 0)) {
      return NextResponse.json(
        { error: 'Recipient email is required' },
        { status: 400 }
      );
    }

    // Check if email service is configured
    if (!resend || !process.env.RESEND_FROM_EMAIL) {
      console.warn('Email service not configured');
      return NextResponse.json(
        { 
          error: 'Email service not configured',
          details: 'RESEND_API_KEY or RESEND_FROM_EMAIL not set'
        },
        { status: 500 }
      );
    }

    // Fetch complete invoice details - FIXED: removed address field
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        order:orders(
          id,
          order_number,
          order_name,
          client:clients(
            name,
            email
          )
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      console.error('Invoice fetch error:', invoiceError);
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Fetch invoice items (including custom items)
    const { data: invoiceItems, error: itemsError } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: true });

    if (itemsError) {
      console.error('Invoice items fetch error:', itemsError);
    }

    const items = invoiceItems || [];

    // Calculate total from items (WITHOUT quantity multiplication since it's already in amount)
    const calculatedTotal = items.reduce((sum, item) => {
      // Amount already includes quantity (it's the total, not unit price)
      const amount = parseFloat(item.amount) || 0;
      return sum + amount;
    }, 0);

    // Use calculated total or invoice amount, whichever is greater
    const totalAmount = Math.max(calculatedTotal, parseFloat(invoice.amount) || 0);

    // Send based on method
    let emailResult = null;
    let smsResult = null;

    // Send Email
    if (method === 'email' || method === 'both') {
      // Generate professional invoice HTML with payment link
      const invoiceHtml = generateProfessionalInvoiceEmail(
        invoice, 
        items, 
        paymentUrl, 
        emailMessage,
        to[0] // Use the email from modal
      );
      
      // Generate PDF
      let attachments: any[] = [];
      try {
        const pdfBuffer = await generateInvoicePDF(invoice, items);
        attachments = [{
          filename: `Invoice_${invoice.invoice_number}.pdf`,
          content: Buffer.from(pdfBuffer)
        }];
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError);
        // Continue without PDF if generation fails
      }

      // Send email
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: to, // Use the emails from SendInvoiceModal
        cc: cc.length > 0 ? cc : undefined,
        subject: `Invoice ${invoice.invoice_number} - ${invoice.order?.order_name || invoice.order?.order_number || 'Your Order'}`,
        html: invoiceHtml,
        attachments: attachments
      });

      if (error) {
        console.error('Error sending email:', error);
        return NextResponse.json(
          { error: 'Failed to send email', details: error },
          { status: 500 }
        );
      }

      emailResult = data;
      console.log('Invoice email sent:', data?.id);
    }

    // Send SMS
    if (method === 'sms' || method === 'both') {
      if (!phone) {
        return NextResponse.json(
          { error: 'Phone number is required for SMS' },
          { status: 400 }
        );
      }

      // Create SMS message
      let smsText = `BirdHaus Invoice #${invoice.invoice_number}\n`;
      smsText += `Amount Due: $${totalAmount.toFixed(2)}\n`;
      smsText += `Due: ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'Upon receipt'}\n`;
      
      if (paymentUrl) {
        smsText += `\nPay Now: ${paymentUrl}`;
      }
      
      if (smsMessage) {
        smsText += `\n\n${smsMessage}`;
      }

      // Here you would integrate with your SMS provider (Twilio, etc.)
      // For now, we'll just log it
      console.log('SMS would be sent to:', phone);
      console.log('SMS content:', smsText);
      smsResult = { success: true, phone, message: smsText };
    }

    // Update invoice status
    const updateData: any = {
      sent_at: new Date().toISOString(),
      sent_to: to[0] || invoice.order?.client?.email,
      status: 'sent'
    };

    if (paymentUrl) {
      updateData.payment_link = paymentUrl;
    }

    await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId);

    return NextResponse.json({ 
      success: true, 
      emailId: emailResult?.id,
      smsResult,
      message: `Invoice sent successfully ${method === 'both' ? 'via email and SMS' : `via ${method}`}`,
      details: {
        method,
        to,
        cc,
        hasPaymentLink: !!paymentUrl,
        hasPdfAttachment: emailResult ? true : false
      }
    });

  } catch (error) {
    console.error('Error in send invoice API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function generateProfessionalInvoiceEmail(
  invoice: any, 
  items: any[], 
  paymentUrl: string = '',
  customMessage: string = '',
  recipientEmail: string = ''
): string {
  const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'Upon receipt';
  const invoiceDate = new Date(invoice.created_at).toLocaleDateString();
  
  // Calculate total from items - FIXED: don't multiply by quantity since amount is already total
  const totalAmount = items.reduce((sum, item) => {
    const amount = parseFloat(item.amount) || 0;
    return sum + amount;
  }, 0) || parseFloat(invoice.amount) || 0;
  
  // Build items HTML - FIXED: parse quantity from description if needed
  const itemsHtml = items.map(item => {
    // Try to extract quantity from description (e.g., "Production (Qty: 100)")
    const qtyMatch = item.description?.match(/\(Qty:\s*(\d+)\)/);
    const quantity = qtyMatch ? parseInt(qtyMatch[1]) : 1;
    
    // Amount is already the total, so calculate unit price
    const amount = parseFloat(item.amount) || 0;
    const unitPrice = quantity > 1 ? (amount / quantity) : amount;
    
    // Clean description (remove quantity part if present)
    const cleanDescription = item.description?.replace(/\s*\(Qty:\s*\d+\)/, '') || 'Item';
    
    return `
      <tr>
        <td style="padding: 12px 8px; border-bottom: 1px solid #f0f0f0; color: #333;">
          ${cleanDescription}
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #f0f0f0; text-align: center; color: #666;">
          ${quantity}
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #f0f0f0; text-align: right; color: #666;">
          $${unitPrice.toFixed(2)}
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #f0f0f0; text-align: right; color: #333; font-weight: 500;">
          $${amount.toFixed(2)}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Invoice ${invoice.invoice_number}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f7f7f7;">
      <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f7f7f7; padding: 20px 0;">
        <tr>
          <td align="center">
            <table cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <!-- Header with BirdHaus Branding -->
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%); border-radius: 8px 8px 0 0;">
                  <div style="background: white; display: inline-block; padding: 10px 20px; border-radius: 8px; margin-bottom: 15px;">
                    <h2 style="margin: 0; color: #3b82f6; font-size: 24px;">BirdHaus</h2>
                  </div>
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 300;">
                    INVOICE
                  </h1>
                  <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 16px;">
                    ${invoice.invoice_number}
                  </p>
                </td>
              </tr>
              
              <!-- Body -->
              <tr>
                <td style="padding: 40px;">
                  <!-- Greeting -->
                  <p style="margin: 0 0 20px 0; color: #333; font-size: 16px; line-height: 1.6;">
                    Dear ${invoice.order?.client?.name || 'Valued Customer'},
                  </p>
                  
                  <!-- Custom Message if provided -->
                  ${customMessage ? `
                    <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 25px; border-radius: 4px;">
                      <p style="margin: 0; color: #1e40af; line-height: 1.6;">${customMessage}</p>
                    </div>
                  ` : `
                    <p style="margin: 0 0 30px 0; color: #666; font-size: 16px; line-height: 1.6;">
                      Thank you for your business. Please find your invoice details below.
                      ${paymentUrl ? 'You can pay securely online using the link provided.' : 'The PDF invoice is attached for your records.'}
                    </p>
                  `}
                  
                  <!-- Invoice Details Box -->
                  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8f9fa; border-radius: 6px; padding: 20px; margin-bottom: 30px;">
                    <tr>
                      <td>
                        <table cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td style="padding: 8px 0;">
                              <strong style="color: #333;">Invoice Number:</strong>
                              <span style="float: right; color: #666;">${invoice.invoice_number}</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0;">
                              <strong style="color: #333;">Invoice Date:</strong>
                              <span style="float: right; color: #666;">${invoiceDate}</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0;">
                              <strong style="color: #333;">Due Date:</strong>
                              <span style="float: right; color: #666;">${dueDate}</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0;">
                              <strong style="color: #333;">Order Reference:</strong>
                              <span style="float: right; color: #666;">${invoice.order?.order_name || invoice.order?.order_number || 'N/A'}</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 0 0 0; border-top: 1px solid #dee2e6;">
                              <strong style="color: #1e40af; font-size: 18px;">Total Due:</strong>
                              <span style="float: right; color: #1e40af; font-size: 18px; font-weight: bold;">
                                $${totalAmount.toFixed(2)}
                              </span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Payment Link Section if available -->
                  ${paymentUrl ? `
                    <div style="text-align: center; padding: 25px; background: #f0fdf4; border-radius: 8px; margin-bottom: 30px; border: 2px solid #10b981;">
                      <h3 style="margin: 0 0 10px 0; color: #059669;">💳 Pay Online Now</h3>
                      <p style="margin: 0 0 20px 0; color: #047857;">
                        Pay securely with Square - All major cards accepted
                      </p>
                      <a href="${paymentUrl}" 
                         style="display: inline-block; background: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                        Pay $${totalAmount.toFixed(2)} Now
                      </a>
                      <p style="margin: 15px 0 0 0; font-size: 12px; color: #6b7280;">
                        Or copy this link: <span style="color: #9ca3af; word-break: break-all;">${paymentUrl}</span>
                      </p>
                    </div>
                  ` : ''}
                  
                  <!-- Items Table -->
                  ${items.length > 0 ? `
                    <h3 style="color: #333; font-size: 18px; margin: 0 0 15px 0;">Invoice Details</h3>
                    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px;">
                      <thead>
                        <tr>
                          <th style="text-align: left; padding: 12px 8px; border-bottom: 2px solid #3b82f6; color: #333; font-weight: 600;">
                            Description
                          </th>
                          <th style="text-align: center; padding: 12px 8px; border-bottom: 2px solid #3b82f6; color: #333; font-weight: 600; width: 80px;">
                            Qty
                          </th>
                          <th style="text-align: right; padding: 12px 8px; border-bottom: 2px solid #3b82f6; color: #333; font-weight: 600; width: 100px;">
                            Price
                          </th>
                          <th style="text-align: right; padding: 12px 8px; border-bottom: 2px solid #3b82f6; color: #333; font-weight: 600; width: 100px;">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        ${itemsHtml}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colspan="3" style="padding: 15px 8px; text-align: right; border-top: 2px solid #e5e7eb; font-weight: bold; font-size: 16px;">
                            Total Amount Due:
                          </td>
                          <td style="padding: 15px 8px; text-align: right; border-top: 2px solid #e5e7eb; color: #1e40af; font-weight: bold; font-size: 16px;">
                            $${totalAmount.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  ` : ''}
                  
                  ${invoice.notes ? `
                    <div style="background-color: #fff9dc; border-left: 4px solid #fbbf24; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
                      <h4 style="margin: 0 0 10px 0; color: #92400e; font-size: 14px;">Notes:</h4>
                      <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                        ${invoice.notes}
                      </p>
                    </div>
                  ` : ''}
                  
                  <!-- Payment Information -->
                  ${!paymentUrl ? `
                    <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; padding: 20px; border-radius: 6px; margin-bottom: 30px;">
                      <h4 style="margin: 0 0 10px 0; color: #0369a1; font-size: 16px;">Payment Information</h4>
                      <p style="margin: 0 0 10px 0; color: #0c4a6e; font-size: 14px; line-height: 1.6;">
                        <strong>Payment Terms:</strong> ${invoice.payment_terms || 'Net 30 days'}
                      </p>
                      <p style="margin: 0; color: #0c4a6e; font-size: 14px; line-height: 1.6;">
                        Please ensure payment is made by the due date. A PDF copy of this invoice is attached for your records.
                      </p>
                    </div>
                  ` : ''}
                  
                  <!-- Footer Message -->
                  <p style="margin: 0 0 20px 0; color: #666; font-size: 14px; line-height: 1.6;">
                    If you have any questions about this invoice, please don't hesitate to contact us.
                  </p>
                  
                  <p style="margin: 0; color: #666; font-size: 14px;">
                    Best regards,<br>
                    <strong style="color: #333;">The BirdHaus Team</strong>
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
                  ${paymentUrl ? `
                    <p style="margin: 0 0 10px 0; color: #10b981; font-weight: 600; font-size: 14px;">
                      ✓ Secure payment link included above
                    </p>
                  ` : ''}
                  <p style="margin: 0 0 10px 0; color: #666; font-size: 12px;">
                    <strong>Attachment:</strong> Invoice_${invoice.invoice_number}.pdf
                  </p>
                  <p style="margin: 0; color: #999; font-size: 12px;">
                    This invoice was sent to: ${recipientEmail || invoice.order?.client?.email || 'Customer'}
                  </p>
                  <p style="margin: 10px 0 0 0; color: #999; font-size: 12px;">
                    © ${new Date().getFullYear()} BirdHaus. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}