/**
 * Order List Tabs Component
 * Main tab navigation for orders listing
 * Location: app/dashboard/orders/components/OrderListTabs.tsx
 * UPDATED: Added Client Requests tab (teal) for Admin/Super Admin
 * Last Modified: Dec 4 2025
 */

import React from 'react';
import { Inbox, FileText, SendHorizontal, Layers, Truck, Clock, UserPlus } from 'lucide-react';
import { TabType, TabCounts } from '../types/orderList.types';
import { TFunction } from 'i18next';

interface OrderListTabsProps {
  activeTab: TabType;
  tabCounts: TabCounts;
  userRole: string | null;
  t: TFunction;
  onTabChange: (tab: TabType) => void;
  onProductionTabClick: () => void;
  readyToShipLabel?: string;
}

export const OrderListTabs: React.FC<OrderListTabsProps> = ({
  activeTab,
  tabCounts,
  userRole,
  t,
  onTabChange,
  onProductionTabClick,
  readyToShipLabel
}) => {
  const isAdminOrSuperAdmin = userRole === 'admin' || userRole === 'super_admin';
  const isClient = userRole === 'client';
  const isManufacturer = userRole === 'manufacturer';

  // Use configured label or fall back to translation default
  const shipQueueLabel = readyToShipLabel || t('readyToShip');

  return (
    <div className="relative border-b border-gray-200 mb-4">
      {/* Scroll hint shadows - improved visibility */}
      <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white via-white/80 to-transparent pointer-events-none z-10 lg:hidden" />
      <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white via-white/80 to-transparent pointer-events-none z-10 lg:hidden" />

      <nav className="-mb-px flex overflow-x-auto scrollbar-hide whitespace-nowrap gap-x-0.5 sm:gap-x-1 snap-x snap-mandatory scroll-smooth px-0.5">
        {/* My Orders Tab */}
        <button
          onClick={() => onTabChange('my_orders')}
          className={`snap-start py-2 sm:py-2.5 md:py-3 px-2 sm:px-2.5 md:px-4 border-b-2 font-medium text-[11px] sm:text-xs md:text-sm flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-shrink-0 transition-colors ${
            activeTab === 'my_orders'
              ? 'border-blue-500 text-blue-600 bg-blue-50/30'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Inbox className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
          <span className="whitespace-nowrap">{t('myOrders')}</span>
          {tabCounts.my_orders > 0 && (
            <span className="bg-blue-100 text-blue-600 px-1 sm:px-1.5 md:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold flex-shrink-0 min-w-[18px] text-center">
              {tabCounts.my_orders}
            </span>
          )}
        </button>

        {/* NEW: Client Requests Tab - Admin/Super Admin only */}
        {isAdminOrSuperAdmin && (
          <button
            onClick={() => onTabChange('client_requests')}
            className={`snap-start py-2 sm:py-2.5 md:py-3 px-2 sm:px-2.5 md:px-4 border-b-2 font-medium text-[11px] sm:text-xs md:text-sm flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-shrink-0 transition-colors ${
              activeTab === 'client_requests'
                ? 'border-teal-500 text-teal-600 bg-teal-50/30'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <UserPlus className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
            <span className="whitespace-nowrap">{t('clientRequests') || 'Client Requests'}</span>
            {tabCounts.client_requests > 0 && (
              <span className="bg-teal-100 text-teal-600 px-1 sm:px-1.5 md:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold flex-shrink-0 min-w-[18px] text-center animate-pulse">
                {tabCounts.client_requests}
              </span>
            )}
          </button>
        )}
        
        {/* Invoice Approval Tab - Admin, Super Admin, Client only */}
        {(isAdminOrSuperAdmin || isClient) && (
          <button
            onClick={() => onTabChange('invoice_approval')}
            className={`snap-start py-2 sm:py-2.5 md:py-3 px-2 sm:px-2.5 md:px-4 border-b-2 font-medium text-[11px] sm:text-xs md:text-sm flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-shrink-0 transition-colors ${
              activeTab === 'invoice_approval'
                ? 'border-amber-500 text-amber-600 bg-amber-50/30'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
            <span className="whitespace-nowrap">{t('invoiceApproval')}</span>
            {tabCounts.invoice_approval > 0 && (
              <span className="bg-amber-100 text-amber-600 px-1 sm:px-1.5 md:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold flex-shrink-0 min-w-[18px] text-center">
                {tabCounts.invoice_approval}
              </span>
            )}
          </button>
        )}
        
        {/* Sent To Other Tab */}
        <button
          onClick={() => onTabChange('sent_to_other')}
          className={`snap-start py-2 sm:py-2.5 md:py-3 px-2 sm:px-2.5 md:px-4 border-b-2 font-medium text-[11px] sm:text-xs md:text-sm flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-shrink-0 transition-colors ${
            activeTab === 'sent_to_other'
              ? 'border-purple-500 text-purple-600 bg-purple-50/30'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <SendHorizontal className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
          <span className="whitespace-nowrap">{isManufacturer ? t('sentToAdmin') : t('sentToManufacturer')}</span>
          {tabCounts.sent_to_other > 0 && (
            <span className="bg-purple-100 text-purple-600 px-1 sm:px-1.5 md:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold flex-shrink-0 min-w-[18px] text-center">
              {tabCounts.sent_to_other}
            </span>
          )}
        </button>
        
        {/* Production Status Tab */}
        <button
          onClick={onProductionTabClick}
          className={`snap-start py-2 sm:py-2.5 md:py-3 px-2 sm:px-2.5 md:px-4 border-b-2 font-medium text-[11px] sm:text-xs md:text-sm flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-shrink-0 transition-colors ${
            activeTab === 'production_status'
              ? 'border-indigo-500 text-indigo-600 bg-indigo-50/30'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
          <span className="whitespace-nowrap">{t('productionStatus')}</span>
          {tabCounts.production_total > 0 && (
            <span className="bg-indigo-100 text-indigo-600 px-1 sm:px-1.5 md:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold flex-shrink-0 min-w-[18px] text-center">
              {tabCounts.production_total}
            </span>
          )}
        </button>

        {/* Ready to Ship Tab - Manufacturer only */}
        {isManufacturer && (
          <button
            onClick={() => onTabChange('ready_to_ship')}
            className={`snap-start py-2 sm:py-2.5 md:py-3 px-2 sm:px-2.5 md:px-4 border-b-2 font-medium text-[11px] sm:text-xs md:text-sm flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-shrink-0 transition-colors ${
              activeTab === 'ready_to_ship'
                ? 'border-orange-500 text-orange-600 bg-orange-50/30'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
            <span className="whitespace-nowrap truncate max-w-[70px] sm:max-w-[100px] md:max-w-[150px]" title={shipQueueLabel}>
              {shipQueueLabel}
            </span>
            {tabCounts.ready_to_ship > 0 && (
              <span className="bg-orange-100 text-orange-600 px-1 sm:px-1.5 md:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold flex-shrink-0 min-w-[18px] text-center">
                {tabCounts.ready_to_ship}
              </span>
            )}
          </button>
        )}

        {/* Shipped Tab */}
        <button
          onClick={() => onTabChange('shipped')}
          className={`snap-start py-2 sm:py-2.5 md:py-3 px-2 sm:px-2.5 md:px-4 border-b-2 font-medium text-[11px] sm:text-xs md:text-sm flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-shrink-0 transition-colors ${
            activeTab === 'shipped'
              ? 'border-green-500 text-green-600 bg-green-50/30'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Truck className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
          <span className="whitespace-nowrap">{t('shipped')}</span>
          {tabCounts.shipped > 0 && (
            <span className="bg-green-100 text-green-600 px-1 sm:px-1.5 md:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold flex-shrink-0 min-w-[18px] text-center">
              {tabCounts.shipped}
            </span>
          )}
        </button>
      </nav>
    </div>
  );
};