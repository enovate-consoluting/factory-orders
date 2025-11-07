import jsPDF from 'jspdf';

export async function generateInvoicePDF(invoice: any, invoiceItems: any[]): Promise<Uint8Array> {
  // Create new PDF document
  const doc = new jsPDF();
  
  // Set font
  doc.setFont("helvetica");
  
  // Company Header
  doc.setFontSize(24);
  doc.setTextColor(30, 64, 175); // Blue color
  doc.text('INVOICE', 105, 20, { align: 'center' });
  
  // Invoice Number
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`Invoice #${invoice.invoice_number}`, 105, 30, { align: 'center' });
  
  // Company Info (left side)
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text('BirdHaus', 20, 50);
  doc.text('Order Management System', 20, 55);
  doc.text(process.env.RESEND_FROM_EMAIL || 'info@birdhaus.com', 20, 60);
  
  // Bill To (right side)
  doc.setFontSize(10);
  doc.text('BILL TO:', 120, 50);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.order.client.name, 120, 55);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.order.client.email, 120, 60);
  if (invoice.order.client.phone) {
    doc.text(invoice.order.client.phone, 120, 65);
  }
  
  // Invoice Details Box
  const detailsY = 80;
  doc.setFillColor(248, 249, 250);
  doc.rect(20, detailsY, 170, 30, 'F');
  
  doc.setFontSize(9);
  doc.text('Invoice Date:', 25, detailsY + 8);
  doc.text(new Date(invoice.created_at).toLocaleDateString(), 65, detailsY + 8);
  
  doc.text('Due Date:', 25, detailsY + 16);
  doc.text(invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'Upon Receipt', 65, detailsY + 16);
  
  doc.text('Order Reference:', 25, detailsY + 24);
  doc.text(invoice.order.order_name || invoice.order.order_number, 65, detailsY + 24);
  
  doc.text('Payment Terms:', 110, detailsY + 8);
  doc.text(invoice.payment_terms || 'Net 30 days', 150, detailsY + 8);
  
  doc.text('Status:', 110, detailsY + 16);
  doc.text(invoice.status.toUpperCase(), 150, detailsY + 16);
  
  // Items Table Header
  const tableY = detailsY + 40;
  doc.setFillColor(30, 64, 175);
  doc.rect(20, tableY, 170, 10, 'F');
  
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.text('Description', 25, tableY + 7);
  doc.text('Amount', 165, tableY + 7);
  
  // Items
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  let currentY = tableY + 15;
  
  invoiceItems.forEach((item) => {
    if (currentY > 250) {
      // Add new page if needed
      doc.addPage();
      currentY = 20;
    }
    
    // Wrap long descriptions
    const lines = doc.splitTextToSize(item.description, 120);
    doc.text(lines, 25, currentY);
    doc.text(`$${parseFloat(item.amount).toFixed(2)}`, 165, currentY);
    
    currentY += lines.length * 5 + 5;
  });
  
  // Draw line above total
  doc.setDrawColor(200);
  doc.line(20, currentY, 190, currentY);
  
  // Total
  currentY += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text('Total Due:', 130, currentY);
  doc.setTextColor(30, 64, 175);
  doc.text(`$${parseFloat(invoice.amount).toFixed(2)}`, 165, currentY);
  
  // Notes section if present
  if (invoice.notes) {
    currentY += 20;
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text('Notes:', 20, currentY);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const noteLines = doc.splitTextToSize(invoice.notes, 170);
    doc.text(noteLines, 20, currentY + 5);
  }
  
  // Footer
  doc.setTextColor(150);
  doc.setFontSize(8);
  doc.text('Thank you for your business!', 105, 280, { align: 'center' });
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, 105, 285, { align: 'center' });
  
  // Convert to Uint8Array for email attachment
  const pdfArrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(pdfArrayBuffer);
}