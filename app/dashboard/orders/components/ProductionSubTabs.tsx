/**
 * Production Sub-Tabs Component
 * Sub-navigation for production status filtering on Orders List page
 * Location: app/dashboard/orders/components/ProductionSubTabs.tsx
 * UPDATED: Removed Shipped (now a parent-level tab)
 * Last Modified: Nov 27 2025
 */

import React from 'react';
import { CheckCircle, Wrench, Award } from 'lucide-react';
import { ProductionSubTab, TabCounts } from '../types/orderList.types';
import { TFunction } from 'i18next';

interface ProductionSubTabsProps {
  activeSubTab: ProductionSubTab;
  tabCounts: TabCounts;
  t: TFunction;
  onSubTabChange: (tab: ProductionSubTab) => void;
}

export const ProductionSubTabs: React.FC<ProductionSubTabsProps> = ({
  activeSubTab,
  tabCounts,
  t,
  onSubTabChange
}) => {
  // UPDATED: Removed 'shipped' - now at parent level
  const subTabs: { key: ProductionSubTab; label: string; count: number; icon: React.ReactNode; color: string }[] = [
    {
      key: 'sample_approved',
      label: t('sampleApproved'),
      count: tabCounts.sample_approved,
      icon: <Award className="w-4 h-4" />,
      color: 'amber'
    },
    {
      key: 'approved_for_production',
      label: t('approvedForProd'),
      count: tabCounts.approved_for_production,
      icon: <CheckCircle className="w-4 h-4" />,
      color: 'green'
    },
    {
      key: 'in_production',
      label: t('inProduction'),
      count: tabCounts.in_production,
      icon: <Wrench className="w-4 h-4" />,
      color: 'blue'
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
    <div className="overflow-x-auto mb-4 bg-gray-50 rounded-lg">
      <div className="flex gap-2 p-2 min-w-min">
        {subTabs.map((tab) => {
          const isActive = activeSubTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onSubTabChange(tab.key)}
              className={`flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-2 rounded-lg border transition-colors flex-shrink-0 ${getTabStyles(tab, isActive)}`}
            >
              <span className="flex-shrink-0">{tab.icon}</span>
              <span className="font-medium text-sm whitespace-nowrap">{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${getBadgeStyles(tab, isActive)}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};