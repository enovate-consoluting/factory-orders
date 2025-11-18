/**
 * Variant Table Component
 * Displays product variants with quantity and notes inputs
 * Reusable across create, edit, and detail pages
 * Last Modified: November 2025
 */

import React from 'react';

interface VariantItem {
  variantCombo: string;
  quantity: number;
  notes: string;
}

interface VariantTableProps {
  items: VariantItem[];
  onQuantityChange: (index: number, value: string) => void;
  onNotesChange: (index: number, value: string) => void;
  readOnly?: boolean;
}

export const VariantTable: React.FC<VariantTableProps> = ({
  items,
  onQuantityChange,
  onNotesChange,
  readOnly = false
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-4 text-sm font-medium text-gray-700" style={{width: '26%'}}>
              Variant
            </th>
            <th className="text-left py-2 pl-5 pr-4 text-sm font-medium text-gray-700" style={{width: '10%'}}>
              Quantity
            </th>
            <th className="text-left py-2 px-4 text-sm font-medium text-gray-700" style={{width: '64%'}}>
              Notes
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index} className="border-b border-gray-100">
              <td className="py-2 px-4 text-sm text-gray-900">{item.variantCombo}</td>
              <td className="py-2 pl-5 pr-4">
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => onQuantityChange(index, e.target.value)}
                  min="0"
                  disabled={readOnly}
                  className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-center text-gray-900 disabled:bg-gray-50"
                />
              </td>
              <td className="py-2 px-4">
                <input
                  type="text"
                  value={item.notes}
                  onChange={(e) => onNotesChange(index, e.target.value)}
                  placeholder="Optional notes..."
                  disabled={readOnly}
                  className="w-full px-2 py-1 border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-50"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};