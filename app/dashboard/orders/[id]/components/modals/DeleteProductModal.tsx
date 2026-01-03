/**
 * DeleteProductModal - Modal for soft-deleting products with reason
 * Requires a reason before deletion, stores deletion metadata
 * Products are soft-deleted (hidden from queries but recoverable)
 * Roles: Admin, Super Admin
 * Last Modified: January 2026
 */

import React, { useState, useEffect } from 'react';
import { X, Trash2, AlertTriangle, Loader2, Package } from 'lucide-react';

interface Product {
  id: string;
  product_order_number: string;
  description?: string;
  product_status?: string;
  invoiced?: boolean;
}

interface DeleteProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onConfirmDelete: (productId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  userRole: string;
}

const DELETION_REASONS = [
  'Product damaged/defective',
  'Client cancelled this product',
  'Duplicate entry - entered by mistake',
  'Wrong product added to order',
  'Manufacturer cannot fulfill',
  'Sample rejected by client',
  'Pricing error - needs re-entry',
  'Other (specify below)'
];

export function DeleteProductModal({
  isOpen,
  onClose,
  product,
  onConfirmDelete,
  userRole
}: DeleteProductModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedReason('');
      setCustomReason('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen || !product) return null;

  const isSuperAdmin = userRole === 'super_admin';
  const isInvoiced = product.invoiced === true;

  // Get final reason text
  const getFinalReason = (): string => {
    if (selectedReason === 'Other (specify below)') {
      return customReason.trim();
    }
    return selectedReason;
  };

  const canDelete = (): boolean => {
    const reason = getFinalReason();
    if (!reason) return false;
    if (isInvoiced && !isSuperAdmin) return false;
    return true;
  };

  const handleDelete = async () => {
    const reason = getFinalReason();

    if (!reason) {
      setError('Please select or enter a reason for deletion');
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const result = await onConfirmDelete(product.id, reason);

      if (result.success) {
        onClose();
      } else {
        setError(result.error || 'Failed to delete product');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-red-50 border-b border-red-100 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700">
            <Trash2 className="w-5 h-5" />
            <h2 className="font-semibold">Delete Product</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-red-100 rounded-full transition-colors"
            disabled={deleting}
          >
            <X className="w-5 h-5 text-red-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Product Info */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="flex items-start gap-3">
              <Package className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">{product.product_order_number}</p>
                {product.description && (
                  <p className="text-sm text-gray-600 mt-0.5">{product.description}</p>
                )}
                {product.product_status && (
                  <p className="text-xs text-gray-500 mt-1">
                    Status: <span className="font-medium">{product.product_status}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Invoice Warning */}
          {isInvoiced && (
            <div className={`rounded-lg p-3 flex items-start gap-2 ${
              isSuperAdmin
                ? 'bg-amber-50 border border-amber-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                isSuperAdmin ? 'text-amber-600' : 'text-red-600'
              }`} />
              <div className={`text-sm ${isSuperAdmin ? 'text-amber-800' : 'text-red-800'}`}>
                {isSuperAdmin ? (
                  <>
                    <strong>Warning:</strong> This product has been invoiced.
                    As Super Admin, you can still delete it, but the invoice may need to be voided.
                  </>
                ) : (
                  <>
                    <strong>Cannot Delete:</strong> This product has been invoiced.
                    Please void the invoice first or contact a Super Admin.
                  </>
                )}
              </div>
            </div>
          )}

          {/* Reason Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for deletion <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {DELETION_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                    selectedReason === reason
                      ? 'bg-red-50 border-red-300'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="deletion-reason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                    disabled={deleting || (isInvoiced && !isSuperAdmin)}
                  />
                  <span className="text-sm text-gray-700">{reason}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom Reason Input */}
          {selectedReason === 'Other (specify below)' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Specify reason
              </label>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Enter the reason for deletion..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                disabled={deleting}
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <strong>Note:</strong> This product will be removed from the order and all reports.
            The deletion will be logged and can be reviewed by administrators.
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!canDelete() || deleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete Product
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
