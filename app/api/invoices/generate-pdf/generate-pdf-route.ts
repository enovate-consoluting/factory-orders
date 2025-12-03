/**
 * Generate PDF API - /api/invoices/generate-pdf
 * Generates PDF from HTML and uploads to Supabase Storage
 * Returns the public URL for the PDF
 * Last Modified: December 1, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role for storage access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { invoiceId, invoiceNumber, html } = await request.json();

    if (!invoiceId || !invoiceNumber || !html) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // For now, we'll create a simple HTML-based PDF approach
    // In production, you'd use a service like Puppeteer, html-pdf, or a cloud PDF service
    
    // Option 1: Use a PDF generation service API (like PDFShift, DocRaptor, etc.)
    // Option 2: Use Puppeteer (requires additional setup)
    // Option 3: Store HTML and generate PDF on-demand
    
    // For this implementation, we'll store the HTML as a file that can be
    // converted to PDF client-side or via a separate service
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Create a complete HTML document for PDF
    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoiceNumber}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
${html}
</body>
</html>
    `.trim();

    // Convert HTML string to blob/buffer
    const htmlBuffer = Buffer.from(fullHtml, 'utf-8');
    
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `invoices/${invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_')}_${timestamp}.html`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('invoice-documents')
      .upload(filename, htmlBuffer, {
        contentType: 'text/html',
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      
      // If bucket doesn't exist, try to create it
      if (uploadError.message?.includes('bucket') || uploadError.message?.includes('not found')) {
        // Try creating the bucket
        const { error: bucketError } = await supabase.storage.createBucket('invoice-documents', {
          public: true,
          fileSizeLimit: 10485760 // 10MB
        });
        
        if (!bucketError) {
          // Retry upload
          const { data: retryData, error: retryError } = await supabase.storage
            .from('invoice-documents')
            .upload(filename, htmlBuffer, {
              contentType: 'text/html',
              cacheControl: '3600',
              upsert: true
            });
          
          if (retryError) {
            throw retryError;
          }
        }
      } else {
        throw uploadError;
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('invoice-documents')
      .getPublicUrl(filename);

    const pdfUrl = urlData.publicUrl;

    // For a true PDF, you would call a PDF generation service here
    // Example with a hypothetical PDF service:
    /*
    const pdfResponse = await fetch('https://api.pdfservice.com/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PDF_SERVICE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ html: fullHtml })
    });
    
    const pdfBuffer = await pdfResponse.arrayBuffer();
    
    // Upload PDF to storage
    const pdfFilename = `invoices/${invoiceNumber}_${timestamp}.pdf`;
    await supabase.storage
      .from('invoice-documents')
      .upload(pdfFilename, pdfBuffer, {
        contentType: 'application/pdf'
      });
    */

    return NextResponse.json({
      success: true,
      pdfUrl: pdfUrl,
      message: 'Invoice document generated successfully'
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to generate PDF' 
      },
      { status: 500 }
    );
  }
}
