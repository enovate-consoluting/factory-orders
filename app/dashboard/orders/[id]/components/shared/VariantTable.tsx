// VariantTable.tsx - Shared variant table component
import React from 'react';
import { OrderItem } from '../../types/order.types';

interface VariantTableProps {
  items: OrderItem[];
  variantNotes: { [key: string]: string };
  onNotesChange: (itemId: string, note: string) => void;
  onEditingChange: (editing: boolean) => void;
  isEditable?: boolean;
}

export function VariantTable({ 
  items, 
  variantNotes, 
  onNotesChange, 
  onEditingChange,
  isEditable = true 
}: VariantTableProps) {
  
  // Determine variant type name from items
  const getVariantTypeName = () => {
    if (items.length > 0 && items[0].variant_combo) {
      const combo = items[0].variant_combo.toLowerCase();
      
      // Check for shoe sizes
      if (/\b\d+(\.\d+)?\b/.test(combo) && (combo.includes('us') || combo.includes('eu') || combo.includes('uk') || /^\d+(\.\d+)?$/.test(combo.trim()))) {
        return 'Shoe Size';
      }
      
      // Check for clothing sizes
      if (combo.includes('small') || combo.includes('medium') || combo.includes('large') || 
          combo.includes('s /') || combo.includes('m /') || combo.includes('l /') ||
          combo.includes('xl') || combo.includes('xxl') || combo.includes('xxxl') ||
          combo === 's' || combo === 'm' || combo === 'l') {
        return 'Size';
      }
      
      // Check for colors
      if (combo.includes('color') || combo.includes('colour') || 
          combo.includes('red') || combo.includes('blue') || combo.includes('green') || 
          combo.includes('black') || combo.includes('white')) {
        return 'Color';
      }
      
      return 'Variant';
    }
    return 'Variant';
  };

  const variantTypeName = getVariantTypeName();

  return (
    <div className="mb-4">
      <h5 className="text-sm font-medium text-gray-700 mb-2">
        {variantTypeName} Details
      </h5>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 text-sm font-medium text-gray-700" style={{width: '25%'}}>
                {variantTypeName}
              </th>
              <th className="text-left py-2 px-1 text-sm font-medium text-gray-700" style={{width: '10%'}}>Qty</th>
              <th className="text-left py-2 pl-2 pr-3 text-sm font-medium text-gray-700" style={{width: '65%'}}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                <td className="py-2 px-3 text-sm text-gray-900">{item.variant_combo}</td>
                <td className="py-2 px-1 text-sm font-medium text-gray-900">{item.quantity || 0}</td>
                <td className="py-2 pl-2 pr-3">
                  {isEditable ? (
                    <input
                      type="text"
                      value={variantNotes[item.id] || ''}
                      onChange={(e) => {
                        onNotesChange(item.id, e.target.value);
                        onEditingChange(true);
                      }}
                      placeholder="Add note..."
                      className="w-full px-2 py-1 text-sm text-gray-900 font-medium border border-gray-300 rounded placeholder-gray-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <span className="text-sm text-gray-700">{item.notes || '-'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}