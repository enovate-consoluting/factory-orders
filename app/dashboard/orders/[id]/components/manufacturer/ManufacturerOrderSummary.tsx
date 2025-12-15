// ManufacturerOrderSummary.tsx - With collapsible product breakdown
import React, { useState } from 'react';
import { Calculator, Package, DollarSign, Plane, Ship, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency } from '../../../utils/orderCalculations';

interface ManufacturerOrderSummaryProps {
  order: any;
  visibleProducts: any[];
}

export function ManufacturerOrderSummary({ order, visibleProducts }: ManufacturerOrderSummaryProps) {
  // State for collapsing product details when there are 2+ products
  const [isProductsCollapsed, setIsProductsCollapsed] = useState(visibleProducts.length >= 2);
  
  // Calculate totals from all visible products
  const calculateManufacturerTotals = () => {
    let productTotal = 0;
    let sampleTotal = 0;
    let shippingTotal = 0;
    let grandTotal = 0;
    
    const productBreakdown: any[] = [];
    
    visibleProducts.forEach(product => {
      // Get total quantity for this product
      const totalQty = product.order_items?.reduce((sum: number, item: any) => 
        sum + (item.quantity || 0), 0) || 0;
      
      // Product costs
      const unitPrice = parseFloat(product.product_price || 0);
      const productCost = unitPrice * totalQty;
      productTotal += productCost;
      
      // Sample fee
      const sampleFee = parseFloat(product.sample_fee || 0);
      sampleTotal += sampleFee;
      
      // Shipping (only selected method)
      let shippingCost = 0;
      if (product.selected_shipping_method === 'air') {
        shippingCost = parseFloat(product.shipping_air_price || 0);
      } else if (product.selected_shipping_method === 'boat') {
        shippingCost = parseFloat(product.shipping_boat_price || 0);
      }
      shippingTotal += shippingCost;
      
      // Product total
      const productGrandTotal = productCost + sampleFee + shippingCost;
      grandTotal += productGrandTotal;
      
      // Store breakdown for display
      if (productGrandTotal > 0) {
        productBreakdown.push({
          id: product.id,
          name: product.description || product.product?.title || 'Product',
          productNumber: product.product_order_number,
          quantity: totalQty,
          unitPrice,
          productCost,
          sampleFee,
          shippingMethod: product.selected_shipping_method,
          shippingCost,
          total: productGrandTotal
        });
      }
    });
    
    return {
      productTotal,
      sampleTotal,
      shippingTotal,
      grandTotal,
      breakdown: productBreakdown
    };
  };
  
  const totals = calculateManufacturerTotals();
  const hasAnyPricing = totals.grandTotal > 0;
  
  // Don't show if no pricing set yet
  if (!hasAnyPricing) {
    return (
      <div className="mb-4 bg-white rounded-lg shadow-lg border border-gray-300 p-6">
        <div className="flex items-center gap-3 mb-3">
          <Calculator className="w-6 h-6 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">Manufacturing Order Summary</h3>
        </div>
        <div className="text-center py-8 text-gray-500">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p>No pricing set yet. Add product prices to see order totals.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="mb-4 bg-gradient-to-br from-green-50 via-white to-emerald-50 rounded-lg shadow-lg border-2 border-green-300 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-full">
            <Calculator className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Manufacturing Order Summary</h3>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Order #{order.order_number}</p>
          <p className="text-2xl font-bold text-green-600">${formatCurrency(totals.grandTotal)}</p>
        </div>
      </div>
      
      {/* Product Breakdown - COLLAPSIBLE */}
      {totals.breakdown.length > 0 && (
        <div className="mb-4 bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div 
            className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={() => setIsProductsCollapsed(!isProductsCollapsed)}
          >
            <h4 className="text-sm font-semibold text-gray-700">
              Product Details ({totals.breakdown.length} {totals.breakdown.length === 1 ? 'product' : 'products'})
            </h4>
            <button className="p-1 hover:bg-gray-200 rounded transition-colors">
              {isProductsCollapsed ? (
                <ChevronRight className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              )}
            </button>
          </div>
          
          {!isProductsCollapsed && (
            <div className="divide-y divide-gray-100">
              {totals.breakdown.map((product, index) => (
                <div key={product.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{product.name}</span>
                        <span className="text-xs text-gray-500">({product.productNumber})</span>
                      </div>
                      <div className="mt-1 text-xs text-gray-600 space-y-1">
                        {product.productCost > 0 && (
                          <div className="flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            <span>{product.quantity} units × ${formatCurrency(product.unitPrice)} = ${formatCurrency(product.productCost)}</span>
                          </div>
                        )}
                        {product.sampleFee > 0 && (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-amber-500" />
                            <span>Sample: ${formatCurrency(product.sampleFee)}</span>
                          </div>
                        )}
                        {product.shippingCost > 0 && (
                          <div className="flex items-center gap-1">
                            {product.shippingMethod === 'air' ? (
                              <Plane className="w-3 h-3 text-blue-500" />
                            ) : (
                              <Ship className="w-3 h-3 text-cyan-500" />
                            )}
                            <span>
                              {product.shippingMethod === 'air' ? 'Air' : 'Boat'} Shipping: ${formatCurrency(product.shippingCost)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-gray-900">${formatCurrency(product.total)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Totals Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="space-y-2">
          {totals.productTotal > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-gray-700 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-400" />
                Products Total
              </span>
              <span className="font-semibold text-gray-900">${formatCurrency(totals.productTotal)}</span>
            </div>
          )}
          
          {totals.sampleTotal > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-gray-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Sample Fees
              </span>
              <span className="font-semibold text-gray-900">${formatCurrency(totals.sampleTotal)}</span>
            </div>
          )}
          
          {totals.shippingTotal > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-gray-700 flex items-center gap-2">
                <Ship className="w-4 h-4 text-blue-500" />
                Shipping Total
              </span>
              <span className="font-semibold text-gray-900">${formatCurrency(totals.shippingTotal)}</span>
            </div>
          )}
          
          <div className="pt-3 border-t-2 border-green-300">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-green-800">Manufacturing Total</span>
              <span className="text-xl font-bold text-green-600">${formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Info Note */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-700">
            <p className="font-semibold mb-1">Manufacturer View</p>
            <p>This summary shows your manufacturing costs only. Client pricing includes additional margins and is not visible to manufacturers.</p>
          </div>
        </div>
      </div>
    </div>
  );
}