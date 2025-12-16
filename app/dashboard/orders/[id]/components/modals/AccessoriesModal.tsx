/**
 * AccessoriesModal - Modal for adding clothing accessories to an order
 * Manufacturer selects accessories from inventory, sets fees, applies to products
 * Roles: Manufacturer, Admin, Super Admin
 * Last Modified: December 2025
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Tag,
  Package,
  Loader2,
  AlertTriangle,
  Check,
  DollarSign,
  Plus
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AccessoryInventory {
  id: string;
  accessory_type_id: string;
  quantity_on_hand: number;
  low_stock_threshold: number;
  accessory_type: {
    id: string;
    name: string;
    code: string;
  };
}

interface OrderProduct {
  id: string;
  product_order_number: string;
  description?: string;
  order_items?: { quantity: number }[];
}

interface AccessoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  clientId: string;
  clientName: string;
  manufacturerId: string;
  products: OrderProduct[];
  onSuccess: () => void;
}

export function AccessoriesModal({
  isOpen,
  onClose,
  orderId,
  clientId,
  clientName,
  manufacturerId,
  products,
  onSuccess
}: AccessoriesModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inventory, setInventory] = useState<AccessoryInventory[]>([]);
  
  // Selected accessories with fees
  const [selectedAccessories, setSelectedAccessories] = useState<{
    [accessoryTypeId: string]: {
      checked: boolean;
      feePerUnit: string;
      inventoryId: string;
      availableQty: number;
      name: string;
    };
  }>({});
  
  // Selected products
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  
  // Accessory margin from system config
  const [accessoryMargin, setAccessoryMargin] = useState(100);

  useEffect(() => {
    if (isOpen && clientId && manufacturerId) {
      loadInventory();
    }
  }, [isOpen, clientId, manufacturerId]);

  const loadInventory = async () => {
    setLoading(true);
    try {
      // Load accessory margin from system config
      const { data: configData } = await supabase
        .from('system_config')
        .select('config_value')
        .eq('config_key', 'accessory_margin_percentage')
        .single();
      
      if (configData) {
        setAccessoryMargin(parseFloat(configData.config_value) || 100);
      }

      const { data, error } = await supabase
        .from('manufacturer_accessories_inventory')
        .select(`
          *,
          accessory_type:accessory_types(id, name, code)
        `)
        .eq('manufacturer_id', manufacturerId)
        .eq('client_id', clientId);

      if (error) throw error;

      setInventory(data || []);
      
      // Initialize selected accessories state
      const initial: typeof selectedAccessories = {};
      (data || []).forEach(item => {
        initial[item.accessory_type_id] = {
          checked: false,
          feePerUnit: '',
          inventoryId: item.id,
          availableQty: item.quantity_on_hand,
          name: item.accessory_type?.name || 'Unknown'
        };
      });
      setSelectedAccessories(initial);
      
      // Select all products by default
      setSelectedProducts(new Set(products.map(p => p.id)));
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAccessory = (accessoryTypeId: string) => {
    setSelectedAccessories(prev => ({
      ...prev,
      [accessoryTypeId]: {
        ...prev[accessoryTypeId],
        checked: !prev[accessoryTypeId].checked
      }
    }));
  };

  const updateFee = (accessoryTypeId: string, fee: string) => {
    setSelectedAccessories(prev => ({
      ...prev,
      [accessoryTypeId]: {
        ...prev[accessoryTypeId],
        feePerUnit: fee
      }
    }));
  };

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const toggleAllProducts = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  // Calculate total quantity needed (sum of all selected products' quantities)
  const calculateTotalQtyNeeded = () => {
    let total = 0;
    products.forEach(p => {
      if (selectedProducts.has(p.id)) {
        const qty = p.order_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
        total += qty;
      }
    });
    return total;
  };

  const totalQtyNeeded = calculateTotalQtyNeeded();

  // Calculate totals for summary
  const calculateSummary = () => {
    let totalFee = 0;
    let accessoryCount = 0;

    Object.entries(selectedAccessories).forEach(([typeId, acc]) => {
      if (acc.checked && acc.feePerUnit) {
        const fee = parseFloat(acc.feePerUnit) || 0;
        totalFee += fee * totalQtyNeeded;
        accessoryCount++;
      }
    });

    return { totalFee, accessoryCount };
  };

  const summary = calculateSummary();

  const handleSubmit = async () => {
    // Validate
    const checkedAccessories = Object.entries(selectedAccessories).filter(([_, acc]) => acc.checked);
    
    if (checkedAccessories.length === 0) {
      alert('Please select at least one accessory');
      return;
    }

    if (selectedProducts.size === 0) {
      alert('Please select at least one product');
      return;
    }

    // Check if fees are set
    const missingFees = checkedAccessories.filter(([_, acc]) => !acc.feePerUnit || parseFloat(acc.feePerUnit) <= 0);
    if (missingFees.length > 0) {
      alert('Please set a fee for all selected accessories');
      return;
    }

    // Check inventory availability
    for (const [typeId, acc] of checkedAccessories) {
      if (totalQtyNeeded > acc.availableQty) {
        alert(`Not enough ${acc.name} in stock. Need ${totalQtyNeeded}, have ${acc.availableQty}`);
        return;
      }
    }

    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      for (const [accessoryTypeId, acc] of checkedAccessories) {
        const feePerUnit = parseFloat(acc.feePerUnit);
        const totalFee = feePerUnit * totalQtyNeeded;
        
        // Calculate client fees with margin
        const clientFeePerUnit = Math.round(feePerUnit * (1 + accessoryMargin / 100) * 100) / 100;
        const clientTotalFee = Math.round(clientFeePerUnit * totalQtyNeeded * 100) / 100;

        // 1. Create order_accessories record
        const { data: orderAccessory, error: insertError } = await supabase
          .from('order_accessories')
          .insert({
            order_id: orderId,
            manufacturer_id: manufacturerId,
            client_id: clientId,
            accessory_type_id: accessoryTypeId,
            quantity_used: totalQtyNeeded,
            fee_per_unit: feePerUnit,
            total_fee: totalFee,
            client_fee_per_unit: clientFeePerUnit,
            client_total_fee: clientTotalFee,
            inventory_id: acc.inventoryId,
            created_by: user.id
          })
          .select()
          .single();

        if (insertError) {
          console.error('Insert error details:', insertError.message, insertError.details, insertError.hint);
          throw insertError;
        }

        // 2. Link to selected products
        const productLinks = Array.from(selectedProducts).map(productId => ({
          order_accessory_id: orderAccessory.id,
          order_product_id: productId
        }));

        const { error: linkError } = await supabase
          .from('order_accessory_products')
          .insert(productLinks);

        if (linkError) throw linkError;

        // 3. Deduct from inventory
        const { error: deductError } = await supabase
          .from('manufacturer_accessories_inventory')
          .update({
            quantity_on_hand: acc.availableQty - totalQtyNeeded,
            updated_at: new Date().toISOString()
          })
          .eq('id', acc.inventoryId);

        if (deductError) throw deductError;
      }

      // 4. Audit log
      await supabase.from('audit_log').insert({
        user_id: user.id,
        user_name: user.name || user.email || 'Unknown',
        action_type: 'accessories_added',
        target_type: 'order',
        target_id: orderId,
        new_value: `Added ${checkedAccessories.length} accessory type(s) to order`,
        timestamp: new Date().toISOString()
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error adding accessories:', error?.message || error);
      console.error('Error details:', error?.details, error?.hint, error?.code);
      alert(`Error adding accessories: ${error?.message || 'Unknown error'}. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Tag className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Add Clothing Accessories</h2>
              <p className="text-sm text-gray-500">Client: {clientName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : inventory.length === 0 ? (
          <div className="p-8 text-center">
            <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Inventory Found</h3>
            <p className="text-gray-500 mb-4">
              No accessories inventory found for {clientName}.
            </p>
            <p className="text-sm text-gray-400">
              Add inventory items in the Inventory page first.
            </p>
          </div>
        ) : (
          <>
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Top Section: Available Accessories */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Available Accessories for {clientName}
                </h3>
                
                <div className="space-y-2">
                  {inventory.map(item => {
                    const isLowStock = item.quantity_on_hand <= item.low_stock_threshold;
                    const isOutOfStock = item.quantity_on_hand === 0;
                    const accState = selectedAccessories[item.accessory_type_id];
                    
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-4 p-3 rounded-lg border-2 transition-all ${
                          accState?.checked
                            ? 'border-purple-300 bg-purple-50'
                            : isOutOfStock
                            ? 'border-gray-200 bg-gray-50 opacity-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => !isOutOfStock && toggleAccessory(item.accessory_type_id)}
                          disabled={isOutOfStock}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            accState?.checked
                              ? 'bg-purple-600 border-purple-600'
                              : 'border-gray-300 hover:border-gray-400'
                          } ${isOutOfStock ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          {accState?.checked && <Check className="w-3.5 h-3.5 text-white" />}
                        </button>

                        {/* Name */}
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{item.accessory_type?.name}</p>
                        </div>

                        {/* On Hand */}
                        <div className="text-center">
                          <p className={`text-sm font-semibold ${
                            isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-gray-900'
                          }`}>
                            {item.quantity_on_hand.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">On Hand</p>
                        </div>

                        {/* Status */}
                        <div className="w-24 text-center">
                          {isOutOfStock ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                              Out of Stock
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                              <AlertTriangle className="w-3 h-3" />
                              Low
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                              In Stock
                            </span>
                          )}
                        </div>

                        {/* Fee Input */}
                        <div className="w-28">
                          <div className="relative">
                            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={accState?.feePerUnit || ''}
                              onChange={(e) => updateFee(item.accessory_type_id, e.target.value)}
                              placeholder="Fee"
                              disabled={!accState?.checked || isOutOfStock}
                              className="w-full pl-7 pr-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
                            />
                          </div>
                          <p className="text-xs text-gray-400 text-center mt-0.5">per unit</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Section: Apply to Products */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Apply to Products
                </h3>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Select All */}
                  <div
                    onClick={toggleAllProducts}
                    className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100"
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedProducts.size === products.length
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-gray-300'
                    }`}>
                      {selectedProducts.size === products.length && (
                        <Check className="w-3.5 h-3.5 text-white" />
                      )}
                    </div>
                    <span className="font-medium text-gray-700">Select All Products</span>
                    <span className="ml-auto text-sm text-gray-500">
                      {selectedProducts.size} of {products.length} selected
                    </span>
                  </div>

                  {/* Product List */}
                  <div className="max-h-48 overflow-y-auto">
                    {products.map(product => {
                      const qty = product.order_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
                      const isSelected = selectedProducts.has(product.id);
                      
                      return (
                        <div
                          key={product.id}
                          onClick={() => toggleProduct(product.id)}
                          className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0 cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {product.product_order_number}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {product.description || 'No description'}
                            </p>
                          </div>
                          <span className="text-sm text-gray-600">
                            {qty} units
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quantity Summary */}
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Total quantity:</strong> {totalQtyNeeded.toLocaleString()} units across {selectedProducts.size} product(s)
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                {/* Summary */}
                <div>
                  {summary.accessoryCount > 0 ? (
                    <p className="text-sm text-gray-700">
                      <strong>{summary.accessoryCount}</strong> accessory type(s) × <strong>{totalQtyNeeded}</strong> units = 
                      <span className="text-green-600 font-bold ml-1">
                        ${summary.totalFee.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">Select accessories and set fees</p>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    disabled={saving}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={saving || summary.accessoryCount === 0}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Add Accessories
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

