// app/api/invoices/download/route.ts
// FIXED: Now properly uses invoice_items (including custom items) when available
// Last Modified: December 2024

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role for server-side access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const orderId = searchParams.get('order');
  const invoiceNumber = searchParams.get('invoice');
  
  if (!orderId || !invoiceNumber) {
    return new NextResponse('Missing parameters', { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch order data with all related information
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        client:clients(*),
        order_products (
          *,
          product:products(*),
          order_items (
            quantity
          )
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !orderData) {
      return new NextResponse('Order not found', { status: 404 });
    }

    // Try to fetch existing invoice data if it exists
    const { data: invoiceData } = await supabase
      .from('invoices')
      .select(`
        *,
        invoice_items (*)
      `)
      .eq('invoice_number', invoiceNumber)
      .single();

    // ========== FIXED: Use invoice_items if they exist ==========
    let tableRows = '';
    let subtotal = 0;

    if (invoiceData?.invoice_items && invoiceData.invoice_items.length > 0) {
      // USE SAVED INVOICE ITEMS (includes custom items!)
      console.log('Using saved invoice_items:', invoiceData.invoice_items.length);
      
      invoiceData.invoice_items.forEach((item: any) => {
        const amount = parseFloat(item.amount) || 0;
        subtotal += amount;
        
        // Parse quantity from description if present (e.g., "Product - Production (Qty: 10)")
        let qty = 1;
        let unitPrice = amount;
        const qtyMatch = item.description?.match(/\(Qty:\s*(\d+)\)/);
        if (qtyMatch) {
          qty = parseInt(qtyMatch[1]);
          unitPrice = amount / qty;
        }
        
        tableRows += `
          <tr>
            <td>${item.description || 'Item'}</td>
            <td class="text-right">${qty}</td>
            <td class="text-right">$${unitPrice.toFixed(2)}</td>
            <td class="text-right">$${amount.toFixed(2)}</td>
          </tr>
        `;
      });
    } else {
      // FALLBACK: Generate from order products (original behavior)
      console.log('Falling back to order products');
      
      const invoiceableProducts = orderData.order_products.filter((p: any) => {
        const hasFeesAndRoutedToAdmin = 
          p.routed_to === 'admin' && 
          (parseFloat(p.client_product_price || p.product_price || 0) > 0 || parseFloat(p.sample_fee || 0) > 0);
        
        return hasFeesAndRoutedToAdmin ||
               p.product_status === 'approved_for_production' || 
               p.product_status === 'in_production' ||
               p.product_status === 'completed';
      });

      invoiceableProducts.forEach((product: any) => {
        const totalQty = product.order_items.reduce((sum: number, item: any) => sum + item.quantity, 0);
        const clientUnitPrice = product.client_product_price || 0;
        
        // Sample fee row
        if (product.sample_fee > 0) {
          subtotal += product.sample_fee;
          tableRows += `
            <tr>
              <td>${product.description || product.product?.title || 'Product'} - Sample Fee</td>
              <td class="text-right">1</td>
              <td class="text-right">$${product.sample_fee.toFixed(2)}</td>
              <td class="text-right">$${product.sample_fee.toFixed(2)}</td>
            </tr>
          `;
        }
        
        // Production row
        if (clientUnitPrice > 0 && totalQty > 0) {
          const lineTotal = clientUnitPrice * totalQty;
          subtotal += lineTotal;
          tableRows += `
            <tr>
              <td>${product.description || product.product?.title || 'Product'} - Production</td>
              <td class="text-right">${totalQty}</td>
              <td class="text-right">$${clientUnitPrice.toFixed(2)}</td>
              <td class="text-right">$${lineTotal.toFixed(2)}</td>
            </tr>
          `;
        }
        
        // Shipping row
        if (product.selected_shipping_method === 'air' && product.client_shipping_air_price > 0) {
          subtotal += product.client_shipping_air_price;
          tableRows += `
            <tr>
              <td>${product.description || product.product?.title || 'Product'} - Air Shipping</td>
              <td class="text-right">1</td>
              <td class="text-right">$${product.client_shipping_air_price.toFixed(2)}</td>
              <td class="text-right">$${product.client_shipping_air_price.toFixed(2)}</td>
            </tr>
          `;
        } else if (product.selected_shipping_method === 'boat' && product.client_shipping_boat_price > 0) {
          subtotal += product.client_shipping_boat_price;
          tableRows += `
            <tr>
              <td>${product.description || product.product?.title || 'Product'} - Boat Shipping</td>
              <td class="text-right">1</td>
              <td class="text-right">$${product.client_shipping_boat_price.toFixed(2)}</td>
              <td class="text-right">$${product.client_shipping_boat_price.toFixed(2)}</td>
            </tr>
          `;
        }
      });
    }

    // Use invoice data for totals if exists, otherwise calculate
    const taxRate = invoiceData?.tax_rate || 0;
    const taxAmount = invoiceData?.tax_amount || 0;
    const total = invoiceData?.amount || subtotal;
    const dueDate = invoiceData?.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const notes = invoiceData?.notes || '';
    const terms = invoiceData?.payment_terms || 'Net 30 days';

    // Generate the invoice HTML
    const invoiceHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice ${invoiceNumber}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            color: #111827;
            line-height: 1.6;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
            background: white;
          }
          
          .invoice-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e5e7eb;
          }
          
          .company-info h1 {
            font-size: 24px;
            color: #111827;
            margin-bottom: 4px;
          }
          
          .company-tagline {
            color: #6b7280;
            font-size: 14px;
          }
          
          .invoice-title {
            text-align: right;
          }
          
          .invoice-title h2 {
            font-size: 32px;
            color: #111827;
            margin-bottom: 4px;
          }
          
          .invoice-number {
            color: #6b7280;
            font-size: 14px;
          }
          
          .invoice-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-bottom: 40px;
          }
          
          .bill-to h3 {
            font-size: 12px;
            text-transform: uppercase;
            color: #6b7280;
            margin-bottom: 10px;
          }
          
          .bill-to-content {
            line-height: 1.6;
          }
          
          .invoice-meta {
            text-align: right;
          }
          
          .invoice-meta-item {
            margin-bottom: 8px;
          }
          
          .invoice-meta-label {
            color: #6b7280;
            font-weight: 500;
          }
          
          .invoice-meta-value {
            color: #111827;
            font-weight: 600;
            margin-left: 8px;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 40px;
          }
          
          th {
            text-align: left;
            padding: 12px;
            border-bottom: 2px solid #e5e7eb;
            font-weight: 600;
            color: #374151;
            font-size: 12px;
            text-transform: uppercase;
          }
          
          td {
            padding: 12px;
            border-bottom: 1px solid #f3f4f6;
            color: #111827;
          }
          
          .text-right {
            text-align: right;
          }
          
          .totals {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 40px;
          }
          
          .totals-content {
            width: 300px;
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
          }
          
          .total-row.grand-total {
            border-top: 2px solid #e5e7eb;
            padding-top: 12px;
            margin-top: 8px;
            font-size: 20px;
            font-weight: bold;
          }
          
          .notes-section {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
          
          .notes-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
          }
          
          .notes-column h4 {
            font-weight: 600;
            color: #374151;
            margin-bottom: 8px;
            font-size: 14px;
          }
          
          .notes-content {
            color: #111827;
            white-space: pre-wrap;
          }
          
          .footer {
            margin-top: 60px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
          }
          
          .download-button {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #2563eb;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 500;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            display: inline-flex;
            align-items: center;
            gap: 8px;
          }
          
          .download-button:hover {
            background: #1d4ed8;
          }
          
          @media print {
            body {
              padding: 0;
              max-width: 100%;
            }
            .download-button {
              display: none;
            }
          }
          
          @media (max-width: 640px) {
            .invoice-header {
              flex-direction: column;
              gap: 20px;
            }
            
            .invoice-title {
              text-align: left;
            }
            
            .invoice-details {
              grid-template-columns: 1fr;
            }
            
            .invoice-meta {
              text-align: left;
            }
            
            .notes-grid {
              grid-template-columns: 1fr;
            }
            
            table {
              font-size: 12px;
            }
            
            th, td {
              padding: 8px 4px;
            }
            
            .download-button {
              bottom: 10px;
              right: 10px;
              left: 10px;
              justify-content: center;
            }
          }
        </style>
      </head>
      <body>
        <div class="invoice-header">
          <div class="company-info">
            <h1>BirdHaus</h1>
            <div class="company-tagline">Order Management System</div>
          </div>
          <div class="invoice-title">
            <h2>INVOICE</h2>
            <div class="invoice-number">#${invoiceNumber}</div>
          </div>
        </div>

        <div class="invoice-details">
          <div class="bill-to">
            <h3>Bill To</h3>
            <div class="bill-to-content">
              <strong>${orderData.client.name}</strong><br>
              ${orderData.client.email}<br>
              ${orderData.client.phone ? `${orderData.client.phone}<br>` : ''}
            </div>
          </div>
          <div class="invoice-meta">
            <div class="invoice-meta-item">
              <span class="invoice-meta-label">Invoice Date:</span>
              <span class="invoice-meta-value">${new Date().toLocaleDateString()}</span>
            </div>
            <div class="invoice-meta-item">
              <span class="invoice-meta-label">Due Date:</span>
              <span class="invoice-meta-value">${new Date(dueDate).toLocaleDateString()}</span>
            </div>
            <div class="invoice-meta-item">
              <span class="invoice-meta-label">Order #:</span>
              <span class="invoice-meta-value">${orderData.order_number}</span>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="text-right">Qty</th>
              <th class="text-right">Unit Price</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-content">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>$${subtotal.toFixed(2)}</span>
            </div>
            ${taxAmount > 0 ? `
              <div class="total-row">
                <span>Tax:</span>
                <span>$${taxAmount.toFixed(2)}</span>
              </div>
            ` : ''}
            <div class="total-row grand-total">
              <span>Total:</span>
              <span>$${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        ${(notes || terms) ? `
          <div class="notes-section">
            <div class="notes-grid">
              ${notes ? `
                <div class="notes-column">
                  <h4>Notes</h4>
                  <div class="notes-content">${notes}</div>
                </div>
              ` : ''}
              ${terms ? `
                <div class="notes-column">
                  <h4>Payment Terms</h4>
                  <div class="notes-content">${terms}</div>
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}

        <div class="footer">
          <p>Thank you for your business!</p>
          <p style="margin-top: 10px; font-size: 10px; color: #9ca3af;">
            This invoice was generated on ${new Date().toLocaleString()}
          </p>
        </div>

        <a href="javascript:window.print()" class="download-button">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M12 2v9m0 0l-3-3m3 3l3-3M3 12v7a2 2 0 002 2h14a2 2 0 002-2v-7"></path>
          </svg>
          Download PDF
        </a>

        <script>
          if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            const btn = document.querySelector('.download-button');
            if (btn) {
              btn.innerHTML = '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-4 0V3m0 4l-3-3m3 3l3-3"></path></svg> Save Invoice';
            }
          }
        </script>
      </body>
      </html>
    `;

    return new NextResponse(invoiceHTML, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Error generating invoice:', error);
    return new NextResponse('Error generating invoice', { status: 500 });
  }
}