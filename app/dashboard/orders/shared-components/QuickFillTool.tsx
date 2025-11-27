/**
 * Quick Fill Tool Component
 * Allows distributing quantity evenly across all product variants
 * Used in order creation and editing
 * Last Modified: November 2025
 */

import React, { useState } from 'react';

interface QuickFillToolProps {
  onDistribute: (quantity: number) => void;
}

export const QuickFillTool: React.FC<QuickFillToolProps> = ({ onDistribute }) => {
  const [quantity, setQuantity] = useState('');

  const handleDistribute = () => {
    const totalQty = parseInt(quantity);
    if (!isNaN(totalQty) && totalQty > 0) {
      onDistribute(totalQty);
      setQuantity('');
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex lg:items-center  flex-col lg:flex-row lg:justify-between gap-4">
        <div>
          <h3 className="font-medium text-blue-900">Quick Fill Quantities</h3>
          <p className="text-sm text-blue-700">Distribute quantity evenly across all variants</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={quantity}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || parseInt(value) >= 0) {
                setQuantity(value);
              }
            }}
            placeholder="Total quantity"
            className="w-40 px-3 py-2 border border-blue-300 rounded-lg text-gray-900 placeholder-gray-500"
            min="0"
          />
          <button
            onClick={handleDistribute}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Distribute
          </button>
        </div>
      </div>
    </div>
  );
};