'use client';

/**
 * Create Invoice Page - /dashboard/invoices/create
 * Creates invoices from orders, generates PDF, saves pay_link and pdf_url
 * FIXED: QR Code now saves invoice first (including custom items)
 * FIXED: QR Modal has better close functionality
 * DEBUG: Added detailed error logging for QR code
 * Last Modified: December 2024
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { 
  ArrowLeft, Building, Calendar, Package, Download,
  Mail, Phone, MapPin, FileText, DollarSign, Save,
  Send, ChevronRight, Plus, X, AlertCircle, QrCode,
  Plane, Ship
} from 'lucide-react';
import { notify } from '@/app/hooks/useUINotification';
import SendInvoiceModal from '../SendInvoiceModal';

interface InvoiceData {
  order: any;
  products: any[];
  client: any;
  subtotal: number;
  tax: number;
  total: number;
  invoiceNumber: string;
  dueDate: string;
}

// QR Code Modal Component - FIXED with better close handling
const QRCodeModal = ({
  isOpen,
  onClose,
  invoiceUrl,
  invoiceNumber,
  isLoading = false
}: {
  isOpen: boolean;
  onClose: () => void;
  invoiceUrl: string;
  invoiceNumber: string;
  isLoading?: boolean;
}) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && invoiceUrl && !isLoading) {
      generateQRCode();
    }
  }, [isOpen, invoiceUrl, isLoading]);
  
  const generateQRCode = async () => {
    try {
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(invoiceUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeDataUrl(dataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return (
    // FIXED: Click outside to close
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        // Close when clicking the backdrop (not the modal content)
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
        {/* FIXED: More prominent close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 hover:bg-gray-100 rounded-full transition-colors z-10"
          title="Close (Esc)"
        >
          <X className="w-6 h-6 text-gray-500" />
        </button>
        
        <div className="flex justify-between items-center mb-4 pr-8">
          <h3 className="text-lg font-semibold text-gray-900">Scan to Download Invoice</h3>
        </div>
        
        <div className="text-center">
          <div className="bg-gray-50 p-6 rounded-lg mb-4">
            {isLoading ? (
              <div className="w-[300px] h-[300px] flex flex-col items-center justify-center text-gray-500">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p>Saving invoice...</p>
              </div>
            ) : qrCodeDataUrl ? (
              <img 
                src={qrCodeDataUrl} 
                alt="QR Code"
                className="mx-auto"
              />
            ) : (
              <div className="w-[300px] h-[300px] flex items-center justify-center text-gray-500">
                Generating QR Code...
              </div>
            )}
          </div>
          
          <p className="text-sm text-gray-600 mb-2">
            Scan this QR code with your phone's camera to download
          </p>
          <p className="text-xs text-gray-500">
            Invoice #{invoiceNumber}
          </p>
          
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Tip:</strong> On iPhone, use the Camera app. On Android, use Google Lens or your camera app.
            </p>
          </div>

          {/* FIXED: Added explicit close button at bottom */}
          <button
            onClick={onClose}
            className="mt-4 w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default function CreateInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order');
  const supabase = createClientComponentClient();
  
  const [loading, setLoading] = useState(true);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [logoUrl, setLogoUrl] = useState('/logo.png');
  const [showLogoUpload, setShowLogoUpload] = useState(false);
  const [companyName, setCompanyName] = useState('BirdHaus');
  const [companyTagline, setCompanyTagline] = useState('Order Management System');
  const [editingCompany, setEditingCompany] = useState(false);
  const [companyNameFontSize, setCompanyNameFontSize] = useState(20);
  const [taxRate, setTaxRate] = useState(0);
  const [applyTax, setApplyTax] = useState(false);
  const [editingBillTo, setEditingBillTo] = useState(false);
  const [billToName, setBillToName] = useState('');
  const [billToEmail, setBillToEmail] = useState('');
  const [billToAddress, setBillToAddress] = useState('');
  const [billToPhone, setBillToPhone] = useState('');
  const [customItems, setCustomItems] = useState<Array<{id: string, description: string, quantity: number, price: number}>>([]);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [markAsPaidOnSend, setMarkAsPaidOnSend] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [invoiceDownloadUrl, setInvoiceDownloadUrl] = useState('');
  const [generatedInvoiceNumber, setGeneratedInvoiceNumber] = useState('');
  const [invoiceReserved, setInvoiceReserved] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  
  useEffect(() => {
    if (orderId) {
      fetchOrderData();
    }
  }, [orderId]);

  const getNextInvoiceNumber = async (clientId: string, clientName: string) => {
    try {
      let { data: sequence, error } = await supabase
        .from('invoice_sequences')
        .select('*')
        .eq('client_id', clientId)
        .single();
      
      if (error || !sequence) {
        const clientPrefix = clientName.substring(0, 3).toUpperCase();
        const { data: newSequence, error: createError } = await supabase
          .from('invoice_sequences')
          .insert({
            client_id: clientId,
            prefix: clientPrefix,
            last_number: 0
          })
          .select()
          .single();
        
        if (createError) {
          console.error('Error creating invoice sequence:', createError);
          return `INV-${String(Date.now()).slice(-5)}`;
        }
        
        sequence = newSequence;
      }
      
      const nextNumber = (sequence.last_number || 0) + 1;
      
      await supabase
        .from('invoice_sequences')
        .update({ 
          last_number: nextNumber,
          updated_at: new Date().toISOString()
        })
        .eq('client_id', clientId);
      
      const invoiceNumber = `${sequence.prefix}-${String(nextNumber).padStart(5, '0')}`;
      
      return invoiceNumber;
    } catch (error) {
      console.error('Error generating invoice number:', error);
      return `INV-${String(Date.now()).slice(-5)}`;
    }
  };
  
  const fetchOrderData = async () => {
    try {
      const { data: orderData, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients(*),
          order_products (
            *,
            product:products(*),
            routed_to,
            invoiced,
            invoice_id,
            order_items (
              quantity
            )
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;

      // Check if we should only show uninvoiced products
      const uninvoicedOnly = searchParams.get('uninvoiced_only') === 'true';
      
      let invoiceableProducts = orderData.order_products.filter((p: any) => {
        const hasFeesAndRoutedToAdmin = 
          p.routed_to === 'admin' && 
          (parseFloat(p.client_product_price || p.product_price || 0) > 0 || parseFloat(p.sample_fee || 0) > 0);
        
        return hasFeesAndRoutedToAdmin ||
               p.product_status === 'approved_for_production' || 
               p.product_status === 'in_production' ||
               p.product_status === 'completed';
      });
      
      // If uninvoiced_only, filter out products that are already invoiced
      if (uninvoicedOnly) {
        invoiceableProducts = invoiceableProducts.filter((p: any) => !p.invoiced);
      }

      let subtotal = 0;
      invoiceableProducts.forEach((product: any) => {
        const totalQty = product.order_items.reduce((sum: number, item: any) => sum + item.quantity, 0);
        subtotal += (product.sample_fee || 0);
        const clientPrice = product.client_product_price || product.product_price || 0;
        subtotal += (clientPrice * totalQty);
        if (product.selected_shipping_method === 'air') {
          const clientAirPrice = product.client_shipping_air_price || product.shipping_air_price || 0;
          subtotal += clientAirPrice;
        } else if (product.selected_shipping_method === 'boat') {
          const clientBoatPrice = product.client_shipping_boat_price || product.shipping_boat_price || 0;
          subtotal += clientBoatPrice;
        }
      });

      const invoiceNumber = await getNextInvoiceNumber(
        orderData.client.id, 
        orderData.client.name
      );
      setGeneratedInvoiceNumber(invoiceNumber);
      setInvoiceReserved(true);
      
      const defaultDueDate = new Date();
      defaultDueDate.setDate(defaultDueDate.getDate() + 30);
      setDueDate(defaultDueDate.toISOString().split('T')[0]);

      setInvoiceData({
        order: orderData,
        products: invoiceableProducts,
        client: orderData.client,
        subtotal: subtotal,
        tax: 0,
        total: subtotal,
        invoiceNumber: invoiceNumber,
        dueDate: defaultDueDate.toISOString().split('T')[0]
      });

      setSelectedProducts(invoiceableProducts.map((p: any) => p.id));
      setBillToName(orderData.client.name || '');
      setBillToEmail(orderData.client.email || '');
    } catch (error) {
      console.error('Error fetching order:', error);
      notify.error('Failed to load order data');
    } finally {
      setLoading(false);
    }
  };

  const calculateSelectedTotal = () => {
    if (!invoiceData) return 0;
    
    const productTotal = invoiceData.products
      .filter(p => selectedProducts.includes(p.id))
      .reduce((sum, product) => {
        const totalQty = product.order_items.reduce((qty: number, item: any) => qty + item.quantity, 0);
        let productSum = 0;
        
        productSum += (product.sample_fee || 0);
        const clientPrice = product.client_product_price || product.product_price || 0;
        productSum += (clientPrice * totalQty);
        
        if (product.selected_shipping_method === 'air') {
          const clientAirPrice = product.client_shipping_air_price || product.shipping_air_price || 0;
          productSum += clientAirPrice;
        } else if (product.selected_shipping_method === 'boat') {
          const clientBoatPrice = product.client_shipping_boat_price || product.shipping_boat_price || 0;
          productSum += clientBoatPrice;
        }
        
        return sum + productSum;
      }, 0);
      
    const customTotal = customItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    
    return productTotal + customTotal;
  };

  // Generate PDF HTML content
  const generateInvoiceHTML = () => {
    const subtotal = calculateSelectedTotal();
    const taxAmount = applyTax ? (subtotal * taxRate) / 100 : 0;
    const total = subtotal + taxAmount;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${invoiceData?.invoiceNumber}</title>
        <style>
          @page { size: letter; margin: 0.5in; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            color: #111827;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
          }
          .invoice-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e5e7eb;
          }
          .company-info h1 { margin: 0; font-size: ${companyNameFontSize}px; color: #111827; }
          .company-tagline { color: #6b7280; margin-top: 4px; }
          .invoice-title { text-align: right; }
          .invoice-title h2 { margin: 0; font-size: 32px; color: #111827; }
          .invoice-number { color: #6b7280; font-size: 14px; margin-top: 4px; }
          .invoice-details { display: flex; justify-content: space-between; margin-bottom: 40px; }
          .bill-to h3 { margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; color: #6b7280; }
          .invoice-meta { text-align: right; }
          .invoice-meta-item { margin-bottom: 8px; }
          .invoice-meta-label { color: #6b7280; font-weight: 500; }
          .invoice-meta-value { color: #111827; font-weight: 600; margin-left: 8px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
          th { text-align: left; padding: 12px; border-bottom: 2px solid #e5e7eb; font-weight: 600; color: #374151; font-size: 12px; text-transform: uppercase; }
          td { padding: 12px; border-bottom: 1px solid #f3f4f6; color: #111827; }
          .text-right { text-align: right; }
          .totals { display: flex; justify-content: flex-end; margin-bottom: 40px; }
          .totals-content { width: 300px; }
          .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
          .total-row.grand-total { border-top: 2px solid #e5e7eb; padding-top: 12px; margin-top: 8px; font-size: 18px; font-weight: bold; }
          .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="invoice-header">
          <div class="company-info">
            ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="height: 48px; margin-bottom: 12px;">` : ''}
            <h1>${companyName}</h1>
            <div class="company-tagline">${companyTagline}</div>
          </div>
          <div class="invoice-title">
            <h2>INVOICE</h2>
            <div class="invoice-number">#${invoiceData?.invoiceNumber}</div>
          </div>
        </div>

        <div class="invoice-details">
          <div class="bill-to">
            <h3>Bill To</h3>
            <div>
              <strong>${billToName}</strong><br>
              ${billToEmail}<br>
              ${billToAddress ? `${billToAddress}<br>` : ''}
              ${billToPhone ? `${billToPhone}<br>` : ''}
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
              <span class="invoice-meta-value">${invoiceData?.order.order_number}</span>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40%">Description</th>
              <th class="text-right" style="width: 15%">Qty</th>
              <th class="text-right" style="width: 15%">Unit Price</th>
              <th class="text-right" style="width: 15%">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${invoiceData?.products
              .filter(p => selectedProducts.includes(p.id))
              .map(product => {
                const totalQty = product.order_items.reduce((sum: number, item: any) => sum + item.quantity, 0);
                const clientUnitPrice = product.client_product_price || 0;
                let rows = [];
                
                if (product.sample_fee > 0) {
                  rows.push(`
                    <tr>
                      <td>${product.description || product.product?.title || 'Product'} - Sample Fee</td>
                      <td class="text-right">1</td>
                      <td class="text-right">$${product.sample_fee.toFixed(2)}</td>
                      <td class="text-right">$${product.sample_fee.toFixed(2)}</td>
                    </tr>
                  `);
                }
                
                if (clientUnitPrice > 0 && totalQty > 0) {
                  rows.push(`
                    <tr>
                      <td>${product.description || product.product?.title || 'Product'} - Production</td>
                      <td class="text-right">${totalQty}</td>
                      <td class="text-right">$${clientUnitPrice.toFixed(2)}</td>
                      <td class="text-right">$${(clientUnitPrice * totalQty).toFixed(2)}</td>
                    </tr>
                  `);
                }
                
                if (product.selected_shipping_method === 'air' && product.client_shipping_air_price > 0) {
                  rows.push(`
                    <tr>
                      <td>${product.description || product.product?.title || 'Product'} - Air Shipping</td>
                      <td class="text-right">1</td>
                      <td class="text-right">$${product.client_shipping_air_price.toFixed(2)}</td>
                      <td class="text-right">$${product.client_shipping_air_price.toFixed(2)}</td>
                    </tr>
                  `);
                } else if (product.selected_shipping_method === 'boat' && product.client_shipping_boat_price > 0) {
                  rows.push(`
                    <tr>
                      <td>${product.description || product.product?.title || 'Product'} - Boat Shipping</td>
                      <td class="text-right">1</td>
                      <td class="text-right">$${product.client_shipping_boat_price.toFixed(2)}</td>
                      <td class="text-right">$${product.client_shipping_boat_price.toFixed(2)}</td>
                    </tr>
                  `);
                }
                
                return rows.join('');
              }).join('')}
            
            ${customItems.map(item => `
              <tr>
                <td>${item.description}</td>
                <td class="text-right">${item.quantity}</td>
                <td class="text-right">$${item.price.toFixed(2)}</td>
                <td class="text-right">$${(item.quantity * item.price).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-content">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>$${subtotal.toFixed(2)}</span>
            </div>
            ${applyTax ? `
              <div class="total-row">
                <span>Tax (${taxRate}%):</span>
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
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            ${notes ? `<div style="margin-bottom: 20px;"><strong>Notes:</strong><br>${notes.replace(/\n/g, '<br>')}</div>` : ''}
            ${terms ? `<div><strong>Payment Terms:</strong><br>${terms}</div>` : ''}
          </div>
        ` : ''}

        <div class="footer">
          <p>Thank you for your business!</p>
        </div>
      </body>
      </html>
    `;
  };

  // Generate and upload PDF to Supabase Storage
  const generateAndUploadPDF = async (invoiceId: string): Promise<string | null> => {
    try {
      // Generate PDF via API endpoint
      const response = await fetch('/api/invoices/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId,
          invoiceNumber: generatedInvoiceNumber,
          html: generateInvoiceHTML()
        })
      });

      if (!response.ok) {
        console.error('Failed to generate PDF');
        return null;
      }

      const result = await response.json();
      
      if (result.success && result.pdfUrl) {
        return result.pdfUrl;
      }
      
      return null;
    } catch (error) {
      console.error('Error generating PDF:', error);
      return null;
    }
  };

  // FIXED: handleShowQRCode with detailed error logging
  const handleShowQRCode = async () => {
    if (selectedProducts.length === 0 && customItems.length === 0) {
      notify.error('Please select at least one product or add a custom item');
      return;
    }

    try {
      // Show modal immediately with loading state
      setShowQRCode(true);
      setQrLoading(true);

      // Calculate totals
      const subtotal = calculateSelectedTotal();
      const taxAmount = applyTax ? (subtotal * taxRate) / 100 : 0;
      const total = subtotal + taxAmount;
      
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      console.log('=== QR Code Debug Info ===');
      console.log('User from localStorage:', user);
      console.log('Order ID:', orderId);
      console.log('Client ID:', invoiceData?.client.id);
      console.log('Invoice Number:', generatedInvoiceNumber);
      console.log('Total:', total);

      // Check if invoice already exists (was saved as draft)
      const { data: existingInvoice, error: checkError } = await supabase
        .from('invoices')
        .select('id')
        .eq('invoice_number', generatedInvoiceNumber)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is fine
        console.log('Check existing invoice error:', checkError);
      }

      let invoiceId: string;

      if (existingInvoice) {
        // Update existing invoice
        console.log('Existing invoice found:', existingInvoice.id);
        invoiceId = existingInvoice.id;
        
        const { error: updateError } = await supabase
          .from('invoices')
          .update({
            amount: total,
            due_date: dueDate,
            notes: notes || null,
            payment_terms: terms || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', invoiceId);

        if (updateError) {
          console.error('Update error:', JSON.stringify(updateError, null, 2));
        }

        // Delete old invoice items and recreate
        await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', invoiceId);
      } else {
        // Create new invoice as draft for QR code
        // Using only the fields that definitely exist in your table
        const insertData: any = {
          invoice_number: generatedInvoiceNumber,
          order_id: orderId,
          client_id: invoiceData?.client.id,
          amount: total,
          paid_amount: 0,
          status: 'draft',
          due_date: dueDate,
          notes: notes || null,
          payment_terms: terms || null
        };

        // Only add created_by if user.id exists
        if (user.id) {
          insertData.created_by = user.id;
        }

        console.log('Attempting to insert invoice with data:', JSON.stringify(insertData, null, 2));

        const { data: invoice, error } = await supabase
          .from('invoices')
          .insert(insertData)
          .select()
          .single();

        if (error) {
          // Log the full error details
          console.error('=== INVOICE INSERT ERROR ===');
          console.error('Full error object:', JSON.stringify(error, null, 2));
          console.error('Error message:', error.message);
          console.error('Error code:', error.code);
          console.error('Error details:', error.details);
          console.error('Error hint:', error.hint);
          
          notify.error(`Failed to prepare invoice: ${error.message || 'Unknown error'}`);
          setShowQRCode(false);
          setQrLoading(false);
          return;
        }

        console.log('Invoice created successfully:', invoice);
        invoiceId = invoice.id;
      }

      // Create invoice items (including custom items!)
      const invoiceItems = [];
      
      // Add selected products
      for (const productId of selectedProducts) {
        const product = invoiceData?.products.find((p: any) => p.id === productId);
        if (!product) continue;
        
        const totalQty = product.order_items.reduce((sum: number, item: any) => sum + item.quantity, 0);
        const clientPrice = product.client_product_price || 0;
        
        if (product.sample_fee > 0) {
          invoiceItems.push({
            invoice_id: invoiceId,
            order_product_id: product.id,
            description: `${product.description || product.product?.title || 'Product'} - Sample Fee`,
            amount: product.sample_fee
          });
        }
        
        if (clientPrice > 0 && totalQty > 0) {
          invoiceItems.push({
            invoice_id: invoiceId,
            order_product_id: product.id,
            description: `${product.description || product.product?.title || 'Product'} - Production (Qty: ${totalQty})`,
            amount: clientPrice * totalQty
          });
        }
        
        if (product.selected_shipping_method === 'air' && product.client_shipping_air_price > 0) {
          invoiceItems.push({
            invoice_id: invoiceId,
            order_product_id: product.id,
            description: `${product.description || product.product?.title || 'Product'} - Air Shipping`,
            amount: product.client_shipping_air_price
          });
        } else if (product.selected_shipping_method === 'boat' && product.client_shipping_boat_price > 0) {
          invoiceItems.push({
            invoice_id: invoiceId,
            order_product_id: product.id,
            description: `${product.description || product.product?.title || 'Product'} - Boat Shipping`,
            amount: product.client_shipping_boat_price
          });
        }
      }
      
      // Add custom items - THIS IS THE KEY FIX
      for (const item of customItems) {
        if (item.description && item.price > 0) {
          invoiceItems.push({
            invoice_id: invoiceId,
            order_product_id: null,
            description: `${item.description} (Qty: ${item.quantity})`,
            amount: item.price * item.quantity
          });
        }
      }
      
      console.log('Invoice items to insert:', invoiceItems.length);
      console.log('Invoice items:', JSON.stringify(invoiceItems, null, 2));
      
      // Save all invoice items
      if (invoiceItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(invoiceItems);
        
        if (itemsError) {
          console.error('Error creating invoice items:', JSON.stringify(itemsError, null, 2));
        } else {
          console.log('Invoice items created successfully');
        }
      }

      // Generate QR code URL
      const baseUrl = window.location.origin;
      const invoiceUrl = `${baseUrl}/api/invoices/download?order=${orderId}&invoice=${generatedInvoiceNumber}`;
      
      console.log('QR Code URL:', invoiceUrl);
      setInvoiceDownloadUrl(invoiceUrl);
      setQrLoading(false);
      
    } catch (error: any) {
      console.error('=== CAUGHT EXCEPTION ===');
      console.error('Error:', error);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      notify.error('Failed to generate QR code');
      setShowQRCode(false);
      setQrLoading(false);
    }
  };

  const handleDownloadInvoice = () => {
    if (selectedProducts.length === 0 && customItems.length === 0) {
      notify.error('Please select at least one product or add a custom item');
      return;
    }

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'absolute';
    printFrame.style.top = '-10000px';
    printFrame.style.left = '-10000px';
    document.body.appendChild(printFrame);

    const invoiceHTML = generateInvoiceHTML();

    const frameDoc = printFrame.contentWindow?.document;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(invoiceHTML);
      frameDoc.close();

      printFrame.onload = () => {
        if (printFrame.contentWindow) {
          printFrame.contentWindow.focus();
          printFrame.contentWindow.print();
          
          setTimeout(() => {
            document.body.removeChild(printFrame);
          }, 1000);
        }
      };
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const handleCreateInvoice = async (status: 'draft' | 'sent', sendData?: any) => {
    if (selectedProducts.length === 0 && customItems.length === 0) {
      notify.error('Please select at least one product or add a custom item');
      return;
    }

    try {
      setSaving(true);
      const subtotal = calculateSelectedTotal();
      const taxAmount = applyTax ? (subtotal * taxRate) / 100 : 0;
      const total = subtotal + taxAmount;
      
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Check if invoice already exists (from QR code auto-save)
      const { data: existingInvoice } = await supabase
        .from('invoices')
        .select('id')
        .eq('invoice_number', generatedInvoiceNumber)
        .single();

      let invoiceId: string;

      if (existingInvoice) {
        // Update existing invoice
        invoiceId = existingInvoice.id;
        
        const { error: updateError } = await supabase
          .from('invoices')
          .update({
            amount: total,
            status: status,
            due_date: dueDate,
            notes: notes || null,
            payment_terms: terms || null,
            pay_link: (sendData?.includePaymentLink && sendData?.paymentUrl) ? sendData.paymentUrl : null,
            sent_at: status === 'sent' ? new Date().toISOString() : null,
            sent_to: status === 'sent' ? billToEmail : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', invoiceId);

        if (updateError) {
          console.error('Invoice update error:', updateError);
          notify.error('Failed to update invoice');
          throw updateError;
        }

        // Delete old invoice items and recreate
        await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', invoiceId);
      } else {
        // Create invoice in database
        const insertData: any = {
          invoice_number: generatedInvoiceNumber,
          order_id: orderId,
          client_id: invoiceData?.client.id,
          amount: total,
          paid_amount: 0,
          status: status,
          due_date: dueDate,
          notes: notes || null,
          payment_terms: terms || null,
          pay_link: (sendData?.includePaymentLink && sendData?.paymentUrl) ? sendData.paymentUrl : null,
          sent_at: status === 'sent' ? new Date().toISOString() : null,
          sent_to: status === 'sent' ? billToEmail : null
        };

        if (user.id) {
          insertData.created_by = user.id;
        }

        const { data: invoice, error } = await supabase
          .from('invoices')
          .insert(insertData)
          .select()
          .single();

        if (error) {
          console.error('Invoice creation error:', error);
          notify.error('Failed to create invoice');
          throw error;
        }

        invoiceId = invoice.id;
      }

      // Generate and upload PDF if sending
      let pdfUrl: string | null = null;
      if (status === 'sent') {
        pdfUrl = await generateAndUploadPDF(invoiceId);
        
        // Update invoice with PDF URL if generated
        if (pdfUrl) {
          await supabase
            .from('invoices')
            .update({ pdf_url: pdfUrl })
            .eq('id', invoiceId);
        }
      }

      // Create invoice items
      const invoiceItems = [];
      
      for (const productId of selectedProducts) {
        const product = invoiceData?.products.find(p => p.id === productId);
        if (!product) continue;
        
        const totalQty = product.order_items.reduce((sum: number, item: any) => sum + item.quantity, 0);
        const clientPrice = product.client_product_price || 0;
        
        if (product.sample_fee > 0) {
          invoiceItems.push({
            invoice_id: invoiceId,
            order_product_id: product.id,
            description: `${product.description || product.product?.title || 'Product'} - Sample Fee`,
            amount: product.sample_fee
          });
        }
        
        if (clientPrice > 0 && totalQty > 0) {
          invoiceItems.push({
            invoice_id: invoiceId,
            order_product_id: product.id,
            description: `${product.description || product.product?.title || 'Product'} - Production (Qty: ${totalQty})`,
            amount: clientPrice * totalQty
          });
        }
        
        if (product.selected_shipping_method === 'air' && product.client_shipping_air_price > 0) {
          invoiceItems.push({
            invoice_id: invoiceId,
            order_product_id: product.id,
            description: `${product.description || product.product?.title || 'Product'} - Air Shipping`,
            amount: product.client_shipping_air_price
          });
        } else if (product.selected_shipping_method === 'boat' && product.client_shipping_boat_price > 0) {
          invoiceItems.push({
            invoice_id: invoiceId,
            order_product_id: product.id,
            description: `${product.description || product.product?.title || 'Product'} - Boat Shipping`,
            amount: product.client_shipping_boat_price
          });
        }
      }
      
      for (const item of customItems) {
        if (item.description && item.price > 0) {
          invoiceItems.push({
            invoice_id: invoiceId,
            order_product_id: null,
            description: `${item.description} (Qty: ${item.quantity})`,
            amount: item.price * item.quantity
          });
        }
      }
      
      if (invoiceItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(invoiceItems);
        
        if (itemsError) {
          console.error('Error creating invoice items:', itemsError);
        }
      }

      // Mark products as invoiced when invoice is SENT (not draft)
      if (status === 'sent' && selectedProducts.length > 0) {
        const { error: markError } = await supabase
          .from('order_products')
          .update({
            invoiced: true,
            invoiced_at: new Date().toISOString(),
            invoice_id: invoiceId
          })
          .in('id', selectedProducts);
        
        if (markError) {
          console.error('Error marking products as invoiced:', markError);
        }
      }

      // Try to send email (only for email method)
      if (status === 'sent' && sendData && (sendData.method === 'email' || sendData.method === 'both')) {
        try {
          console.log('Attempting to send invoice email...');
          
          const emailResponse = await fetch('/api/invoices/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              invoiceId: invoiceId,
              pdfUrl: pdfUrl,
              ...sendData
            })
          });

          if (emailResponse.ok) {
            const emailResult = await emailResponse.json();
            
            if (emailResult.success) {
              console.log('Invoice email sent successfully');
            } else {
              console.log('Email feature not configured yet');
            }
          } else {
            console.log('Email endpoint not available yet');
          }
        } catch (emailError) {
          console.log('Email sending not configured:', emailError);
        }
      }
      
      if (status === 'draft') {
        notify.success(`Invoice ${generatedInvoiceNumber} saved as draft`);
      }
      
      router.push('/dashboard/invoices');
      
    } catch (error) {
      console.error('Error creating invoice:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSendClick = () => {
    if (selectedProducts.length === 0 && customItems.length === 0) {
      notify.error('Please select at least one product or add a custom item');
      return;
    }
    setShowEmailPreview(true);
  };

  const handleSendSuccess = (message: string) => {
    notify.success(message);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading invoice data...</div>
      </div>
    );
  }

  if (!invoiceData) {
    return (
      <div className="p-6">
        <p className="text-red-600">Failed to load order data</p>
      </div>
    );
  }

  const selectedTotal = calculateSelectedTotal();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={handleCancel}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h1 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900">Create Invoice</h1>
            </div>
            
            {/* Mobile Cancel Button */}
            <button
              onClick={handleCancel}
              className="sm:hidden w-full px-2.5 py-1.5 text-xs border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            
            {/* Action Buttons */}
            <div className="grid grid-cols-3 sm:flex sm:flex-row gap-2">
              <button
                onClick={handleCancel}
                className="hidden sm:inline-flex px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors items-center justify-center"
              >
                Cancel
              </button>
              <button
                onClick={handleShowQRCode}
                className="px-2.5 sm:px-3 py-2 sm:py-1.5 text-xs sm:text-sm border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5"
                title="Generate QR code for mobile download"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>QR Code</span>
              </button>
              <button
                onClick={handleDownloadInvoice}
                className="px-2.5 sm:px-3 py-2 sm:py-1.5 text-xs sm:text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
              <button
                onClick={() => handleCreateInvoice('draft')}
                className="px-2.5 sm:px-3 py-2 sm:py-1.5 text-xs sm:text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
                disabled={saving}
              >
                <Save className="w-3.5 h-3.5" />
                <span>Draft</span>
              </button>
              <button
                onClick={handleSendClick}
                className="col-span-3 sm:col-span-1 px-2.5 sm:px-3 py-2 sm:py-1.5 text-xs sm:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
                disabled={saving}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Invoice</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Preview */}
      <div className="max-w-4xl mx-auto p-3 sm:p-6">
        <div className="bg-white rounded-lg shadow-lg">
          {/* Invoice Header */}
          <div className="p-3 sm:p-6 lg:p-8 border-b">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="w-full sm:w-auto">
                {logoUrl && (
                  <>
                    <img 
                      src={logoUrl} 
                      alt="Company Logo" 
                      className="h-10 sm:h-12 mb-3 cursor-pointer"
                      onClick={() => setShowLogoUpload(!showLogoUpload)}
                    />
                    {showLogoUpload && (
                      <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                        <input
                          type="text"
                          value={logoUrl}
                          onChange={(e) => setLogoUrl(e.target.value)}
                          placeholder="Enter logo URL or path"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-gray-900"
                        />
                        <div className="flex justify-between items-center mt-2">
                          <p className="text-xs text-gray-500">Default: /logo.png</p>
                          <button
                            onClick={() => setLogoUrl('')}
                            className="text-xs text-red-600 hover:text-red-700"
                          >
                            Remove Logo
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
                
                {!logoUrl && (
                  <button
                    onClick={() => {
                      setLogoUrl('/logo.png');
                      setShowLogoUpload(true);
                    }}
                    className="mb-3 px-3 py-1 text-xs text-blue-600 hover:text-blue-700 border border-blue-300 rounded"
                  >
                    + Add Logo
                  </button>
                )}
                
                {editingCompany ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        style={{ fontSize: `${companyNameFontSize}px` }}
                        className="font-bold text-gray-900 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none"
                        placeholder="Company Name"
                      />
                      <div className="flex flex-col">
                        <button
                          onClick={() => setCompanyNameFontSize(Math.min(companyNameFontSize + 2, 36))}
                          className="text-xs text-gray-600 hover:text-gray-900"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => setCompanyNameFontSize(Math.max(companyNameFontSize - 2, 14))}
                          className="text-xs text-gray-600 hover:text-gray-900"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={companyTagline}
                      onChange={(e) => setCompanyTagline(e.target.value)}
                      className="text-gray-700 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none w-full"
                      placeholder="Company Tagline"
                    />
                    <button
                      onClick={() => setEditingCompany(false)}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div 
                    className="cursor-pointer group"
                    onClick={() => setEditingCompany(true)}
                  >
                    <h3 
                      className="font-bold text-gray-900 group-hover:text-blue-600"
                      style={{ fontSize: `${companyNameFontSize}px` }}
                    >
                      {companyName}
                    </h3>
                    <p className="text-sm sm:text-base text-gray-700 group-hover:text-blue-600">
                      {companyTagline}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="text-left sm:text-right w-full sm:w-auto">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1">INVOICE</h2>
                <p className="text-sm sm:text-base text-gray-700 font-medium">#{invoiceData.invoiceNumber}</p>
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="p-3 sm:p-6 lg:p-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {/* Bill To */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">Bill To:</h4>
                <button
                  onClick={() => setEditingBillTo(!editingBillTo)}
                  className="text-lg text-blue-600 hover:text-blue-700"
                >
                  {editingBillTo ? 'Done' : 'Edit'}
                </button>
              </div>
              {editingBillTo ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={billToName}
                    onChange={(e) => setBillToName(e.target.value)}
                    placeholder="Client Name"
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                  />
                  <input
                    type="email"
                    value={billToEmail}
                    onChange={(e) => setBillToEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                  />
                  <input
                    type="text"
                    value={billToAddress}
                    onChange={(e) => setBillToAddress(e.target.value)}
                    placeholder="Address (optional)"
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                  />
                  <input
                    type="tel"
                    value={billToPhone}
                    onChange={(e) => setBillToPhone(e.target.value)}
                    placeholder="Phone (optional)"
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-medium text-gray-900">{billToName}</p>
                  <p className="text-sm text-gray-700">{billToEmail}</p>
                  {billToAddress && <p className="text-sm text-gray-700">{billToAddress}</p>}
                  {billToPhone && <p className="text-sm text-gray-700">{billToPhone}</p>}
                </div>
              )}
            </div>

            {/* Invoice Info */}
            <div className="text-left sm:text-right">
              <div className="space-y-2">
                <div className="flex justify-between sm:justify-end items-center gap-2">
                  <span className="text-sm text-gray-700 font-medium">Invoice Date:</span>
                  <span className="text-sm font-medium text-gray-900">{new Date().toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between sm:justify-end items-center gap-2">
                  <span className="text-sm text-gray-700 font-medium whitespace-nowrap">Due Date:</span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                  />
                </div>
                <div className="flex justify-between sm:justify-end items-center gap-2">
                  <span className="text-sm text-gray-700 font-medium">Order #:</span>
                  <span className="text-sm font-medium text-gray-900">{invoiceData.order.order_number}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Products Table */}
          <div className="px-3 sm:px-6 lg:px-8">
            <h4 className="font-semibold text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Products</h4>
            
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Select</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Product</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-gray-700">Qty</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-gray-700">Unit Price</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-gray-700">Sample Fee</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-gray-700">Shipping</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceData.products.map((product) => {
                    const totalQty = product.order_items.reduce((sum: number, item: any) => sum + item.quantity, 0);
                    const clientUnitPrice = product.client_product_price || 0;
                    let productTotal = (product.sample_fee || 0) + (clientUnitPrice * totalQty);
                    let shippingAmount = 0;
                    
                    if (product.selected_shipping_method === 'air') {
                      shippingAmount = product.client_shipping_air_price || 0;
                    } else if (product.selected_shipping_method === 'boat') {
                      shippingAmount = product.client_shipping_boat_price || 0;
                    }
                    
                    productTotal += shippingAmount;
                    const isSelected = selectedProducts.includes(product.id);
                    
                    return (
                      <tr key={product.id} className={`border-b ${!isSelected ? 'opacity-50' : ''}`}>
                        <td className="py-3 px-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProducts([...selectedProducts, product.id]);
                              } else {
                                setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                              }
                            }}
                            className="w-4 h-4 text-blue-600"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <div>
                            <p className="font-medium text-gray-900">{product.description || product.product?.title || 'Product'}</p>
                            <p className="text-sm text-gray-600">{product.product_order_number}</p>
                            {product.selected_shipping_method && shippingAmount > 0 && (
                              <p className="text-xs text-gray-900 mt-1 flex items-center gap-1">
                                {product.selected_shipping_method === 'air' ? <Plane className="w-3 h-3" /> : <Ship className="w-3 h-3" />}
                                {product.selected_shipping_method === 'air' ? 'Air' : 'Boat'} shipping included
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right text-black font-medium">{totalQty}</td>
                        <td className="py-3 px-2 text-right text-gray-900">${clientUnitPrice.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right text-gray-900">${(product.sample_fee || 0).toFixed(2)}</td>
                        <td className="py-3 px-2 text-right text-gray-900">
                          {shippingAmount > 0 ? (
                            <div className="flex flex-col items-end">
                              <span className="font-medium">${shippingAmount.toFixed(2)}</span>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                {product.selected_shipping_method === 'air' ? <Plane className="w-3 h-3" /> : <Ship className="w-3 h-3" />}
                                {product.selected_shipping_method === 'air' ? 'Air' : 'Boat'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right font-semibold text-gray-900">${productTotal.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                  
                  {/* Custom Items */}
                  {customItems.map((item, index) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-3 px-2">
                        <button
                          onClick={() => setCustomItems(customItems.filter(i => i.id !== item.id))}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => {
                            const updated = [...customItems];
                            updated[index].description = e.target.value;
                            setCustomItems(updated);
                          }}
                          placeholder="Description"
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            const updated = [...customItems];
                            updated[index].quantity = parseInt(e.target.value) || 0;
                            setCustomItems(updated);
                          }}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-right text-gray-900"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          value={item.price}
                          step="0.01"
                          onChange={(e) => {
                            const updated = [...customItems];
                            updated[index].price = parseFloat(e.target.value) || 0;
                            setCustomItems(updated);
                          }}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right text-gray-900"
                        />
                      </td>
                      <td className="py-3 px-2 text-right text-gray-400">-</td>
                      <td className="py-3 px-2 text-right text-gray-400">-</td>
                      <td className="py-3 px-2 text-right font-semibold text-gray-900">${(item.quantity * item.price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Mobile Cards */}
            <div className="lg:hidden space-y-2">
              {invoiceData.products.map((product) => {
                const totalQty = product.order_items.reduce((sum: number, item: any) => sum + item.quantity, 0);
                const clientUnitPrice = product.client_product_price || 0;
                let productTotal = (product.sample_fee || 0) + (clientUnitPrice * totalQty);
                let shippingAmount = 0;
                
                if (product.selected_shipping_method === 'air') {
                  shippingAmount = product.client_shipping_air_price || 0;
                } else if (product.selected_shipping_method === 'boat') {
                  shippingAmount = product.client_shipping_boat_price || 0;
                }
                
                productTotal += shippingAmount;
                const isSelected = selectedProducts.includes(product.id);
                
                return (
                  <div key={product.id} className={`border rounded-lg p-2.5 ${!isSelected ? 'opacity-50 bg-gray-50' : 'bg-white'}`}>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProducts([...selectedProducts, product.id]);
                          } else {
                            setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm leading-tight">{product.description || product.product?.title}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{product.product_order_number}</p>
                        
                        <div className="mt-2 space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Qty:</span>
                            <span className="font-medium text-gray-900">{totalQty}</span>
                          </div>
                          {clientUnitPrice > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Unit Price:</span>
                              <span className="text-gray-900">${clientUnitPrice.toFixed(2)}</span>
                            </div>
                          )}
                          {product.sample_fee > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Sample Fee:</span>
                              <span className="text-gray-900">${product.sample_fee.toFixed(2)}</span>
                            </div>
                          )}
                          {shippingAmount > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">{product.selected_shipping_method === 'air' ? 'Air' : 'Boat'} Shipping:</span>
                              <span className="text-gray-900">${shippingAmount.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t pt-1">
                            <span className="font-medium text-gray-900">Total:</span>
                            <span className="font-bold text-gray-900">${productTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Custom Items - Mobile */}
              {customItems.map((item, index) => (
                <div key={item.id} className="border rounded-lg p-2.5 bg-blue-50 border-blue-200">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-medium text-gray-900 text-sm">Custom Item</p>
                    <button
                      onClick={() => setCustomItems(customItems.filter(i => i.id !== item.id))}
                      className="text-red-600 hover:text-red-700 text-xs px-2 py-0.5 border border-red-300 rounded"
                    >
                      Remove
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Description</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => {
                          const updated = [...customItems];
                          updated[index].description = e.target.value;
                          setCustomItems(updated);
                        }}
                        placeholder="Enter description"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Quantity</label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            const updated = [...customItems];
                            updated[index].quantity = parseInt(e.target.value) || 0;
                            setCustomItems(updated);
                          }}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Price</label>
                        <input
                          type="number"
                          value={item.price}
                          step="0.01"
                          onChange={(e) => {
                            const updated = [...customItems];
                            updated[index].price = parseFloat(e.target.value) || 0;
                            setCustomItems(updated);
                          }}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900"
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-between border-t pt-2 mt-2">
                      <span className="font-medium text-gray-900 text-sm">Total:</span>
                      <span className="font-bold text-gray-900 text-sm">${(item.quantity * item.price).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <button
              onClick={() => {
                setCustomItems([...customItems, {
                  id: crypto.randomUUID(),
                  description: '',
                  quantity: 1,
                  price: 0
                }]);
              }}
              className="mt-3 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 border border-blue-300 rounded"
            >
              + Add Custom Item
            </button>
          </div>

          {/* Totals */}
          <div className="p-3 sm:p-6 lg:p-8 bg-gray-50 sm:bg-transparent">
            <div className="flex justify-end">
              <div className="w-full sm:w-72 lg:w-80">
                <div className="flex justify-between py-2 text-sm sm:text-base">
                  <span className="text-gray-700 font-medium">Subtotal:</span>
                  <span className="font-medium text-gray-900">${selectedTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 items-center text-sm sm:text-base">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <input
                      type="checkbox"
                      id="applyTax"
                      checked={applyTax}
                      onChange={(e) => setApplyTax(e.target.checked)}
                      className="w-4 h-4 text-blue-600 flex-shrink-0"
                    />
                    <label htmlFor="applyTax" className="text-gray-700 font-medium text-sm sm:text-base">
                      Tax ({taxRate}%)
                    </label>
                    {applyTax && (
                      <input
                        type="number"
                        value={taxRate}
                        onChange={(e) => setTaxRate(Math.max(0, parseFloat(e.target.value) || 0))}
                        min="0"
                        step="0.01"
                        className="w-14 sm:w-16 px-1 py-0.5 text-xs sm:text-sm border border-gray-300 rounded text-gray-900"
                      />
                    )}
                  </div>
                  <span className="font-medium text-gray-900">
                    ${applyTax ? ((selectedTotal * taxRate) / 100).toFixed(2) : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between py-2.5 sm:py-3 border-t border-gray-300 text-base sm:text-lg">
                  <span className="font-semibold text-gray-900">Total:</span>
                  <span className="font-bold text-gray-900 text-lg sm:text-xl">
                    ${(selectedTotal + (applyTax ? (selectedTotal * taxRate) / 100 : 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="p-3 sm:p-6 lg:p-8 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-8">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-2.5 sm:px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="Additional notes for the client..."
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">Payment Terms</label>
                <input
                  type="text"
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full px-2.5 sm:px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Info */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> Invoice number <strong>{generatedInvoiceNumber}</strong> has been reserved for this invoice. 
            Once saved or sent, this number will be permanently assigned.
          </p>
        </div>
      </div>

      {/* QR Code Modal */}
      <QRCodeModal 
        isOpen={showQRCode}
        onClose={() => setShowQRCode(false)}
        invoiceUrl={invoiceDownloadUrl}
        invoiceNumber={invoiceData?.invoiceNumber || ''}
        isLoading={qrLoading}
      />

      {/* Send Invoice Modal */}
      <SendInvoiceModal
        isOpen={showEmailPreview}
        onClose={() => setShowEmailPreview(false)}
        onSend={async (sendData) => {
          await handleCreateInvoice('sent', sendData);
        }}
        onSuccess={handleSendSuccess}
        invoiceData={invoiceData}
        billToEmail={billToEmail}
        billToName={billToName}
        billToPhone={billToPhone}
        invoiceTotal={selectedTotal + (applyTax ? (selectedTotal * taxRate) / 100 : 0)}
        selectedProducts={invoiceData?.products.filter(p => selectedProducts.includes(p.id)) || []}
        customItems={customItems}
      />
    </div>
  );
}