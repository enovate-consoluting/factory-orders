/**
 * Product Selector Component
 * Grid display for selecting products with quantities
 * Used in step 2 of order creation
 * Last Modified: November 2025
 */

import React from 'react';
import { Trash2 } from 'lucide-react';

interface Product {
  id: string;
  title: string;
  description?: string;
  variants?: {
    type: string;
    options: string[];
  }[];
}

interface ProductSelectorProps {
  products: Product[];
  selectedProducts: { [key: string]: number };
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onProductQuantityChange: (productId: string, quantity: number) => void;
  onProductClick: (productId: string) => void;
  showNotification: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const ProductSelector: React.FC<ProductSelectorProps> = ({
  products,
  selectedProducts,
  searchQuery,
  onSearchChange,
  onProductQuantityChange,
  onProductClick,
  showNotification
}) => {
  const getTotalProductsSelected = () => {
    return Object.values(selectedProducts).reduce((sum, qty) => sum + qty, 0);
  };

  const filteredProducts = products.filter(product =>
    product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Select Products & Quantities</h2>
        {getTotalProductsSelected() > 0 && (
          <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
            Total: {getTotalProductsSelected()} product{getTotalProductsSelected() > 1 ? 's' : ''} selected
          </div>
        )}
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search products by name..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            onClick={() => onProductClick(product.id)}
            className={`border rounded-lg p-4 transition-all cursor-pointer select-none ${
              selectedProducts[product.id] > 0
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                : 'border-gray-300 hover:border-gray-400 hover:shadow-md'
            }`}
          >
            <div className="relative">
              {selectedProducts[product.id] > 0 && (
                <div className="absolute -top-2 -right-2 bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                  {selectedProducts[product.id]}
                </div>
              )}
              
              <div className="mb-3">
                <h3 className="font-semibold text-gray-900">{product.title}</h3>
                {product.description && (
                  <p className="text-sm text-gray-600 mt-1">{product.description}</p>
                )}
                {product.variants && product.variants.length > 0 && (
                  <div className="mt-2">
                    {product.variants.map((variant, idx) => (
                      <div key={idx} className="text-xs text-gray-500">
                        <span className="font-medium">{variant.type}:</span> {variant.options.join(', ')}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-200">
                {selectedProducts[product.id] > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-blue-600 font-medium">
                      Tap to add more
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onProductQuantityChange(product.id, 0);
                        showNotification('info', `${product.title} removed from order`);
                      }}
                      className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium bg-red-50 px-2 py-1 rounded hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-gray-500">
                    Tap to add to order
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};