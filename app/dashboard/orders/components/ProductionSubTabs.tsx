/**
 * Production Sub-Tabs Component
 * Sub-navigation for production status filtering on Orders List page
 * Location: app/dashboard/orders/components/ProductionSubTabs.tsx
 * Last Modified: Nov 26 2025
 */

import React from 'react';
import { CheckCircle, Wrench, Truck, Award } from 'lucide-react';
import { ProductionSubTab, TabCounts } from '../types/orderList.types';
import { Translations } from '../utils/orderListTranslations';

interface ProductionSubTabsProps {
  activeSubTab: ProductionSubTab;
  tabCounts: TabCounts;
  translations: Translations;
  onSubTabChange: (tab: ProductionSubTab) => void;
}

export const ProductionSubTabs: React.FC<ProductionSubTabsProps> = ({
  activeSubTab,
  tabCounts,
  translations: t,
  onSubTabChange
}) => {
  const subTabs: { key: ProductionSubTab; label: string; count: number; icon: React.ReactNode; color: string }[] = [
    {
      key: 'sample_approved',
      label: t.sampleApproved,
      count: tabCounts.sample_approved,
      icon: <Award className="w-4 h-4" />,
      color: 'amber'
    },
    {
      key: 'approved_for_production',
      label: t.approvedForProd,
      count: tabCounts.approved_for_production,
      icon: <CheckCircle className="w-4 h-4" />,
      color: 'green'
    },
    {
      key: 'in_production',
      label: t.inProduction,
      count: tabCounts.in_production,
      icon: <Wrench className="w-4 h-4" />,
      color: 'blue'
    },
    {
      key: 'shipped',
      label: t.shipped,
      count: tabCounts.shipped,
      icon: <Truck className="w-4 h-4" />,
      color: 'green'
    }
  ];

  const getTabStyles = (tab: typeof subTabs[0], isActive: boolean) => {
    if (isActive) {
      switch (tab.color) {
        case 'amber':
          return 'bg-amber-100 text-amber-700 border-amber-300';
        case 'green':
          return 'bg-green-100 text-green-700 border-green-300';
        case 'blue':
          return 'bg-blue-100 text-blue-700 border-blue-300';
        default:
          return 'bg-gray-100 text-gray-700 border-gray-300';
      }
    }
    return 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50';
  };

  const getBadgeStyles = (tab: typeof subTabs[0], isActive: boolean) => {
    if (isActive) {
      switch (tab.color) {
        case 'amber':
          return 'bg-amber-200 text-amber-800';
        case 'green':
          return 'bg-green-200 text-green-800';
        case 'blue':
          return 'bg-blue-200 text-blue-800';
        default:
          return 'bg-gray-200 text-gray-800';
      }
    }
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="flex flex-wrap gap-2 mb-4 p-2 bg-gray-50 rounded-lg">
      {subTabs.map((tab) => {
        const isActive = activeSubTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onSubTabChange(tab.key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${getTabStyles(tab, isActive)}`}
          >
            {tab.icon}
            <span className="font-medium text-sm">{tab.label}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getBadgeStyles(tab, isActive)}`}>
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
};