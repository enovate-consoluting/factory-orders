/**
 * DeletedProductsSection - Shows soft-deleted products for super_admin
 * Allows viewing deletion reason and optionally restoring products
 * Only visible to super_admin users
 * Last Modified: January 2026
 */

import React, { useState, useEffect } from 'react';
import { Trash2, ChevronDown, ChevronUp, RotateCcw, AlertTriangle, Loader2, Package, Calendar, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProductDelete } from '../../hooks/useProductDelete';

interface DeletedProduct {
  id: string;
  product_order_number: string;
  description: string;
  deleted_at: string;
  deleted_by_name: string;
  deletion_reason: string;
  product_status: string;
  product?: {
    title: string;
  };
}

// Only these emails can see deleted products and restore them
const AUTHORIZED_EMAILS = ['admin@test.com'];

interface DeletedProductsSectionProps {
  orderId: string;
  userRole: string;
  onRestore?: () => void;
}

export function DeletedProductsSection({
  orderId,
  userRole,
  onRestore
}: DeletedProductsSectionProps) {
  const [deletedProducts, setDeletedProducts] = useState<DeletedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const { restoreProduct } = useProductDelete();

  // Check if current user is authorized to see deleted products
  const getUserEmail = (): string => {
    try {
      const userData = localStorage.getItem('user');
      if (!userData) return '';
      const user = JSON.parse(userData);
      return user.email?.toLowerCase() || '';
    } catch {
      return '';
    }
  };

  const userEmail = getUserEmail();
  const isAuthorized = AUTHORIZED_EMAILS.includes(userEmail);

  // Only authorized emails can see this section
  if (!isAuthorized) {
    return null;
  }

  useEffect(() => {
    fetchDeletedProducts();
  }, [orderId]);

  const fetchDeletedProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('order_products')
        .select(`
          id,
          product_order_number,
          description,
          deleted_at,
          deleted_by_name,
          deletion_reason,
          product_status,
          product:products(title)
        `)
        .eq('order_id', orderId)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (error) {
        console.error('Error fetching deleted products:', error);
        return;
      }

      // Transform data: Supabase returns product as array, extract first element
      const transformedData = (data || []).map(item => ({
        ...item,
        product: Array.isArray(item.product) ? item.product[0] : item.product
      }));

      setDeletedProducts(transformedData);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (productId: string) => {
    setRestoringId(productId);

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const result = await restoreProduct(productId, user.id, user.name || user.email);

    if (result.success) {
      // Remove from local list
      setDeletedProducts(prev => prev.filter(p => p.id !== productId));
      // Trigger parent refresh
      if (onRestore) {
        onRestore();
      }
    } else {
      alert(result.error || 'Failed to restore product');
    }

    setRestoringId(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Don't show section if no deleted products
  if (!loading && deletedProducts.length === 0) {
    return null;
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden mt-4">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-red-100 hover:bg-red-150 transition-colors"
      >
        <div className="flex items-center gap-2 text-red-700">
          <Trash2 className="w-4 h-4" />
          <span className="font-medium text-sm">
            Deleted Products ({loading ? '...' : deletedProducts.length})
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-red-600" />
        ) : (
          <ChevronDown className="w-4 h-4 text-red-600" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-red-500" />
            </div>
          ) : (
            deletedProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-lg border border-red-200 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Product Info */}
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900 text-sm">
                        {product.product_order_number}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
                        Deleted
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mb-2">
                      {product.product?.title || product.description || 'No description'}
                    </p>

                    {/* Deletion Details */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(product.deleted_at)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>{product.deleted_by_name}</span>
                      </div>
                    </div>

                    {/* Deletion Reason */}
                    <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-800">
                      <span className="font-medium">Reason:</span> {product.deletion_reason}
                    </div>
                  </div>

                  {/* Restore Button */}
                  <button
                    onClick={() => handleRestore(product.id)}
                    disabled={restoringId === product.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded text-xs font-medium hover:bg-green-200 transition-colors disabled:opacity-50"
                  >
                    {restoringId === product.id ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Restoring...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3 h-3" />
                        Restore
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Admin Only:</strong> These products have been soft-deleted
              and are hidden from all reports and calculations. You can restore them
              if they were deleted by mistake.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
