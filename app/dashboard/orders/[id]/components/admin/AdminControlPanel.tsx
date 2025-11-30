/**
 * AdminControlPanel - Control panel for admin/super admin order actions
 * Shows order summary, totals, and action buttons (Print, Save All & Route)
 * Matches ManufacturerControlPanel design
 * Roles: Admin, Super Admin
 * Last Modified: November 29, 2025
 */

import React from 'react';
import { 
  Package, Printer, Save, Send, DollarSign, 
  AlertCircle, Settings
} from 'lucide-react';

interface AdminControlPanelProps {
  order: any;
  visibleProducts: any[];
  onSaveAndRoute: () => void;
  onPrintAll: () => void;
  totalAmount?: number;
}

export function AdminControlPanel({ 
  order, 
  visibleProducts,
  onSaveAndRoute,
  onPrintAll,
  totalAmount = 0
}: AdminControlPanelProps) {
  // Calculate product distribution
  const productCounts = {
    withAdmin: visibleProducts.filter(p => p.routed_to === 'admin').length,
    withManufacturer: visibleProducts.filter(p => p.routed_to === 'manufacturer').length,
    withClient: visibleProducts.filter(p => p.routed_to === 'client').length,
    total: visibleProducts.length
  };

  // Calculate totals using CLIENT prices
  const calculateTotals = () => {
    let productTotal = 0;
    let shippingTotal = 0;
    
    visibleProducts.forEach((product: any) => {
      const totalQty = product.order_items?.reduce((sum: number, item: any) => 
        sum + (item.quantity || 0), 0) || 0;
      
      // Use CLIENT prices
      productTotal += (parseFloat(product.client_product_price || 0) * totalQty);
      
      if (product.selected_shipping_method === 'air') {
        shippingTotal += parseFloat(product.client_shipping_air_price || 0);
      } else if (product.selected_shipping_method === 'boat') {
        shippingTotal += parseFloat(product.client_shipping_boat_price || 0);
      }
    });
    
    return {
      product: productTotal,
      shipping: shippingTotal,
      total: productTotal + shippingTotal
    };
  };

  const totals = calculateTotals();

  // Check if any products need attention
  const productsNeedingPricing = visibleProducts.filter(p => 
    !p.client_product_price || parseFloat(p.client_product_price) === 0
  ).length;

  const productsWithoutShipping = visibleProducts.filter(p => 
    !p.selected_shipping_method && !p.shipping_link_note
  ).length;

  return (
    <div className="mb-4 bg-white rounded-lg shadow-lg border border-gray-300 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2">
        <Settings className="w-4 h-4 text-white" />
        <h3 className="text-sm font-semibold text-white">Control Panel</h3>
      </div>
      
      <div className="p-4">
        {/* Order Info Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-xs text-gray-500">Order</span>
              <p className="font-bold text-lg text-gray-900">{order.order_number}</p>
            </div>
            <div className="h-10 w-px bg-gray-300" />
            <div>
              <span className="text-xs text-gray-500">Client</span>
              <p className="font-semibold text-gray-900">{order.client?.name}</p>
            </div>
            <div className="h-10 w-px bg-gray-300" />
            <div>
              <span className="text-xs text-gray-500">Products</span>
              <p className="font-semibold text-gray-900">{visibleProducts.length}</p>
            </div>
            
            {/* Product Distribution */}
            {productCounts.total > 0 && (
              <>
                <div className="h-10 w-px bg-gray-300" />
                <div className="flex items-center gap-2">
                  {productCounts.withAdmin > 0 && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                      {productCounts.withAdmin} with Admin
                    </span>
                  )}
                  {productCounts.withManufacturer > 0 && (
                    <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                      {productCounts.withManufacturer} with Mfr
                    </span>
                  )}
                  {productCounts.withClient > 0 && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                      {productCounts.withClient} with Client
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
          
          {/* Totals */}
          <div className="flex items-center gap-4">
            {totals.shipping > 0 && (
              <div className="text-right">
                <span className="text-xs text-gray-500">Shipping</span>
                <p className="font-semibold text-blue-600">${totals.shipping.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
            )}
            <div className="text-right">
              <span className="text-xs text-gray-500">Client Total</span>
              <p className="font-bold text-xl text-green-600">${totals.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        {/* Warnings Row */}
        {(productsNeedingPricing > 0 || productsWithoutShipping > 0) && (
          <div className="flex flex-wrap gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
            <div className="flex-1 text-sm text-amber-800">
              {productsNeedingPricing > 0 && (
                <span>{productsNeedingPricing} product{productsNeedingPricing > 1 ? 's' : ''} need pricing. </span>
              )}
              {productsWithoutShipping > 0 && (
                <span>{productsWithoutShipping} product{productsWithoutShipping > 1 ? 's' : ''} need shipping selection.</span>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t">
          {/* Print All */}
          <button
            onClick={onPrintAll}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
          >
            <Printer className="w-4 h-4" />
            Print All
          </button>

          {/* Save All & Route - Only show if there are products with admin */}
          {productCounts.withAdmin > 0 && (
            <button
              onClick={onSaveAndRoute}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 font-medium ml-auto"
            >
              <Save className="w-4 h-4" />
              Save All & Route ({productCounts.withAdmin})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}