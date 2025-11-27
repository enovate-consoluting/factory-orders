/**
 * Product Distribution Bar Component
 * Shows product counts, locations, and filtering
 * Used across all roles in order detail view
 * Last Modified: November 2025
 */

import React from 'react';
import { Eye, EyeOff, Package } from 'lucide-react';

interface ProductDistributionBarProps {
  products: any[];
  selectedProductId: string;
  onProductSelect: (productId: string) => void;
  showAllProducts?: boolean;
  onToggleShowAll?: () => void;
  isSuperAdmin?: boolean;
  counts: {
    total: number;
    withAdmin: number;
    withManufacturer: number;
    inProduction: number;
    completed: number;
    visible: number;
  };
}

export function ProductDistributionBar({
  products,
  selectedProductId,
  onProductSelect,
  showAllProducts = false,
  onToggleShowAll,
  isSuperAdmin = false,
  counts
}: ProductDistributionBarProps) {
  if (counts.total === 0) return null;

  return (
    <div className="mb-4 bg-white rounded-lg shadow-lg border border-gray-300 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Product Distribution</h3>
        
        <div className="flex items-center gap-3">
          <select
            value={selectedProductId}
            onChange={(e) => onProductSelect(e.target.value)}
            className="px-3 py-1 text-xs border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Show All Products ({products.length})</option>
            {products.map((product: any) => (
              <option key={product.id} value={product.id}>
                {product.product_order_number || 'PRD-0000'} - {product.description || product.product?.title || 'Unnamed Product'}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 mt-2">
        {counts.withAdmin > 0 && (
          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
            {counts.withAdmin} with Admin
          </span>
        )}
        {counts.withManufacturer > 0 && (
          <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs">
            {counts.withManufacturer} with Manufacturer
          </span>
        )}
        {counts.inProduction > 0 && (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
            {counts.inProduction} in Production
          </span>
        )}
        {counts.completed > 0 && (
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
            {counts.completed} Completed
          </span>
        )}
      </div>
      
      {selectedProductId !== 'all' && (
        <p className="text-xs text-blue-600 mt-2">
          <Eye className="w-3 h-3 inline mr-1" />
          Viewing single product
        </p>
      )}
      
      {isSuperAdmin && showAllProducts && (
        <p className="text-xs text-blue-600 mt-2">
          <Eye className="w-3 h-3 inline mr-1" />
          Showing all {counts.total} products (Super Admin view)
        </p>
      )}
    </div>
  );
}