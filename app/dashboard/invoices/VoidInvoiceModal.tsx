/**
 * VoidInvoiceModal - Modal to void an invoice
 * Requires a reason before voiding
 * Marks associated products as un-invoiced
 * Last Modified: December 1, 2025
 */

'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, AlertTriangle, FileX, Loader2 } from 'lucide-react';

interface VoidInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: {
    id: string;
    invoice_number: string;
    amount: number;
    status: string;
  };
  onVoided: () => void; // Callback after successful void
}

export default function VoidInvoiceModal({
  isOpen,
  onClose,
  invoice,
  onVoided
}: VoidInvoiceModalProps) {
  const [voidReason, setVoidReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Prevent background scroll when modal is open
  React.useEffect(() => {
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

  const handleVoid = async () => {
    if (!voidReason.trim()) {
      setError('Please provide a reason for voiding this invoice');
      return;
    }

    if (voidReason.trim().length < 10) {
      setError('Please provide a more detailed reason (at least 10 characters)');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const user = JSON.parse(localStorage.getItem('user') || '{}');

      // 1. Mark invoice as voided (don't include voided_by if it might cause FK issues)
      const updateData: any = {
        voided: true,
        voided_at: new Date().toISOString(),
        void_reason: voidReason.trim(),
        status: 'voided'
      };
      
      // Only add voided_by if we have a valid user ID
      if (user.id) {
        updateData.voided_by = user.id;
      }

      const { error: voidError, data: voidData } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoice.id)
        .select();

      if (voidError) {
        console.error('Error voiding invoice:', voidError);
        console.error('Error details:', JSON.stringify(voidError, null, 2));
        console.error('Error message:', voidError.message);
        console.error('Error code:', voidError.code);
        setError(`Failed to void invoice: ${voidError.message || 'Unknown error'}`);
        return;
      }
      
      console.log('Void successful:', voidData);

      // 2. Get invoice items to find which products were on this invoice
      const { data: invoiceItems, error: itemsError } = await supabase
        .from('invoice_items')
        .select('order_product_id')
        .eq('invoice_id', invoice.id)
        .not('order_product_id', 'is', null);

      if (!itemsError && invoiceItems && invoiceItems.length > 0) {
        // 3. Mark those products as un-invoiced
        const productIds = invoiceItems
          .map(item => item.order_product_id)
          .filter(Boolean);

        if (productIds.length > 0) {
          const { error: updateError } = await supabase
            .from('order_products')
            .update({
              invoiced: false,
              invoiced_at: null,
              invoice_id: null
            })
            .in('id', productIds);

          if (updateError) {
            console.error('Error un-invoicing products:', updateError);
            // Don't fail the whole operation, invoice is already voided
          }
        }
      }

      // 4. Add audit log entry
      await supabase
        .from('audit_log')
        .insert({
          action: 'invoice_voided',
          entity_type: 'invoice',
          entity_id: invoice.id,
          user_id: user.id || null,
          details: {
            invoice_number: invoice.invoice_number,
            amount: invoice.amount,
            void_reason: voidReason.trim()
          }
        });

      // Success - close modal and notify parent
      onVoided();
      onClose();

    } catch (err) {
      console.error('Error in void process:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <FileX className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Void Invoice</h3>
              <p className="text-sm text-gray-500">{invoice.invoice_number}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">This action cannot be undone</p>
              <p className="text-xs text-amber-700 mt-1">
                Voiding this invoice will mark it as cancelled. The products on this invoice 
                will become available to include in a new invoice.
              </p>
            </div>
          </div>

          {/* Invoice Summary */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Invoice Amount:</span>
              <span className="text-lg font-bold text-gray-900">${formatCurrency(invoice.amount)}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-gray-600">Current Status:</span>
              <span className="text-sm font-medium text-gray-900 capitalize">{invoice.status}</span>
            </div>
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Voiding <span className="text-red-500">*</span>
            </label>
            <textarea
              value={voidReason}
              onChange={(e) => {
                setVoidReason(e.target.value);
                setError('');
              }}
              placeholder="Please explain why this invoice is being voided (e.g., 'Client requested changes to product quantities', 'Incorrect pricing applied')..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900 placeholder-gray-400 resize-none"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimum 10 characters required. This will be saved for audit purposes.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleVoid}
            disabled={loading || !voidReason.trim()}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Voiding...
              </>
            ) : (
              <>
                <FileX className="w-4 h-4" />
                Void Invoice
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}