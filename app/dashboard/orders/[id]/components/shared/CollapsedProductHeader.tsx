/**
 * Collapsed Product Header Component
 * Shared collapsed view for both Admin and Manufacturer product cards
 * Shows product summary with expand button
 * Last Modified: Nov 21 2025
 */

import React from 'react';
import { ChevronRight, History, Lock, Unlock, Loader2, CheckCircle, DollarSign, AlertTriangle } from 'lucide-react';
import { ProductStatusBadge } from '../../../shared-components/StatusBadge';
import { getProductStatusIcon } from './ProductStatusIcon';

interface CollapsedProductHeaderProps {
  product: any;
  totalQuantity: number;
  totalPrice?: number;
  isManufacturerView?: boolean;
  onExpand: () => void;
  onViewHistory?: () => void;
  onRoute?: () => void;
  onToggleLock?: () => void;
  isLocked?: boolean;
  processingLock?: boolean;
  hasNewHistory?: boolean;
  userRole?: string;
  trackingNumber?: string;
}

export function CollapsedProductHeader({
  product,
  totalQuantity,
  totalPrice,
  isManufacturerView = false,
  onExpand,
  onViewHistory,
  onRoute,
  onToggleLock,
  isLocked = false,
  processingLock = false,
  hasNewHistory = false,
  userRole,
  trackingNumber
}: CollapsedProductHeaderProps) {
  const displayStatus = product.product_status || 'pending';
  const productionTime = product.production_time;
  
  // Determine shipping status for admins
  const hasShippingPrices = !isManufacturerView && 
    (product.client_shipping_air_price > 0 || product.client_shipping_boat_price > 0);
  const hasSelectedShipping = product.selected_shipping_method === 'air' || product.selected_shipping_method === 'boat';
  const needsShippingSelection = hasShippingPrices && !hasSelectedShipping;
  
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-300 overflow-hidden hover:shadow-xl transition-shadow">
      <div className="p-4 bg-gray-50 border-b-2 border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={onExpand}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
              title="Expand details"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
            
            {getProductStatusIcon(displayStatus)}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg text-gray-900">
                  {product.description || product.product?.title || 'Product'}
                </h3>
                <ProductStatusBadge status={displayStatus} />
                
                {/* Payment status for admin view */}
                {!isManufacturerView && product.payment_status === 'paid' && (
                  <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Paid
                  </span>
                )}
                
                {/* Shipping selection needed warning */}
                {needsShippingSelection && (
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Select Shipping
                  </span>
                )}
                
                {/* Locked status for manufacturer */}
                {isManufacturerView && isLocked && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                    🔒 Locked
                  </span>
                )}
                
                {/* Shipped status */}
                {product.product_status === 'shipped' && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                    📦 Shipped
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                <span>{product.product_order_number}</span>
                <span>•</span>
                <span>Qty: {totalQuantity}</span>
                
                {/* Production time for manufacturer */}
                {isManufacturerView && productionTime && (
                  <>
                    <span>•</span>
                    <span>Production: {productionTime}</span>
                  </>
                )}
                
                {/* Total price with shipping indicator */}
                {totalPrice && totalPrice > 0 && (
                  <>
                    <span>•</span>
                    <span className="font-semibold">
                      {isManufacturerView ? (
                        <span className="text-green-600">Total: ${totalPrice.toFixed(2)}</span>
                      ) : (
                        <>
                          <span className="text-green-600">Total: ${totalPrice.toFixed(2)}</span>
                          {!hasSelectedShipping && (
                            <span className="text-red-600 ml-1">(w/o shipping)</span>
                          )}
                          {hasSelectedShipping && (
                            <span className="text-green-600 ml-1">(w/ shipping)</span>
                          )}
                        </>
                      )}
                    </span>
                  </>
                )}
                
                {/* Tracking number */}
                {trackingNumber && (
                  <>
                    <span>•</span>
                    <span className="text-purple-600 font-medium">
                      Tracking: {trackingNumber}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* History button */}
            {onViewHistory && (
              <button
                onClick={onViewHistory}
                className="px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium flex items-center gap-2 relative"
              >
                <History className="w-4 h-4" />
                {hasNewHistory && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                )}
              </button>
            )}
            
            {/* Route button */}
            {onRoute && (
              <button
                onClick={onRoute}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Route
              </button>
            )}
            
            {/* Lock button */}
            {onToggleLock && (
              <button
                onClick={onToggleLock}
                disabled={processingLock}
                className={`p-2 rounded-lg transition-colors ${
                  isLocked 
                    ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                    : 'bg-green-50 text-green-600 hover:bg-green-100'
                } disabled:opacity-50`}
                title={isLocked ? 'Unlock for editing' : 'Lock for production'}
              >
                {processingLock ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isLocked ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
