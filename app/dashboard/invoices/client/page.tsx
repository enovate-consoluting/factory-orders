/**
 * Client Invoice Page - /dashboard/invoices/client
 * View invoices sent by admin, track payment status, see outstanding balance
 * Features: Outstanding balance header, invoice list, payment status, view invoice modal with PAY NOW button
 * UPDATED: Now shows pay_link button and pdf_url if available
 * Mobile responsive
 * Last Modified: December 1, 2025
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
  pay_link?: string;  // Square payment link
  pdf_url?: string;   // PDF document URL
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
  
  // View Invoice Modal
  const [viewModal, setViewModal] = useState<{
    isOpen: boolean;
    invoice: Invoice | null;
  }>({
    isOpen: false,
    invoice: null
  });

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (viewModal.isOpen) {
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
  }, [viewModal.isOpen]);

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

      // Fetch invoices with pay_link and pdf_url
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
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Invoices</h1>
              <p className="text-gray-500 mt-0.5 text-sm sm:text-base">View and track your invoices</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6">
        
        {/* Balance Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
          {/* Outstanding Balance */}
          <div className={`p-4 sm:p-5 rounded-xl border-2 ${
            totalOutstanding > 0 ? 'bg-amber-50 border-amber-300' : 'bg-green-50 border-green-300'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${
                totalOutstanding > 0 ? 'bg-amber-500' : 'bg-green-500'
              }`}>
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Outstanding Balance</p>
                <p className={`text-xl sm:text-2xl font-bold ${
                  totalOutstanding > 0 ? 'text-amber-700' : 'text-green-700'
                }`}>
                  ${formatCurrency(totalOutstanding)}
                </p>
              </div>
            </div>
            {overdueCount > 0 && (
              <div className="mt-3 pt-3 border-t border-amber-200">
                <p className="text-xs text-red-600 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {overdueCount} invoice{overdueCount !== 1 ? 's' : ''} overdue
                </p>
              </div>
            )}
          </div>

          {/* Pending Invoices Count */}
          <div className="p-4 sm:p-5 rounded-xl border-2 bg-white border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center bg-blue-100">
                <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Pending Invoices</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {outstandingInvoices.length}
                </p>
              </div>
            </div>
          </div>

          {/* Total Paid */}
          <div className="p-4 sm:p-5 rounded-xl border-2 bg-white border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center bg-green-100">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total Paid</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  ${formatCurrency(totalPaid)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Invoices List */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <h2 className="font-semibold text-gray-900">All Invoices</h2>
          </div>

          {invoices.length === 0 ? (
            <div className="py-12 sm:py-16 text-center px-4">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-7 h-7 text-gray-400" />
              </div>
              <p className="text-gray-700 font-medium">No invoices yet</p>
              <p className="text-gray-400 text-sm mt-1">Invoices will appear here once sent</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {invoices.map((invoice) => {
                const overdue = isOverdue(invoice);
                const isPaid = invoice.status === 'paid';
                
                return (
                  <div 
                    key={invoice.id}
                    className={`px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors ${
                      overdue ? 'bg-red-50/50' : ''
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Invoice Info */}
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isPaid ? 'bg-green-500' : overdue ? 'bg-red-500' : 'bg-blue-500'
                        }`}>
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                              {invoice.invoice_number}
                            </h3>
                            {getStatusBadge(invoice)}
                          </div>
                          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                            {invoice.order?.order_name || invoice.order?.order_number || 'Order'}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                            {invoice.sent_at && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Sent {formatDate(invoice.sent_at)}
                              </span>
                            )}
                            {invoice.due_date && !isPaid && (
                              <span className={`flex items-center gap-1 ${overdue ? 'text-red-500 font-medium' : ''}`}>
                                <Clock className="w-3 h-3" />
                                Due {formatDate(invoice.due_date)}
                              </span>
                            )}
                            {isPaid && invoice.paid_at && (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="w-3 h-3" />
                                Paid {formatDate(invoice.paid_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Amount & Actions */}
                      <div className="flex items-center gap-2 sm:gap-3 pl-13 sm:pl-0">
                        <div className="text-right">
                          <p className={`text-lg sm:text-xl font-bold ${
                            isPaid ? 'text-green-600' : overdue ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            ${formatCurrency(invoice.amount)}
                          </p>
                        </div>
                        
                        {/* Pay Now Button - Only show if not paid and has pay_link */}
                        {!isPaid && invoice.pay_link && (
                          <a
                            href={invoice.pay_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1.5"
                          >
                            <CreditCard className="w-4 h-4" />
                            <span className="hidden sm:inline">Pay Now</span>
                            <span className="sm:hidden">Pay</span>
                          </a>
                        )}
                        
                        <button
                          onClick={() => setViewModal({ isOpen: true, invoice })}
                          className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                          title="View Invoice"
                        >
                          <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-gray-400 px-3">
          Questions about an invoice? Contact{' '}
          <a href="mailto:sales@bybirdhaus.com" className="text-blue-600 hover:text-blue-700 font-medium">
            sales@bybirdhaus.com
          </a>
        </div>
      </div>

      {/* View Invoice Modal */}
      {viewModal.isOpen && viewModal.invoice && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  viewModal.invoice.status === 'paid' ? 'bg-green-500' : 
                  isOverdue(viewModal.invoice) ? 'bg-red-500' : 'bg-blue-500'
                }`}>
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{viewModal.invoice.invoice_number}</h3>
                  <p className="text-sm text-gray-500">Invoice Details</p>
                </div>
              </div>
              <button
                onClick={() => setViewModal({ isOpen: false, invoice: null })}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-180px)]">
              {/* Status Banner */}
              <div className={`p-4 rounded-xl ${
                viewModal.invoice.status === 'paid' 
                  ? 'bg-green-50 border border-green-200' 
                  : isOverdue(viewModal.invoice)
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-amber-50 border border-amber-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${
                      viewModal.invoice.status === 'paid' ? 'text-green-700' :
                      isOverdue(viewModal.invoice) ? 'text-red-700' : 'text-amber-700'
                    }`}>
                      {viewModal.invoice.status === 'paid' ? 'Payment Received' :
                       isOverdue(viewModal.invoice) ? 'Payment Overdue' : 'Payment Pending'}
                    </p>
                    <p className={`text-2xl font-bold mt-1 ${
                      viewModal.invoice.status === 'paid' ? 'text-green-700' :
                      isOverdue(viewModal.invoice) ? 'text-red-700' : 'text-amber-700'
                    }`}>
                      ${formatCurrency(viewModal.invoice.amount)}
                    </p>
                  </div>
                  {getStatusBadge(viewModal.invoice)}
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">Order</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {viewModal.invoice.order?.order_name || viewModal.invoice.order?.order_number || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">Invoice Date</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {viewModal.invoice.sent_at ? formatDate(viewModal.invoice.sent_at) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">Due Date</p>
                  <p className={`text-sm font-semibold mt-1 ${
                    isOverdue(viewModal.invoice) ? 'text-red-600' : 'text-gray-900'
                  }`}>
                    {viewModal.invoice.due_date ? formatDate(viewModal.invoice.due_date) : '—'}
                  </p>
                </div>
                {viewModal.invoice.status === 'paid' && viewModal.invoice.paid_at && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-medium">Paid On</p>
                    <p className="text-sm font-semibold text-green-600 mt-1">
                      {formatDate(viewModal.invoice.paid_at)}
                    </p>
                  </div>
                )}
              </div>

              {/* Notes */}
              {viewModal.invoice.notes && (
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-medium mb-2">Notes</p>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                    {viewModal.invoice.notes}
                  </p>
                </div>
              )}

              {/* PDF Download - if available */}
              {viewModal.invoice.pdf_url && (
                <div className="pt-4 border-t border-gray-100">
                  <a
                    href={viewModal.invoice.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Download className="w-5 h-5" />
                    Download Invoice PDF
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}

              {/* Pay Now Button - if not paid and has pay link */}
              {viewModal.invoice.status !== 'paid' && viewModal.invoice.pay_link && (
                <div className="pt-4 border-t border-gray-100">
                  <a
                    href={viewModal.invoice.pay_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <CreditCard className="w-5 h-5" />
                    Pay Now - ${formatCurrency(viewModal.invoice.amount)}
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Secure payment via Square
                  </p>
                </div>
              )}

              {/* Payment Instructions for unpaid without pay link */}
              {viewModal.invoice.status !== 'paid' && !viewModal.invoice.pay_link && (
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <CreditCard className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">Payment Instructions</p>
                      <p className="text-xs text-blue-600 mt-1">
                        Please contact your account manager or check your email for payment link.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setViewModal({ isOpen: false, invoice: null })}
                className="w-full py-2.5 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}