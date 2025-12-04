/**
 * SetProductionDaysModal - Modal for bulk setting production days on products
 * Allows manufacturer to set production timeline for ETA calculation
 * ETA = production_start_date + production_days + shipping_days
 * Roles: Manufacturer
 * Last Modified: December 4, 2025
 */

import React, { useState, useEffect } from 'react';
import { X, Clock, Save, Loader2, Package, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Product {
  id: string;
  product_order_number: string;
  description: string;
  production_days: number | null;
  selected_shipping_method: string | null;
  production_time: string | null;
}

interface SetProductionDaysModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onUpdate?: () => void;
}

export function SetProductionDaysModal({
  isOpen,
  onClose,
  products,
  onUpdate
}: SetProductionDaysModalProps) {
  const [productionDays, setProductionDays] = useState<Record<string, number | null>>({});
  const [bulkDays, setBulkDays] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize with existing values
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, number | null> = {};
      products.forEach(p => {
        initial[p.id] = p.production_days || null;
      });
      setProductionDays(initial);
      setBulkDays('');
      setError(null);
    }
  }, [isOpen, products]);

  if (!isOpen) return null;

  // Apply bulk value to all products
  const applyBulkDays = () => {
    const days = parseInt(bulkDays);
    if (isNaN(days) || days < 1) {
      setError('Enter a valid number of days (minimum 1)');
      return;
    }
    
    const updated: Record<string, number | null> = {};
    products.forEach(p => {
      updated[p.id] = days;
    });
    setProductionDays(updated);
    setError(null);
  };

  // Update single product
  const updateProductDays = (productId: string, value: string) => {
    const days = value === '' ? null : parseInt(value);
    setProductionDays(prev => ({
      ...prev,
      [productId]: isNaN(days as number) ? null : days
    }));
  };

  // Save all production days
  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Update each product
      const updates = Object.entries(productionDays).map(([productId, days]) => {
        return supabase
          .from('order_products')
          .update({ production_days: days })
          .eq('id', productId);
      });

      const results = await Promise.all(updates);
      
      // Check for errors
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error('Failed to update some products');
      }

      // Success - close and refresh
      if (onUpdate) {
        onUpdate();
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving production days:', err);
      setError(err.message || 'Failed to save production days');
    } finally {
      setSaving(false);
    }
  };

  // Count products with days set
  const productsWithDays = Object.values(productionDays).filter(d => d !== null && d > 0).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Set Production Days</h2>
              <p className="text-sm text-gray-500">Enter manufacturing time for ETA calculation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bulk Apply Section */}
        <div className="p-4 bg-indigo-50 border-b">
          <label className="block text-sm font-medium text-indigo-900 mb-2">
            Apply to All Products
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                min="1"
                value={bulkDays}
                onChange={(e) => setBulkDays(e.target.value)}
                placeholder="Enter days (e.g., 25)"
                className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">days</span>
            </div>
            <button
              onClick={applyBulkDays}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Apply to All
            </button>
          </div>
        </div>

        {/* Products List */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="w-8 h-8 bg-white rounded flex items-center justify-center border">
                  <Package className="w-4 h-4 text-gray-400" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {product.product_order_number}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    {product.description || 'No description'}
                  </p>
                  {product.production_time && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Note: {product.production_time}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={productionDays[product.id] ?? ''}
                      onChange={(e) => updateProductDays(product.id, e.target.value)}
                      placeholder="Days"
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-10">days</span>
                </div>

                {/* Shipping indicator */}
                {product.selected_shipping_method && (
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    product.selected_shipping_method === 'air' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-cyan-100 text-cyan-700'
                  }`}>
                    {product.selected_shipping_method === 'air' ? '✈️ Air' : '🚢 Boat'}
                  </div>
                )}
              </div>
            ))}
          </div>

          {products.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No products available
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <span className="font-medium text-indigo-600">{productsWithDays}</span> of {products.length} products have production days set
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2 font-medium"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Production Days
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
