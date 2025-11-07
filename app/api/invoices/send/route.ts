import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { generateInvoicePDF } from '@/app/utils/invoice-pdf-generator';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { invoiceId, recipientEmail, ccEmails = [] } = await request.json();
    
    if (!invoiceId || !recipientEmail) {
      return NextResponse.json(
        { error: 'Invoice ID and recipient email are required' },
        { status: 400 }
      );
    }

    // Fetch complete invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        order:orders(
          order_number,
          order_name,
          client:clients(name, email, phone)
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

    // Fetch invoice items
    const { data: invoiceItems, error: itemsError } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId);

    if (itemsError) {
      console.error('Invoice items fetch error:', itemsError);
    }

    // Generate professional invoice HTML
    const invoiceHtml = generateProfessionalInvoiceEmail(invoice, invoiceItems || []);
    
    // Generate PDF
    let attachments: any[] = [];
    try {
      const pdfBuffer = await generateInvoicePDF(invoice, invoiceItems || []);
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
      from: process.env.RESEND_FROM_EMAIL || 'invoices@yourdomain.com',
      to: recipientEmail,
      cc: ccEmails,
      subject: `Invoice ${invoice.invoice_number} - ${invoice.order.order_name || invoice.order.order_number}`,
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

    // Update invoice status
    await supabase
      .from('invoices')
      .update({ 
        sent_at: new Date().toISOString(),
        sent_to: recipientEmail
      })
      .eq('id', invoiceId);

    return NextResponse.json({ 
      success: true, 
      emailId: data?.id,
      message: 'Invoice sent successfully with PDF attachment'
    });

  } catch (error) {
    console.error('Error in send invoice API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateProfessionalInvoiceEmail(invoice: any, items: any[]): string {
  const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'Upon receipt';
  const invoiceDate = new Date(invoice.created_at).toLocaleDateString();
  
  // Group items by product for better display
  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 12px 8px; border-bottom: 1px solid #f0f0f0; color: #333;">
        ${item.description}
      </td>
      <td style="padding: 12px 8px; border-bottom: 1px solid #f0f0f0; text-align: right; color: #333;">
        $${parseFloat(item.amount).toFixed(2)}
      </td>
    </tr>
  `).join('');

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
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center; background-color: #1e40af; border-radius: 8px 8px 0 0;">
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
                    Dear ${invoice.order.client.name},
                  </p>
                  
                  <p style="margin: 0 0 30px 0; color: #666; font-size: 16px; line-height: 1.6;">
                    Thank you for your business. Please find attached your invoice for the recent order.
                    The PDF invoice is attached to this email for your records.
                  </p>
                  
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
                              <span style="float: right; color: #666;">${invoice.order.order_name || invoice.order.order_number}</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 0 0 0; border-top: 1px solid #dee2e6;">
                              <strong style="color: #1e40af; font-size: 18px;">Total Due:</strong>
                              <span style="float: right; color: #1e40af; font-size: 18px; font-weight: bold;">
                                $${parseFloat(invoice.amount).toFixed(2)}
                              </span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Items Summary -->
                  <h3 style="color: #333; font-size: 18px; margin: 0 0 15px 0;">Invoice Summary</h3>
                  <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px;">
                    <thead>
                      <tr>
                        <th style="text-align: left; padding: 12px 8px; border-bottom: 2px solid #1e40af; color: #333; font-weight: 600;">
                          Description
                        </th>
                        <th style="text-align: right; padding: 12px 8px; border-bottom: 2px solid #1e40af; color: #333; font-weight: 600;">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      ${itemsHtml}
                    </tbody>
                  </table>
                  
                  ${invoice.notes ? `
                    <div style="background-color: #fff9dc; border-left: 4px solid #fbbf24; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
                      <h4 style="margin: 0 0 10px 0; color: #92400e; font-size: 14px;">Notes:</h4>
                      <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                        ${invoice.notes}
                      </p>
                    </div>
                  ` : ''}
                  
                  <!-- Payment Information -->
                  <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; padding: 20px; border-radius: 6px; margin-bottom: 30px;">
                    <h4 style="margin: 0 0 10px 0; color: #0369a1; font-size: 16px;">Payment Information</h4>
                    <p style="margin: 0 0 10px 0; color: #0c4a6e; font-size: 14px; line-height: 1.6;">
                      <strong>Payment Terms:</strong> ${invoice.payment_terms || 'Net 30 days'}
                    </p>
                    <p style="margin: 0; color: #0c4a6e; font-size: 14px; line-height: 1.6;">
                      Please ensure payment is made by the due date. A PDF copy of this invoice is attached for your records.
                    </p>
                  </div>
                  
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
                  <p style="margin: 0 0 10px 0; color: #666; font-size: 12px;">
                    <strong>Attachment:</strong> Invoice_${invoice.invoice_number}.pdf
                  </p>
                  <p style="margin: 0; color: #999; font-size: 12px;">
                    This is an automated email. Please do not reply directly to this message.
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