/**
 * ExistingInvoicesModal - Invoice Gate
 * Shows when trying to create invoice on an order that already has invoices
 * User must void existing invoices or choose to invoice remaining products
 * Last Modified: December 1, 2025
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  X, FileText, AlertTriangle, Plus, FileX,
  CheckCircle, Clock, AlertCircle, ChevronRight
} from 'lucide-react';
import VoidInvoiceModal from './VoidInvoiceModal';

interface ExistingInvoice {
  id: string;
  invoice_number: string;
  amount: number;
  status: string;
  created_at: string;
  sent_at?: string;
  voided: boolean;
}

interface ExistingInvoicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  existingInvoices: ExistingInvoice[];
  uninvoicedProductCount: number;
  totalProductCount: number;
  onProceedWithRemaining: () => void; // Create invoice for uninvoiced products only
  onRefresh: () => void; // Refresh data after voiding
}

export default function ExistingInvoicesModal({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  existingInvoices,
  uninvoicedProductCount,
  totalProductCount,
  onProceedWithRemaining,
  onRefresh
}: ExistingInvoicesModalProps) {
  const [voidModal, setVoidModal] = useState<{
    isOpen: boolean;
    invoice: ExistingInvoice | null;
  }>({
    isOpen: false,
    invoice: null
  });

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

  if (!isOpen) return null;

  // Filter out voided invoices for display
  const activeInvoices = existingInvoices.filter(inv => !inv.voided);
  const voidedInvoices = existingInvoices.filter(inv => inv.voided);

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', {
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

  const getStatusBadge = (invoice: ExistingInvoice) => {
    if (invoice.voided) {
      return (
        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full flex items-center gap-1">
          <FileX className="w-3 h-3" />
          Voided
        </span>
      );
    }
    
    switch (invoice.status) {
      case 'paid':
        return (
          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Paid
          </span>
        );
      case 'sent':
        return (
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Sent
          </span>
        );
      case 'draft':
        return (
          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full flex items-center gap-1">
            <FileText className="w-3 h-3" />
            Draft
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
            {invoice.status}
          </span>
        );
    }
  };

  const handleVoidClick = (invoice: ExistingInvoice) => {
    setVoidModal({ isOpen: true, invoice });
  };

  const handleVoidComplete = () => {
    setVoidModal({ isOpen: false, invoice: null });
    onRefresh();
  };

  const allProductsInvoiced = uninvoicedProductCount === 0;
  const hasActiveInvoices = activeInvoices.length > 0;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Existing Invoices Found</h3>
                <p className="text-sm text-gray-500">Order {orderNumber}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1">
            {/* Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Invoice Summary</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-600">Total Products:</span>
                  <span className="ml-2 font-semibold text-blue-900">{totalProductCount}</span>
                </div>
                <div>
                  <span className="text-blue-600">Already Invoiced:</span>
                  <span className="ml-2 font-semibold text-blue-900">{totalProductCount - uninvoicedProductCount}</span>
                </div>
                <div>
                  <span className="text-blue-600">Not Yet Invoiced:</span>
                  <span className="ml-2 font-semibold text-blue-900">{uninvoicedProductCount}</span>
                </div>
                <div>
                  <span className="text-blue-600">Active Invoices:</span>
                  <span className="ml-2 font-semibold text-blue-900">{activeInvoices.length}</span>
                </div>
              </div>
            </div>

            {/* Active Invoices List */}
            {activeInvoices.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Active Invoices</h4>
                <div className="space-y-2">
                  {activeInvoices.map((invoice) => (
                    <div 
                      key={invoice.id}
                      className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{invoice.invoice_number}</span>
                            {getStatusBadge(invoice)}
                          </div>
                          <p className="text-xs text-gray-500">
                            {invoice.sent_at ? `Sent ${formatDate(invoice.sent_at)}` : `Created ${formatDate(invoice.created_at)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-gray-900">${formatCurrency(invoice.amount)}</span>
                        {invoice.status !== 'paid' && (
                          <button
                            onClick={() => handleVoidClick(invoice)}
                            className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            Void
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Voided Invoices (collapsed) */}
            {voidedInvoices.length > 0 && (
              <div className="mb-6">
                <details className="group">
                  <summary className="text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700 flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />
                    Voided Invoices ({voidedInvoices.length})
                  </summary>
                  <div className="mt-2 space-y-2 pl-6">
                    {voidedInvoices.map((invoice) => (
                      <div 
                        key={invoice.id}
                        className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg opacity-60"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                            <FileX className="w-4 h-4 text-gray-500" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-600 line-through">{invoice.invoice_number}</span>
                              {getStatusBadge(invoice)}
                            </div>
                            <p className="text-xs text-gray-400">
                              Created {formatDate(invoice.created_at)}
                            </p>
                          </div>
                        </div>
                        <span className="font-semibold text-gray-500 line-through">${formatCurrency(invoice.amount)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">What would you like to do?</h4>
              
              {allProductsInvoiced ? (
                <p className="text-sm text-gray-600">
                  All products on this order have been invoiced. To create a new invoice, 
                  you must first <strong>void</strong> an existing invoice. This will make 
                  those products available for a new invoice.
                </p>
              ) : (
                <p className="text-sm text-gray-600">
                  You have <strong>{uninvoicedProductCount} product{uninvoicedProductCount !== 1 ? 's' : ''}</strong> that 
                  {uninvoicedProductCount !== 1 ? ' have' : ' has'} not been invoiced yet. You can create a new invoice 
                  for just {uninvoicedProductCount !== 1 ? 'these products' : 'this product'}, or void an existing invoice 
                  to re-invoice those products.
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            
            {!allProductsInvoiced && (
              <button
                onClick={onProceedWithRemaining}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Invoice {uninvoicedProductCount} Product{uninvoicedProductCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Void Invoice Modal */}
      {voidModal.invoice && (
        <VoidInvoiceModal
          isOpen={voidModal.isOpen}
          onClose={() => setVoidModal({ isOpen: false, invoice: null })}
          invoice={voidModal.invoice}
          onVoided={handleVoidComplete}
        />
      )}
    </>
  );
}
