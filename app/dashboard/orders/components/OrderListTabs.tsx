/**
 * Order List Tabs Component
 * Main tab navigation for orders listing (My Orders, Invoice Approval, Sent To, Production)
 * Location: app/dashboard/orders/components/OrderListTabs.tsx
 * Last Modified: Nov 26 2025
 */

import React from 'react';
import { Inbox, FileText, SendHorizontal, Layers } from 'lucide-react';
import { TabType, TabCounts } from '../types/orderList.types';
import { Translations } from '../utils/orderListTranslations';

interface OrderListTabsProps {
  activeTab: TabType;
  tabCounts: TabCounts;
  userRole: string | null;
  translations: Translations;
  onTabChange: (tab: TabType) => void;
  onProductionTabClick: () => void;
}

export const OrderListTabs: React.FC<OrderListTabsProps> = ({
  activeTab,
  tabCounts,
  userRole,
  translations: t,
  onTabChange,
  onProductionTabClick
}) => {
  const isAdminOrSuperAdmin = userRole === 'admin' || userRole === 'super_admin';
  const isClient = userRole === 'client';
  const isManufacturer = userRole === 'manufacturer';

  return (
    <div className="border-b border-gray-200 mb-4">
      <nav className="-mb-px flex flex-wrap gap-y-2">
        {/* My Orders Tab */}
        <button
          onClick={() => onTabChange('my_orders')}
          className={`py-3 px-4 border-b-2 font-medium text-sm flex items-center gap-2 ${
            activeTab === 'my_orders'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>{t.myOrders}</span>
          {tabCounts.my_orders > 0 && (
            <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs font-semibold">
              {tabCounts.my_orders}
            </span>
          )}
        </button>
        
        {/* Invoice Approval Tab - Admin, Super Admin, Client only */}
        {(isAdminOrSuperAdmin || isClient) && (
          <button
            onClick={() => onTabChange('invoice_approval')}
            className={`py-3 px-4 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'invoice_approval'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{t.invoiceApproval}</span>
            {tabCounts.invoice_approval > 0 && (
              <span className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full text-xs font-semibold">
                {tabCounts.invoice_approval}
              </span>
            )}
          </button>
        )}
        
        {/* Sent To Other Tab */}
        <button
          onClick={() => onTabChange('sent_to_other')}
          className={`py-3 px-4 border-b-2 font-medium text-sm flex items-center gap-2 ${
            activeTab === 'sent_to_other'
              ? 'border-purple-500 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <SendHorizontal className="w-4 h-4" />
          <span>{isManufacturer ? t.sentToAdmin : t.sentToManufacturer}</span>
          {tabCounts.sent_to_other > 0 && (
            <span className="bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full text-xs font-semibold">
              {tabCounts.sent_to_other}
            </span>
          )}
        </button>
        
        {/* Production Status Tab */}
        <button
          onClick={onProductionTabClick}
          className={`py-3 px-4 border-b-2 font-medium text-sm flex items-center gap-2 ${
            activeTab === 'production_status'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{t.productionStatus}</span>
          {tabCounts.production_total > 0 && (
            <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full text-xs font-semibold">
              {tabCounts.production_total}
            </span>
          )}
        </button>
      </nav>
    </div>
  );
};
