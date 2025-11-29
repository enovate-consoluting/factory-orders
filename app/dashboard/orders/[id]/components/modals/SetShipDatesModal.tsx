/**
 * SetShipDatesModal - Modal for setting estimated ship dates on products
 * Manufacturer enters number of days, can set bulk or individual per product
 * UPDATED: Description first, days blank unless date exists in DB
 * Roles: Manufacturer
 * Last Modified: Nov 28 2025
 */

'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, Package, Check, Loader2, Clock, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Product {
  id: string;
  product_order_number: string;
  description?: string;
  product_status: string;
  estimated_ship_date?: string;
}

interface ProductDays {
  [productId: string]: string;
}

interface SetShipDatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onUpdate: () => void;
}

export function SetShipDatesModal({ 
  isOpen, 
  onClose, 
  products,
  onUpdate 
}: SetShipDatesModalProps) {
  const [bulkDays, setBulkDays] = useState<string>('30');
  const [productDays, setProductDays] = useState<ProductDays>({});
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter to only show products that can have ship dates set
  const eligibleProducts = products.filter(p => 
    p.product_status === 'in_production' || 
    p.product_status === 'approved_for_production' ||
    p.product_status === 'ready_for_production' ||
    p.product_status === 'pending_manufacturer' ||
    p.product_status === 'pending'
  );

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setBulkDays('30');
      setSelectedProducts(new Set(eligibleProducts.map(p => p.id)));
      setError(null);
      
      // Initialize individual days - ONLY populate if date exists in database
      const initialDays: ProductDays = {};
      eligibleProducts.forEach(p => {
        if (p.estimated_ship_date) {
          // Calculate days from existing date
          const existingDate = new Date(p.estimated_ship_date + 'T00:00:00');
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((existingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          initialDays[p.id] = diffDays > 0 ? String(diffDays) : '';
        } else {
          // No date in database = blank field
          initialDays[p.id] = '';
        }
      });
      setProductDays(initialDays);
    }
  }, [isOpen, products]);

  // Calculate the ship date based on days
  const calculateShipDate = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  // Format date for display
  const formatDateForDisplay = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Apply bulk days to all selected products
  const applyBulkDays = () => {
    const newProductDays = { ...productDays };
    selectedProducts.forEach(productId => {
      newProductDays[productId] = bulkDays;
    });
    setProductDays(newProductDays);
  };

  // Update individual product days
  const updateProductDays = (productId: string, days: string) => {
    setProductDays(prev => ({
      ...prev,
      [productId]: days
    }));
  };

  // Toggle product selection
  const toggleProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  // Select/Deselect all
  const toggleAll = () => {
    if (selectedProducts.size === eligibleProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(eligibleProducts.map(p => p.id)));
    }
  };

  // Count products with days set
  const productsWithDaysSet = Array.from(selectedProducts).filter(id => {
    const days = productDays[id];
    return days && parseInt(days) > 0;
  }).length;

  // Save ship dates
  const handleSave = async () => {
    if (selectedProducts.size === 0) {
      setError('Please select at least one product');
      return;
    }

    // Check if any selected products have days set
    const productsToSave = Array.from(selectedProducts).filter(id => {
      const days = productDays[id];
      return days && parseInt(days) > 0;
    });

    if (productsToSave.length === 0) {
      setError('Please set days for at least one selected product');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      // Update each product with its individual date
      for (const productId of productsToSave) {
        const days = parseInt(productDays[productId]) || 0;
        if (days > 0) {
          const shipDate = calculateShipDate(days);
          
          await supabase
            .from('order_products')
            .update({ estimated_ship_date: shipDate })
            .eq('id', productId);
        }
      }

      await supabase.from('audit_log').insert({
        user_id: user.id || crypto.randomUUID(),
        user_name: user.name || user.email || 'Manufacturer',
        action_type: 'ship_date_set',
        target_type: 'order_products',
        target_id: productsToSave[0],
        new_value: `Ship dates set for ${productsToSave.length} product(s)`,
        timestamp: new Date().toISOString()
      });

      onUpdate();
      onClose();
    } catch (err: any) {
      console.error('Error saving ship dates:', err);
      setError(err.message || 'Error saving ship dates');
    } finally {
      setSaving(false);
    }
  };

  // Clear dates (set to null)
  const handleClearDates = async () => {
    if (selectedProducts.size === 0) {
      setError('Please select at least one product to clear');
      return;
    }

    setClearing(true);
    setError(null);

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const productIds = Array.from(selectedProducts);

      const { error: updateError } = await supabase
        .from('order_products')
        .update({ estimated_ship_date: null })
        .in('id', productIds);

      if (updateError) throw updateError;

      await supabase.from('audit_log').insert({
        user_id: user.id || crypto.randomUUID(),
        user_name: user.name || user.email || 'Manufacturer',
        action_type: 'ship_date_cleared',
        target_type: 'order_products',
        target_id: productIds[0],
        new_value: `Ship dates cleared for ${productIds.length} product(s)`,
        timestamp: new Date().toISOString()
      });

      onUpdate();
      onClose();
    } catch (err: any) {
      console.error('Error clearing ship dates:', err);
      setError(err.message || 'Error clearing ship dates');
    } finally {
      setClearing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Set Ship Dates</h2>
              <p className="text-sm text-gray-500">{eligibleProducts.length} products available</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bulk Days Input */}
        <div className="px-6 py-4 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-gray-700 font-medium">Set all selected to ship in</span>
              <input
                type="number"
                value={bulkDays}
                onChange={(e) => setBulkDays(e.target.value)}
                min="1"
                max="365"
                className="w-20 px-3 py-1.5 border-2 border-orange-300 rounded-lg text-center font-bold text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <span className="text-gray-700 font-medium">days</span>
            </div>
            <button
              onClick={applyBulkDays}
              disabled={selectedProducts.size === 0}
              className="px-4 py-1.5 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Apply to Selected
            </button>
          </div>
          {parseInt(bulkDays) > 0 && (
            <p className="text-sm text-orange-700 mt-2 flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Ships on: <strong>{formatDateForDisplay(calculateShipDate(parseInt(bulkDays)))}</strong>
            </p>
          )}
        </div>

        {/* Product List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {eligibleProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No products in production</p>
              <p className="text-xs text-gray-400 mt-1">Products must be in production or approved</p>
            </div>
          ) : (
            <>
              {/* Select All Row */}
              <div className="flex items-center justify-between py-3 mb-3 border-b-2 border-gray-200">
                <div 
                  onClick={toggleAll}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    selectedProducts.size === eligibleProducts.length 
                      ? 'bg-orange-600 border-orange-600' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}>
                    {selectedProducts.size === eligibleProducts.length && (
                      <Check className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                  <span className="font-medium text-gray-700">Select All Products</span>
                </div>
                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {selectedProducts.size} of {eligibleProducts.length} selected
                </span>
              </div>

              {/* Product Rows */}
              <div className="space-y-2">
                {eligibleProducts.map((product) => {
                  const isSelected = selectedProducts.has(product.id);
                  const days = productDays[product.id] || '';
                  const daysNum = parseInt(days) || 0;
                  const calculatedDate = daysNum > 0 ? calculateShipDate(daysNum) : null;
                  
                  return (
                    <div
                      key={product.id}
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                        isSelected 
                          ? 'border-orange-300 bg-orange-50/50' 
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      {/* Checkbox */}
                      <div 
                        onClick={() => toggleProduct(product.id)}
                        className="cursor-pointer"
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-orange-600 border-orange-600' : 'border-gray-300'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </div>
                      
                      {/* Product Info - DESCRIPTION FIRST */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{product.description || 'No description'}</p>
                        <p className="text-sm text-gray-500">{product.product_order_number}</p>
                        {product.estimated_ship_date && (
                          <p className="text-xs text-blue-600 mt-1">
                            Current ship date: {formatDateForDisplay(product.estimated_ship_date)}
                          </p>
                        )}
                      </div>

                      {/* Individual Days Input */}
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={days}
                          onChange={(e) => updateProductDays(product.id, e.target.value)}
                          min="1"
                          max="365"
                          placeholder="—"
                          className={`w-16 px-2 py-1.5 border rounded-lg text-center font-medium text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                            isSelected ? 'border-orange-300 bg-white' : 'border-gray-200 bg-gray-50'
                          }`}
                        />
                        <span className="text-sm text-gray-500 w-10">days</span>
                      </div>

                      {/* Calculated Date */}
                      <div className="text-right w-32">
                        {calculatedDate ? (
                          <p className={`text-sm font-medium ${isSelected ? 'text-orange-600' : 'text-gray-400'}`}>
                            {formatDateForDisplay(calculatedDate)}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-300">—</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-6 py-3 bg-red-50 border-t border-red-100">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div className="flex items-center justify-between">
            <button
              onClick={handleClearDates}
              disabled={clearing || saving || selectedProducts.size === 0}
              className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
            >
              {clearing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Clear Dates
                </>
              )}
            </button>

            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {productsWithDaysSet > 0 && `${productsWithDaysSet} product(s) ready`}
              </span>
              <button
                onClick={onClose}
                disabled={saving || clearing}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || clearing || productsWithDaysSet === 0}
                className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    Set Dates
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}