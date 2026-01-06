/**
 * Client Invoice Page - /dashboard/invoices/client
 * View invoices sent by admin, track payment status, see outstanding balance
 * Features: Outstanding balance header, invoice list, payment status, PDF viewer modal
 * UPDATED: Cleaner layout, PDF opens in modal/popup, better spacing
 * Mobile responsive
 * Last Modified: December 2024
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  FileText, DollarSign, Clock, CheckCircle, 
  Loader2, Eye, X, Calendar, AlertCircle,
  ArrowLeft, CreditCard, Receipt, ExternalLink, Download
} from 'lucide-react';

interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string;
  amount: number;
  status: string;
  due_date?: string;
  paid_at?: string;
  paid_amount?: number;
  notes?: string;
  created_at: string;
  sent_at?: string;
  pay_link?: string;
  pdf_url?: string;
  order?: {
    order_number: string;
    order_name: string;
  };
}

export default function ClientInvoicePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  
  // PDF Viewer Modal
  const [pdfModal, setPdfModal] = useState<{
    isOpen: boolean;
    invoice: Invoice | null;
  }>({
    isOpen: false,
    invoice: null
  });

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (pdfModal.isOpen) {
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
  }, [pdfModal.isOpen]);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }

    const user = JSON.parse(userData);
    if (user.role !== 'client') {
      router.push('/dashboard');
      return;
    }

    fetchInvoices(user.email);
  }, [router]);

  const fetchInvoices = async (email: string) => {
    try {
      setLoading(true);

      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, name')
        .eq('email', email);

      if (clientError || !clientData || clientData.length === 0) {
        console.error('Error finding client:', clientError);
        setLoading(false);
        return;
      }

      const client = clientData[0];
      setClientId(client.id);

      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          order:orders(order_number, order_name)
        `)
        .eq('client_id', client.id)
        .in('status', ['sent', 'paid', 'overdue'])
        .order('created_at', { ascending: false });

      if (invoicesError) {
        console.error('Error fetching invoices:', invoicesError);
        setLoading(false);
        return;
      }

      setInvoices(invoicesData || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | string | null | undefined) => {
    const num = parseFloat(String(amount || 0));
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isOverdue = (invoice: Invoice): boolean => {
    if (invoice.status === 'paid') return false;
    if (!invoice.due_date) return false;
    return new Date(invoice.due_date) < new Date();
  };

  const getStatusBadge = (invoice: Invoice) => {
    if (invoice.status === 'paid') {
      return (
        <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5" />
          Paid
        </span>
      );
    }
    
    if (isOverdue(invoice)) {
      return (
        <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          Overdue
        </span>
      );
    }
    
    return (
      <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" />
        Pending
      </span>
    );
  };

  // Handle view invoice - open PDF or modal
  const handleViewInvoice = (invoice: Invoice) => {
    if (invoice.pdf_url) {
      // On mobile, open in new tab for better experience
      if (window.innerWidth < 768) {
        window.open(invoice.pdf_url, '_blank');
      } else {
        // On desktop, show in modal
        setPdfModal({ isOpen: true, invoice });
      }
    } else {
      // No PDF available - show info modal
      setPdfModal({ isOpen: true, invoice });
    }
  };

  // Calculate totals
  const outstandingInvoices = invoices.filter(inv => inv.status !== 'paid');
  const paidInvoices = invoices.filter(inv => inv.status === 'paid');
  
  const totalOutstanding = outstandingInvoices.reduce((sum, inv) => 
    sum + parseFloat(String(inv.amount || 0)), 0
  );
  
  const totalPaid = paidInvoices.reduce((sum, inv) => 
    sum + parseFloat(String(inv.paid_amount || inv.amount || 0)), 0
  );

  const overdueCount = invoices.filter(inv => isOverdue(inv)).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
          <p className="mt-3 text-gray-500 text-sm">Loading invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Compact Header with Summary Stats */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Title */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Invoices</h1>
            </div>

            {/* Inline Stats - Desktop */}
            <div className="hidden sm:flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${totalOutstanding > 0 ? 'bg-amber-500' : 'bg-green-500'}`} />
                <span className="text-sm text-gray-600">Outstanding:</span>
                <span className={`font-bold ${totalOutstanding > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                  ${formatCurrency(totalOutstanding)}
                </span>
                {overdueCount > 0 && (
                  <span className="text-xs text-red-600 font-medium">({overdueCount} overdue)</span>
                )}
              </div>
              <div className="w-px h-6 bg-gray-200" />
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm text-gray-600">Paid:</span>
                <span className="font-bold text-green-600">${formatCurrency(totalPaid)}</span>
              </div>
            </div>
          </div>

          {/* Mobile Stats Cards */}
          <div className="sm:hidden grid grid-cols-2 gap-3 mt-4">
            <div className={`p-3 rounded-lg ${totalOutstanding > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
              <p className="text-xs text-gray-600">Outstanding</p>
              <p className={`text-lg font-bold ${totalOutstanding > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                ${formatCurrency(totalOutstanding)}
              </p>
              {overdueCount > 0 && (
                <p className="text-xs text-red-600 mt-0.5">{overdueCount} overdue</p>
              )}
            </div>
            <div className="p-3 rounded-lg bg-green-50 border border-green-200">
              <p className="text-xs text-gray-600">Total Paid</p>
              <p className="text-lg font-bold text-green-700">${formatCurrency(totalPaid)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice List - Full Width */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {invoices.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7 text-gray-400" />
            </div>
            <p className="text-gray-700 font-medium">No invoices yet</p>
            <p className="text-gray-400 text-sm mt-1">Invoices will appear here once sent</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Table Header - Desktop */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <div className="col-span-4">Invoice</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-2">Due Date</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            <div className="divide-y divide-gray-100">
              {invoices.map((invoice) => {
                const overdue = isOverdue(invoice);
                const isPaid = invoice.status === 'paid';
                
                return (
                  <div 
                    key={invoice.id}
                    className={`px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors ${
                      overdue ? 'bg-red-50/30' : ''
                    }`}
                  >
                    {/* Desktop Layout */}
                    <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                      {/* Invoice Info */}
                      <div className="col-span-4 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isPaid ? 'bg-green-500' : overdue ? 'bg-red-500' : 'bg-blue-500'
                        }`}>
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{invoice.invoice_number}</span>
                            {getStatusBadge(invoice)}
                          </div>
                          <p className="text-sm text-gray-500 truncate">
                            {invoice.order?.order_name || invoice.order?.order_number || '—'}
                          </p>
                        </div>
                      </div>

                      {/* Sent Date */}
                      <div className="col-span-2 text-sm text-gray-600">
                        {invoice.sent_at ? formatDate(invoice.sent_at) : '—'}
                      </div>

                      {/* Due Date */}
                      <div className="col-span-2">
                        {isPaid && invoice.paid_at ? (
                          <span className="text-sm text-green-600 flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Paid {formatDate(invoice.paid_at)}
                          </span>
                        ) : invoice.due_date ? (
                          <span className={`text-sm ${overdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                            {formatDate(invoice.due_date)}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </div>

                      {/* Amount */}
                      <div className="col-span-2 text-right">
                        <span className={`text-lg font-bold ${
                          isPaid ? 'text-green-600' : overdue ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          ${formatCurrency(invoice.amount)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="col-span-2 flex items-center justify-end gap-2">
                        {!isPaid && invoice.pay_link && (
                          <a
                            href={invoice.pay_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1.5"
                          >
                            <CreditCard className="w-4 h-4" />
                            Pay
                          </a>
                        )}
                        <button
                          onClick={() => handleViewInvoice(invoice)}
                          className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                          title="View Invoice"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Mobile Layout */}
                    <div className="md:hidden flex flex-col gap-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            isPaid ? 'bg-green-500' : overdue ? 'bg-red-500' : 'bg-blue-500'
                          }`}>
                            <FileText className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900">{invoice.invoice_number}</span>
                              {getStatusBadge(invoice)}
                            </div>
                            <p className="text-sm text-gray-500">
                              {invoice.order?.order_name || invoice.order?.order_number || '—'}
                            </p>
                          </div>
                        </div>
                        <span className={`text-lg font-bold ${
                          isPaid ? 'text-green-600' : overdue ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          ${formatCurrency(invoice.amount)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pl-13">
                        <div className="text-xs text-gray-500 space-y-0.5">
                          {invoice.sent_at && <p>Sent {formatDate(invoice.sent_at)}</p>}
                          {!isPaid && invoice.due_date && (
                            <p className={overdue ? 'text-red-600 font-medium' : ''}>
                              Due {formatDate(invoice.due_date)}
                            </p>
                          )}
                          {isPaid && invoice.paid_at && (
                            <p className="text-green-600">Paid {formatDate(invoice.paid_at)}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!isPaid && invoice.pay_link && (
                            <a
                              href={invoice.pay_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
                            >
                              Pay
                            </a>
                          )}
                          <button
                            onClick={() => handleViewInvoice(invoice)}
                            className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-400">
          Questions? Contact{' '}
          <a href="mailto:sales@bybirdhaus.com" className="text-blue-600 hover:text-blue-700 font-medium">
            sales@bybirdhaus.com
          </a>
        </div>
      </div>

      {/* PDF Viewer Modal */}
      {pdfModal.isOpen && pdfModal.invoice && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">{pdfModal.invoice.invoice_number}</h3>
                  <p className="text-xs text-gray-500">
                    {pdfModal.invoice.order?.order_name || pdfModal.invoice.order?.order_number}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {pdfModal.invoice.pdf_url && (
                  <a
                    href={pdfModal.invoice.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                )}
                <button
                  onClick={() => setPdfModal({ isOpen: false, invoice: null })}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            
            {/* PDF Content */}
            <div className="flex-1 overflow-hidden bg-gray-100">
              {pdfModal.invoice.pdf_url ? (
                <iframe
                  src={pdfModal.invoice.pdf_url}
                  className="w-full h-full min-h-[60vh]"
                  title={`Invoice ${pdfModal.invoice.invoice_number}`}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[40vh] p-6">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-700 font-medium">PDF not available</p>
                  <p className="text-gray-500 text-sm mt-1 text-center">
                    The PDF for this invoice hasn't been generated yet.
                  </p>
                  
                  {/* Show invoice summary instead */}
                  <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200 w-full max-w-sm">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">
                        ${formatCurrency(pdfModal.invoice.amount)}
                      </p>
                      <div className="mt-2">{getStatusBadge(pdfModal.invoice)}</div>
                      {pdfModal.invoice.due_date && pdfModal.invoice.status !== 'paid' && (
                        <p className={`text-sm mt-2 ${isOverdue(pdfModal.invoice) ? 'text-red-600' : 'text-gray-500'}`}>
                          Due {formatDate(pdfModal.invoice.due_date)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer - Pay Button */}
            {pdfModal.invoice.status !== 'paid' && pdfModal.invoice.pay_link && (
              <div className="px-4 sm:px-6 py-4 border-t border-gray-200 bg-white flex-shrink-0">
                <a
                  href={pdfModal.invoice.pay_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
                >
                  <CreditCard className="w-5 h-5" />
                  Pay Now - ${formatCurrency(pdfModal.invoice.amount)}
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}