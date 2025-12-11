/**
 * Production Sub-Tabs Component
 * Sub-navigation for production status filtering on Orders List page
 * Location: app/dashboard/orders/components/ProductionSubTabs.tsx
 * UPDATED: Added Sample In Production tab
 * FIXED: Handle translation fallback when t() returns the key itself (Dec 8 2025)
 * Last Modified: Dec 8 2025
 */

import React from 'react';
import { CheckCircle, Wrench, Award, FlaskConical } from 'lucide-react';
import { ProductionSubTab, TabCounts } from '../types/orderList.types';
import { TFunction } from 'i18next';

interface ProductionSubTabsProps {
  activeSubTab: ProductionSubTab;
  tabCounts: TabCounts;
  t: TFunction;
  onSubTabChange: (tab: ProductionSubTab) => void;
}

// Helper to get label with proper fallback
// If t() returns the key itself (like 'sampleInProduction'), use the fallback
const getLabel = (t: TFunction, key: string, fallback: string): string => {
  const translated = t(key);
  // If translation returns the key itself or is empty, use fallback
  if (!translated || translated === key) {
    return fallback;
  }
  return translated;
};

export const ProductionSubTabs: React.FC<ProductionSubTabsProps> = ({
  activeSubTab,
  tabCounts,
  t,
  onSubTabChange
}) => {
  // UPDATED: Use getLabel helper for proper fallbacks
  const subTabs: { key: ProductionSubTab; label: string; count: number; icon: React.ReactNode; color: string; badgeColor: string }[] = [
    {
      key: 'sample_approved',
      label: getLabel(t, 'sampleApproved', 'Sample Approved'),
      count: tabCounts.sample_approved,
      icon: <Award className="w-4 h-4" />,
      color: 'amber',
      badgeColor: 'green'
    },
    {
      key: 'approved_for_production',
      label: getLabel(t, 'approvedForProd', 'Approved for Production'),
      count: tabCounts.approved_for_production,
      icon: <CheckCircle className="w-4 h-4" />,
      color: 'green',
      badgeColor: 'green'
    },
    {
      key: 'sample_in_production',
      label: getLabel(t, 'sampleInProduction', 'Sample In Production'),
      count: tabCounts.sample_in_production,
      icon: <FlaskConical className="w-4 h-4" />,
      color: 'blue',
      badgeColor: 'blue'
    },
    {
      key: 'in_production',
      label: getLabel(t, 'inProduction', 'In Production'),
      count: tabCounts.in_production,
      icon: <Wrench className="w-4 h-4" />,
      color: 'blue',
      badgeColor: 'blue'
    }
  ];

  const getTabStyles = (tab: typeof subTabs[0], isActive: boolean) => {
    if (isActive) {
      switch (tab.color) {
        case 'amber':
          return 'bg-amber-100 text-amber-700 border-amber-300';
        case 'purple':
          return 'bg-purple-100 text-purple-700 border-purple-300';
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
    // Use badgeColor for the number circle (separate from tab background color)
    switch (tab.badgeColor) {
      case 'green':
        return isActive ? 'bg-green-200 text-green-800' : 'bg-green-100 text-green-700';
      case 'blue':
        return isActive ? 'bg-blue-200 text-blue-800' : 'bg-blue-100 text-blue-700';
      default:
        return isActive ? 'bg-gray-200 text-gray-800' : 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="relative mb-3 sm:mb-4 bg-gray-50 rounded-lg overflow-hidden">
      <div className="flex gap-1.5 sm:gap-2 px-2 py-1.5 sm:p-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory scroll-smooth">
        {subTabs.map((tab) => {
          const isActive = activeSubTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onSubTabChange(tab.key)}
              className={`snap-start flex items-center gap-1 sm:gap-1.5 md:gap-2 px-2 sm:px-2.5 md:px-3 py-1.5 sm:py-2 rounded-lg border transition-colors flex-shrink-0 min-w-fit ${getTabStyles(tab, isActive)}`}
            >
              <span className="flex-shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4">{tab.icon}</span>
              <span className="font-medium text-[11px] sm:text-xs md:text-sm whitespace-nowrap">{tab.label}</span>
              <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold flex-shrink-0 min-w-[18px] text-center ${getBadgeStyles(tab, isActive)}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};