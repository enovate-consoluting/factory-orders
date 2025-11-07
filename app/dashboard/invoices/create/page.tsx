'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { 
  ArrowLeft, Building, Calendar, Package, Download,
  Mail, Phone, MapPin, FileText, DollarSign, Save,
  Send, ChevronRight, Plus, X, AlertCircle
} from 'lucide-react';
import { notify } from '@/app/hooks/useUINotification';
import EmailPreviewModal from '../EmailPreviewModal';

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

export default function CreateInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order');
  const supabase = createClientComponentClient();
  
  const [loading, setLoading] = useState(true);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('Net 30 days');
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
  
  useEffect(() => {
    if (orderId) {
      fetchOrderData();
    }
  }, [orderId]);
  
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
            order_items (
              quantity
            )
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;

      const approvedProducts = orderData.order_products.filter((p: any) => 
        p.product_status === 'approved_for_production' || 
        p.product_status === 'in_production' ||
        p.product_status === 'completed'
      );

      let subtotal = 0;
      approvedProducts.forEach((product: any) => {
        const totalQty = product.order_items.reduce((sum: number, item: any) => sum + item.quantity, 0);
        const productTotal = (product.sample_fee || 0) + ((product.product_price || 0) * totalQty);
        subtotal += productTotal;
      });

      const invoiceCount = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true });
      
      const invoiceNumber = `INV-${String((invoiceCount.count || 0) + 1).padStart(4, '0')}`;
      
      const defaultDueDate = new Date();
      defaultDueDate.setDate(defaultDueDate.getDate() + 30);
      setDueDate(defaultDueDate.toISOString().split('T')[0]);

      setInvoiceData({
        order: orderData,
        products: approvedProducts,
        client: orderData.client,
        subtotal: subtotal,
        tax: 0,
        total: subtotal,
        invoiceNumber: invoiceNumber,
        dueDate: defaultDueDate.toISOString().split('T')[0]
      });

      setSelectedProducts(approvedProducts.map((p: any) => p.id));
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
        return sum + (product.sample_fee || 0) + ((product.product_price || 0) * totalQty);
      }, 0);
      
    const customTotal = customItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    
    return productTotal + customTotal;
  };

  const handleCreateInvoice = async (status: 'draft' | 'sent', emailData?: { to: string[], cc: string[] }) => {
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
      
      // Create invoice in database
      const { data: invoice, error } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceData?.invoiceNumber,
          order_id: orderId,
          client_id: invoiceData?.client.id,
          amount: total,
          paid_amount: 0,
          status: status,
          due_date: dueDate,
          notes: notes,
          payment_terms: terms,
          created_by: user.id,
          mark_as_paid_on_send: markAsPaidOnSend
        })
        .select()
        .single();

      if (error) {
        console.error('Invoice creation error:', error);
        throw error;
      }

      // Create invoice items
      const invoiceItems = [];
      
      for (const productId of selectedProducts) {
        const product = invoiceData?.products.find(p => p.id === productId);
        if (product) {
          const totalQty = product.order_items.reduce((qty: number, item: any) => qty + item.quantity, 0);
          
          if (product.sample_fee > 0) {
            invoiceItems.push({
              invoice_id: invoice.id,
              order_product_id: productId,
              description: `${product.product.title} - Sample Fee`,
              amount: product.sample_fee
            });
          }
          
          if (product.product_price > 0) {
            invoiceItems.push({
              invoice_id: invoice.id,
              order_product_id: productId,
              description: `${product.product.title} - Production (${totalQty} units)`,
              amount: product.product_price * totalQty
            });
          }
        }
      }
      
      // Add custom items
      for (const item of customItems) {
        invoiceItems.push({
          invoice_id: invoice.id,
          order_product_id: null,
          description: item.description,
          amount: item.quantity * item.price
        });
      }
      
      if (invoiceItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(invoiceItems);
          
        if (itemsError) {
          console.error('Invoice items error:', itemsError);
          throw itemsError;
        }
      }

      // Log to audit
      await supabase
        .from('audit_log')
        .insert({
          user_id: user.id,
          user_name: user.name || 'User',
          action_type: status === 'sent' ? 'invoice_sent' : 'invoice_created',
          target_type: 'invoice',
          target_id: invoice.id,
          old_value: null,
          new_value: `Invoice ${invoiceData?.invoiceNumber} ${status === 'sent' ? 'sent to' : 'saved for'} ${billToName}`,
          timestamp: new Date().toISOString()
        });

      notify.success(`Invoice ${invoiceData?.invoiceNumber} saved as draft`);
      router.push('/dashboard/invoices');
    } catch (error) {
      console.error('Error creating invoice:', error);
      notify.error(`Failed to save invoice`);
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Create Invoice</h1>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.back()}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCreateInvoice('draft')}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                disabled={saving}
              >
                <Save className="w-4 h-4" />
                Save Draft
              </button>
              <button
                onClick={handleSendClick}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                disabled={saving}
              >
                <Send className="w-4 h-4" />
                Send Invoice
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Preview */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg">
          {/* Invoice Header */}
          <div className="p-8 border-b">
            <div className="flex justify-between items-start">
              <div>
                {logoUrl && (
                  <>
                    <img 
                      src={logoUrl} 
                      alt="Company Logo" 
                      className="h-12 mb-3 cursor-pointer"
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
                          title="Increase font size"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => setCompanyNameFontSize(Math.max(companyNameFontSize - 2, 14))}
                          className="text-xs text-gray-600 hover:text-gray-900"
                          title="Decrease font size"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={companyTagline}
                      onChange={(e) => setCompanyTagline(e.target.value)}
                      className="text-gray-700 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none"
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
                    <p className="text-gray-700 group-hover:text-blue-600">
                      {companyTagline}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="text-right">
                <h2 className="text-3xl font-bold text-gray-900 mb-1">INVOICE</h2>
                <p className="text-gray-700 font-medium">#{invoiceData.invoiceNumber}</p>
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="p-8 grid grid-cols-2 gap-8">
            {/* Bill To */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">Bill To:</h4>
                <button
                  onClick={() => setEditingBillTo(!editingBillTo)}
                  className="text-xs text-blue-600 hover:text-blue-700"
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
                  <p className="text-gray-700">{billToEmail}</p>
                  {billToAddress && <p className="text-gray-700">{billToAddress}</p>}
                  {billToPhone && <p className="text-gray-700">{billToPhone}</p>}
                </div>
              )}
            </div>

            {/* Invoice Info */}
            <div className="text-right">
              <div className="space-y-2">
                <div>
                  <span className="text-gray-700 font-medium">Invoice Date:</span>
                  <span className="ml-2 font-medium text-gray-900">{new Date().toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-gray-700 font-medium">Due Date:</span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="ml-2 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                  />
                </div>
                <div>
                  <span className="text-gray-700 font-medium">Order #:</span>
                  <span className="ml-2 font-medium text-gray-900">{invoiceData.order.order_number}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Products Table */}
          <div className="px-8">
            <h4 className="font-semibold text-gray-900 mb-3">Products</h4>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Select</th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Product</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-gray-700">Qty</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-gray-700">Unit Price</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-gray-700">Sample Fee</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoiceData.products.map((product) => {
                  const totalQty = product.order_items.reduce((sum: number, item: any) => sum + item.quantity, 0);
                  const productTotal = (product.sample_fee || 0) + ((product.product_price || 0) * totalQty);
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
                          <p className="font-medium text-gray-900">{product.product.title}</p>
                          <p className="text-sm text-gray-600">{product.product_order_number}</p>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right text-gray-900 font-medium">{totalQty}</td>
                      <td className="py-3 px-2 text-right text-gray-900">
                        ${(product.product_price || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-2 text-right text-gray-900">
                        ${(product.sample_fee || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-2 text-right font-semibold text-gray-900">
                        ${productTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
                
                {/* Custom Line Items */}
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
                    <td className="py-3 px-2 text-right text-gray-900">-</td>
                    <td className="py-3 px-2 text-right font-semibold text-gray-900">
                      ${(item.quantity * item.price).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
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
          <div className="p-8">
            <div className="flex justify-end">
              <div className="w-64">
                <div className="flex justify-between py-2">
                  <span className="text-gray-700 font-medium">Subtotal:</span>
                  <span className="font-medium text-gray-900">${selectedTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 items-center">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="applyTax"
                      checked={applyTax}
                      onChange={(e) => setApplyTax(e.target.checked)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <label htmlFor="applyTax" className="text-gray-700 font-medium">
                      Tax ({taxRate}%)
                    </label>
                    {applyTax && (
                      <input
                        type="number"
                        value={taxRate}
                        onChange={(e) => setTaxRate(Math.max(0, parseFloat(e.target.value) || 0))}
                        min="0"
                        step="0.01"
                        className="w-16 px-1 py-0.5 text-sm border border-gray-300 rounded text-gray-900"
                      />
                    )}
                  </div>
                  <span className="font-medium text-gray-900">
                    ${applyTax ? ((selectedTotal * taxRate) / 100).toFixed(2) : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between py-3 border-t border-gray-300 text-lg">
                  <span className="font-semibold text-gray-900">Total:</span>
                  <span className="font-bold text-gray-900">
                    ${(selectedTotal + (applyTax ? (selectedTotal * taxRate) / 100 : 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="p-8 border-t">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="Additional notes for the client..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Terms
                </label>
                <input
                  type="text"
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Info */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> Only approved products are shown. This invoice will be created as a draft. 
            You can send it to the client after reviewing.
          </p>
        </div>

        {/* Mark as Paid Option */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={markAsPaidOnSend}
              onChange={(e) => setMarkAsPaidOnSend(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700 font-medium">
              Mark selected products as paid when invoice is sent
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-7">
            This will automatically update the payment status of the selected products when the invoice email is sent.
          </p>
        </div>
      </div>

      {/* Email Preview Modal - SIMPLIFIED WORKING VERSION */}
      <EmailPreviewModal
        isOpen={showEmailPreview}
        onClose={() => setShowEmailPreview(false)}
        onSend={async (emailData) => {
          console.log('=== STARTING SIMPLIFIED INVOICE SEND ===');
          setShowEmailPreview(false);
          setSaving(true);
          
          try {
            const subtotal = calculateSelectedTotal();
            const taxAmount = applyTax ? (subtotal * taxRate) / 100 : 0;
            const total = subtotal + taxAmount;
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            
            // Step 1: Create invoice with minimal required fields (like test button)
            console.log('Creating invoice with minimal fields...');
            const { data: invoice, error } = await supabase
              .from('invoices')
              .insert({
                invoice_number: invoiceData?.invoiceNumber || `INV-${Date.now()}`,
                order_id: orderId,
                client_id: invoiceData?.client.id,
                amount: total,
                status: 'sent'
              })
              .select()
              .single();
            
            if (error) {
              console.error('Invoice creation error:', error);
              notify.error('Failed to create invoice');
              setShowEmailPreview(true);
              setSaving(false);
              return;
            }
            
            console.log('Invoice created successfully:', invoice.id);
            
            // Step 2: Send email (we know this works)
            console.log('Sending email...');
            const response = await fetch('/api/invoices/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                invoiceId: invoice.id,
                recipientEmail: emailData.to[0],
                ccEmails: [...emailData.to.slice(1), ...emailData.cc]
              })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
              console.error('Email send failed:', result);
              notify.error('Failed to send email');
              // Don't return - still update the invoice
            } else {
              console.log('Email sent successfully');
              notify.success(`Invoice ${invoiceData?.invoiceNumber} sent successfully!`);
            }
            
            // Step 3: Update invoice with additional fields
            console.log('Updating invoice with additional fields...');
            const { error: updateError } = await supabase
              .from('invoices')
              .update({
                paid_amount: 0,
                due_date: dueDate,
                notes: notes || '',
                payment_terms: terms || 'Net 30 days',
                created_by: user.id || null,
                mark_as_paid_on_send: markAsPaidOnSend || false
              })
              .eq('id', invoice.id);
              
            if (updateError) {
              console.error('Update error:', updateError);
              // Don't fail - invoice is already created
            }
            
            // Step 4: Create invoice items
            const invoiceItems = [];
            
            for (const productId of selectedProducts) {
              const product = invoiceData?.products.find(p => p.id === productId);
              if (product) {
                const totalQty = product.order_items.reduce((qty: number, item: any) => qty + item.quantity, 0);
                
                if (product.sample_fee > 0) {
                  invoiceItems.push({
                    invoice_id: invoice.id,
                    order_product_id: productId,
                    description: `${product.product.title} - Sample Fee`,
                    amount: product.sample_fee
                  });
                }
                
                if (product.product_price > 0 && totalQty > 0) {
                  invoiceItems.push({
                    invoice_id: invoice.id,
                    order_product_id: productId,
                    description: `${product.product.title} - Production (${totalQty} units)`,
                    amount: product.product_price * totalQty
                  });
                }
              }
            }
            
            // Add custom items
            for (const item of customItems) {
              invoiceItems.push({
                invoice_id: invoice.id,
                order_product_id: null,
                description: item.description,
                amount: item.quantity * item.price
              });
            }
            
            if (invoiceItems.length > 0) {
              const { error: itemsError } = await supabase
                .from('invoice_items')
                .insert(invoiceItems);
                
              if (itemsError) {
                console.error('Invoice items error:', itemsError);
                // Don't fail - invoice is already created
              }
            }
            
            // Step 5: Update payment status if needed
            if (markAsPaidOnSend) {
              console.log('Updating payment status...');
              for (const productId of selectedProducts) {
                const product = invoiceData?.products.find(p => p.id === productId);
                if (product) {
                  const totalQty = product.order_items.reduce((qty: number, item: any) => qty + item.quantity, 0);
                  const productAmount = (product.sample_fee || 0) + ((product.product_price || 0) * totalQty);
                  
                  await supabase
                    .from('order_products')
                    .update({
                      payment_status: 'paid',
                      paid_amount: productAmount
                    })
                    .eq('id', productId);
                }
              }
            }
            
            // Step 6: Log to audit
            await supabase
              .from('audit_log')
              .insert({
                user_id: user.id || null,
                user_name: user.name || 'User',
                action_type: 'invoice_sent',
                target_type: 'invoice',
                target_id: invoice.id,
                old_value: null,
                new_value: `Invoice ${invoiceData?.invoiceNumber} sent to ${billToName}`,
                timestamp: new Date().toISOString()
              });
            
            console.log('=== INVOICE PROCESS COMPLETED ===');
            
            // Redirect to invoices list
            router.push('/dashboard/invoices');
            
          } catch (error) {
            console.error('=== ERROR IN INVOICE PROCESS ===');
            console.error('Error:', error);
            notify.error('Failed to process invoice - check console');
            setShowEmailPreview(true);
          } finally {
            setSaving(false);
          }
        }}
        invoiceData={invoiceData}
        billToEmail={billToEmail}
        billToName={billToName}
        invoiceTotal={selectedTotal + (applyTax ? (selectedTotal * taxRate) / 100 : 0)}
        selectedProducts={invoiceData?.products.filter(p => selectedProducts.includes(p.id)) || []}
      />
    </div>
  );
}