/**
 * Production Sub Tabs Component
 * Sub-navigation for production status (Approved, In Production, Shipped)
 * Location: app/dashboard/orders/components/ProductionSubTabs.tsx
 * Last Modified: Nov 26 2025
 */

import React from 'react';
import { Award, Cog, PackageCheck } from 'lucide-react';
import { ProductionSubTab, TabCounts } from '../types/orderList.types';
import { TranslationStrings } from '../utils/orderListTranslations';

interface ProductionSubTabsProps {
  activeSubTab: ProductionSubTab;
  tabCounts: TabCounts;
  translations: TranslationStrings;
  onSubTabChange: (subTab: ProductionSubTab) => void;
}

export const ProductionSubTabs: React.FC<ProductionSubTabsProps> = ({
  activeSubTab,
  tabCounts,
  translations: t,
  onSubTabChange
}) => {
  return (
    <div className="flex justify-center mb-3">
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-2 border border-indigo-200 inline-flex gap-4">
        {/* Approved */}
        <button
          onClick={() => onSubTabChange('approved_for_production')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
            activeSubTab === 'approved_for_production'
              ? 'bg-white shadow-md border-2 border-green-500'
              : 'bg-white/70 hover:bg-white border border-gray-200 hover:shadow'
          }`}
        >
          <div className={`p-1 rounded-full ${
            activeSubTab === 'approved_for_production' ? 'bg-green-100' : 'bg-gray-100'
          }`}>
            <Award className={`w-4 h-4 ${
              activeSubTab === 'approved_for_production' ? 'text-green-600' : 'text-gray-600'
            }`} />
          </div>
          <div className="flex flex-col items-start">
            <span className={`text-xs font-medium ${
              activeSubTab === 'approved_for_production' ? 'text-green-700' : 'text-gray-600'
            }`}>
              {t.approved}
            </span>
            <span className={`text-sm font-bold ${
              activeSubTab === 'approved_for_production' ? 'text-green-600' : 'text-gray-900'
            }`}>
              {tabCounts.approved_for_production}
            </span>
          </div>
        </button>
        
        {/* In Production */}
        <button
          onClick={() => onSubTabChange('in_production')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
            activeSubTab === 'in_production'
              ? 'bg-white shadow-md border-2 border-blue-500'
              : 'bg-white/70 hover:bg-white border border-gray-200 hover:shadow'
          }`}
        >
          <div className={`p-1 rounded-full ${
            activeSubTab === 'in_production' ? 'bg-blue-100' : 'bg-gray-100'
          }`}>
            <Cog className={`w-4 h-4 ${
              activeSubTab === 'in_production' ? 'text-blue-600' : 'text-gray-600'
            }`} />
          </div>
          <div className="flex flex-col items-start">
            <span className={`text-xs font-medium ${
              activeSubTab === 'in_production' ? 'text-blue-700' : 'text-gray-600'
            }`}>
              {t.production}
            </span>
            <span className={`text-sm font-bold ${
              activeSubTab === 'in_production' ? 'text-blue-600' : 'text-gray-900'
            }`}>
              {tabCounts.in_production}
            </span>
          </div>
        </button>
        
        {/* Shipped */}
        <button
          onClick={() => onSubTabChange('shipped')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
            activeSubTab === 'shipped'
              ? 'bg-white shadow-md border-2 border-emerald-500'
              : 'bg-white/70 hover:bg-white border border-gray-200 hover:shadow'
          }`}
        >
          <div className={`p-1 rounded-full ${
            activeSubTab === 'shipped' ? 'bg-emerald-100' : 'bg-gray-100'
          }`}>
            <PackageCheck className={`w-4 h-4 ${
              activeSubTab === 'shipped' ? 'text-emerald-600' : 'text-gray-600'
            }`} />
          </div>
          <div className="flex flex-col items-start">
            <span className={`text-xs font-medium ${
              activeSubTab === 'shipped' ? 'text-emerald-700' : 'text-gray-600'
            }`}>
              {t.shipped}
            </span>
            <span className={`text-sm font-bold ${
              activeSubTab === 'shipped' ? 'text-emerald-600' : 'text-gray-900'
            }`}>
              {tabCounts.shipped}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
};
