/**
 * Order List Tabs Component
 * Main tab navigation for orders listing (My Orders, Invoice Approval, Sent To, Production, Ready to Ship, Shipped)
 * Location: app/dashboard/orders/components/OrderListTabs.tsx
 * UPDATED: Added Ready to Ship tab (amber) between Production and Shipped
 * Last Modified: Nov 28 2025
 */

import React from 'react';
import { Inbox, FileText, SendHorizontal, Layers, Truck, Clock } from 'lucide-react';
import { TabType, TabCounts } from '../types/orderList.types';
import { Translations } from '../utils/orderListTranslations';

interface OrderListTabsProps {
  activeTab: TabType;
  tabCounts: TabCounts;
  userRole: string | null;
  translations: Translations;
  onTabChange: (tab: TabType) => void;
  onProductionTabClick: () => void;
  readyToShipLabel?: string;  // NEW: Configurable label from system_config
}

export const OrderListTabs: React.FC<OrderListTabsProps> = ({
  activeTab,
  tabCounts,
  userRole,
  translations: t,
  onTabChange,
  onProductionTabClick,
  readyToShipLabel
}) => {
  const isAdminOrSuperAdmin = userRole === 'admin' || userRole === 'super_admin';
  const isClient = userRole === 'client';
  const isManufacturer = userRole === 'manufacturer';

  // Use configured label or fall back to translation default
  const shipQueueLabel = readyToShipLabel || t.readyToShip;

  return (
    <div className="border-b border-gray-200 mb-4 overflow-x-auto">
      <nav className="-mb-px flex overflow-x-auto scrollbar-hide whitespace-nowrap gap-x-1">
        {/* My Orders Tab */}
        <button
          onClick={() => onTabChange('my_orders')}
          className={`py-3 px-3 md:px-4 border-b-2 font-medium text-sm flex items-center gap-1.5 md:gap-2 flex-shrink-0 ${
            activeTab === 'my_orders'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Inbox className="w-4 h-4 flex-shrink-0" />
          <span className="whitespace-nowrap">{t.myOrders}</span>
          {tabCounts.my_orders > 0 && (
            <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0">
              {tabCounts.my_orders}
            </span>
          )}
        </button>
        
        {/* Invoice Approval Tab - Admin, Super Admin, Client only */}
        {(isAdminOrSuperAdmin || isClient) && (
          <button
            onClick={() => onTabChange('invoice_approval')}
            className={`py-3 px-3 md:px-4 border-b-2 font-medium text-sm flex items-center gap-1.5 md:gap-2 flex-shrink-0 ${
              activeTab === 'invoice_approval'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="w-4 h-4 flex-shrink-0" />
            <span className="whitespace-nowrap">{t.invoiceApproval}</span>
            {tabCounts.invoice_approval > 0 && (
              <span className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0">
                {tabCounts.invoice_approval}
              </span>
            )}
          </button>
        )}
        
        {/* Sent To Other Tab */}
        <button
          onClick={() => onTabChange('sent_to_other')}
          className={`py-3 px-3 md:px-4 border-b-2 font-medium text-sm flex items-center gap-1.5 md:gap-2 flex-shrink-0 ${
            activeTab === 'sent_to_other'
              ? 'border-purple-500 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <SendHorizontal className="w-4 h-4 flex-shrink-0" />
          <span className="whitespace-nowrap">{isManufacturer ? t.sentToAdmin : t.sentToManufacturer}</span>
          {tabCounts.sent_to_other > 0 && (
            <span className="bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0">
              {tabCounts.sent_to_other}
            </span>
          )}
        </button>
        
        {/* Production Status Tab */}
        <button
          onClick={onProductionTabClick}
          className={`py-3 px-3 md:px-4 border-b-2 font-medium text-sm flex items-center gap-1.5 md:gap-2 flex-shrink-0 ${
            activeTab === 'production_status'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Layers className="w-4 h-4 flex-shrink-0" />
          <span className="whitespace-nowrap">{t.productionStatus}</span>
          {tabCounts.production_total > 0 && (
            <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0">
              {tabCounts.production_total}
            </span>
          )}
        </button>

        {/* NEW: Ready to Ship Tab - Amber, between Production and Shipped */}
        {isManufacturer && (
          <button
            onClick={() => onTabChange('ready_to_ship')}
            className={`py-3 px-3 md:px-4 border-b-2 font-medium text-sm flex items-center gap-1.5 md:gap-2 flex-shrink-0 ${
              activeTab === 'ready_to_ship'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span className="whitespace-nowrap truncate max-w-[120px] md:max-w-[150px]" title={shipQueueLabel}>
              {shipQueueLabel}
            </span>
            {tabCounts.ready_to_ship > 0 && (
              <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0">
                {tabCounts.ready_to_ship}
              </span>
            )}
          </button>
        )}

        {/* Shipped Tab - Parent Level */}
        <button
          onClick={() => onTabChange('shipped')}
          className={`py-3 px-3 md:px-4 border-b-2 font-medium text-sm flex items-center gap-1.5 md:gap-2 flex-shrink-0 ${
            activeTab === 'shipped'
              ? 'border-green-500 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Truck className="w-4 h-4 flex-shrink-0" />
          <span className="whitespace-nowrap">{t.shipped}</span>
          {tabCounts.shipped > 0 && (
            <span className="bg-green-100 text-green-600 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0">
              {tabCounts.shipped}
            </span>
          )}
        </button>
      </nav>
    </div>
  );
};