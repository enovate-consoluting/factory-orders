/**
 * Print Manufacturing Sheet Utility
 * Generates printable manufacturing sheets for order products
 * Extracted from Order Detail Page for cleaner code organization
 * Location: app/dashboard/orders/utils/printManufacturingSheet.ts
 * Last Modified: Nov 26 2025
 */

interface PrintProduct {
  id: string;
  description?: string;
  product_order_number?: string;
  product?: {
    title?: string;
  };
  order_items?: Array<{
    variant_combo?: string;
    quantity?: number;
    notes?: string;
  }>;
}

interface PrintOrder {
  order_number: string;
  client?: {
    name?: string;
  };
}

/**
 * Opens a print window with manufacturing sheets for the given products
 * Each product gets its own page with sample info, pricing fields, variants, and notes
 */
export function printManufacturingSheets(products: PrintProduct[], order: PrintOrder): void {
  if (!products || products.length === 0) {
    console.warn('No products to print');
    return;
  }

  const printHTML = products.map((product, index) => {
    const items = product.order_items || [];
    const totalQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    
    const variantsRows = items.length > 0 
      ? items.map((item) => 
          `<tr>
            <td style="width: 30%;">${item.variant_combo || 'N/A'}</td>
            <td style="width: 15%; text-align: center;">${item.quantity || 0}</td>
            <td style="width: 55%;">${item.notes || ''}</td>
          </tr>`
        ).join('')
      : `<tr>
          <td colspan="3" style="text-align: center; color: #999;">
            No variants configured
          </td>
        </tr>`;

    return `
      <div class="product-sheet ${index < products.length - 1 ? 'page-break' : ''}">
        <div class="header">
          <div class="header-title">MANUFACTURING SHEET</div>
          <div class="product-name">${product.description || product.product?.title || 'Product'}</div>
          <div class="header-details">
            <span>Order: <strong>${order.order_number}</strong></span>
            <span>Product: <strong>${product.product_order_number || 'N/A'}</strong></span>
            <span>Client: <strong>${order.client?.name || 'N/A'}</strong></span>
          </div>
        </div>
        
        <div class="section" style="margin-top: 40px;">
          <div class="section-header">SAMPLE INFORMATION</div>
          <div class="sample-row" style="margin-top: 30px; margin-bottom: 25px;">
            <div class="field-group">
              <label>Sample Fee: $</label>
              <input type="text" class="field-line" />
            </div>
            <div class="field-group">
              <label>Sample ETA:</label>
              <input type="text" class="field-line" />
            </div>
            <div class="field-group">
              <label>Status:</label>
              <input type="text" class="field-line" />
            </div>
          </div>
        </div>
        
        <div class="section" style="margin-top: 45px;">
          <div class="section-header">PRICING & PRODUCTION</div>
          <div class="pricing-row" style="margin-top: 30px;">
            <div class="field-group">
              <label>Unit Price: $</label>
              <input type="text" class="field-line" />
            </div>
            <div class="field-group">
              <label>Total Quantity:</label>
              <span class="filled-value">${totalQty} units</span>
            </div>
            <div class="field-group">
              <label>Prod. Time:</label>
              <input type="text" class="field-line" />
            </div>
          </div>
          <div class="pricing-row" style="margin-top: 25px; margin-bottom: 25px;">
            <div class="field-group">
              <label>Shipping Air: $</label>
              <input type="text" class="field-line" />
            </div>
            <div class="field-group">
              <label>Shipping Boat: $</label>
              <input type="text" class="field-line" />
            </div>
            <div class="field-group">
              <label>Total Cost: $</label>
              <input type="text" class="field-line" />
            </div>
          </div>
        </div>
        
        <div class="section" style="margin-top: 45px;">
          <h2>VARIANTS & QUANTITIES</h2>
          <table style="margin-top: 15px;">
            <thead>
              <tr>
                <th style="width: 30%;">Variant/Size</th>
                <th style="width: 15%;">Qty</th>
                <th style="width: 55%;">Notes</th>
              </tr>
            </thead>
            <tbody>
              ${variantsRows}
              <tr class="total-row">
                <td><strong>TOTAL</strong></td>
                <td style="text-align: center;"><strong>${totalQty}</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="section" style="margin-top: 45px;">
          <h2>PRODUCTION NOTES</h2>
          <div class="notes-box"></div>
        </div>
      </div>
    `;
  }).join('');

  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Order ${order.order_number} - Manufacturing Sheets</title>
      <style>
        @page { 
          size: letter portrait; 
          margin: 0.75in;
        }
        
        @media print { 
          .page-break { 
            page-break-after: always;
          }
        }
        
        body { 
          font-family: Arial, sans-serif;
          color: #000;
          margin: 0;
          padding: 0;
          font-size: 12pt;
          background: white;
        }
        
        .product-sheet { 
          padding: 0;
          max-width: 100%;
          min-height: 100%;
        }
        
        .header { 
          text-align: center;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 2px solid #000;
        }
        
        .header-title {
          font-size: 13pt;
          letter-spacing: 2px;
          color: #333;
          margin-bottom: 12px;
          font-weight: 600;
        }
        
        .product-name { 
          font-size: 20pt;
          font-weight: bold;
          margin: 15px 0;
          color: #000;
        }
        
        .header-details {
          display: flex;
          justify-content: center;
          gap: 35px;
          font-size: 11pt;
          color: #333;
          margin-top: 12px;
        }
        
        .section {
          margin-bottom: 30px;
        }
        
        .section-header {
          background: #e8f4f8;
          padding: 10px;
          text-align: center;
          font-size: 13pt;
          font-weight: bold;
          letter-spacing: 0.5px;
          color: #2c5282;
          border-radius: 4px;
        }
        
        h2 {
          font-size: 12pt;
          margin: 0 0 8px 0;
          padding-bottom: 5px;
          border-bottom: 1px solid #333;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: bold;
        }
        
        .sample-row, .pricing-row {
          display: flex;
          gap: 35px;
          margin: 20px 0;
          padding: 0 10px;
        }
        
        .field-group {
          flex: 1;
          display: flex;
          align-items: baseline;
          gap: 5px;
        }
        
        .field-group label {
          font-size: 12pt;
          font-weight: 600;
          white-space: nowrap;
        }
        
        .field-line {
          border: none;
          border-bottom: 1px solid #333;
          outline: none;
          flex: 1;
          min-width: 60px;
          font-size: 11pt;
          background: transparent;
          padding-bottom: 3px;
        }
        
        .filled-value {
          font-weight: bold;
          padding-left: 5px;
          font-size: 12pt;
        }
        
        table { 
          width: 100%; 
          border-collapse: collapse;
          margin-top: 10px;
          font-size: 11pt;
        }
        
        th { 
          background: #f5f5f5;
          border: 1px solid #333;
          padding: 12px 8px;
          text-align: left;
          font-weight: bold;
        }
        
        td { 
          border: 1px solid #333;
          padding: 12px 8px;
        }
        
        .total-row {
          background: #f5f5f5;
          font-weight: bold;
        }
        
        .notes-box { 
          border: 1px solid #333;
          min-height: 280px;
          padding: 15px;
          background: white;
          margin-top: 12px;
        }
      </style>
    </head>
    <body>
      ${printHTML}
    </body>
    </html>
  `;
  
  const printWindow = window.open('', '', 'width=800,height=600');
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  }
}
