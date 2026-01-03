/**
 * Order List Tabs Component
 * Main tab navigation for orders listing
 * Location: app/dashboard/orders/components/OrderListTabs.tsx
 * UPDATED: Added Client Requests tab (teal) for Admin/Super Admin
 * FIXED: Tab label now shows "Client Requests" with proper spacing
 * Last Modified: Dec 5 2025
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

  // Helper to get client requests label (handles missing translation)
  const getClientRequestsLabel = () => {
    const translated = t('clientRequests');
    // If translation returns the key itself, use proper label
    if (translated === 'clientRequests') {
      return 'Client Requests';
    }
    return translated;
  };

  return (
    <div className="relative border-b border-gray-200 mb-4">
      <nav className="-mb-px flex flex-wrap gap-1 sm:gap-0.5">
        {/* My Orders Tab */}
        <button
          onClick={() => onTabChange('my_orders')}
          className={`py-1.5 sm:py-2 md:py-2.5 px-2 sm:px-3 md:px-4 rounded-lg sm:rounded-none sm:border-b-2 font-medium text-[11px] sm:text-xs md:text-sm flex items-center gap-1 sm:gap-1.5 transition-colors ${
            activeTab === 'my_orders'
              ? 'bg-blue-100 sm:bg-blue-50/30 text-blue-600 sm:border-blue-500'
              : 'bg-gray-100 sm:bg-transparent text-gray-500 hover:text-gray-700 sm:border-transparent sm:hover:border-gray-300'
          }`}
        >
          <Inbox className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
          <span>{t('myOrders')}</span>
          {tabCounts.my_orders > 0 && (
            <span className="bg-blue-200 sm:bg-blue-100 text-blue-700 sm:text-blue-600 px-1 sm:px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold min-w-[18px] text-center">
              {tabCounts.my_orders}
            </span>
          )}
        </button>

        {/* Client Requests Tab - Admin/Super Admin only */}
        {isAdminOrSuperAdmin && (
          <button
            onClick={() => onTabChange('client_requests')}
            className={`py-1.5 sm:py-2 md:py-2.5 px-2 sm:px-3 md:px-4 rounded-lg sm:rounded-none sm:border-b-2 font-medium text-[11px] sm:text-xs md:text-sm flex items-center gap-1 sm:gap-1.5 transition-colors ${
              activeTab === 'client_requests'
                ? 'bg-teal-100 sm:bg-teal-50/30 text-teal-600 sm:border-teal-500'
                : 'bg-gray-100 sm:bg-transparent text-gray-500 hover:text-gray-700 sm:border-transparent sm:hover:border-gray-300'
            }`}
          >
            <UserPlus className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
            <span>{getClientRequestsLabel()}</span>
            {tabCounts.client_requests > 0 && (
              <span className="bg-teal-200 sm:bg-teal-100 text-teal-700 sm:text-teal-600 px-1 sm:px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold min-w-[18px] text-center animate-pulse">
                {tabCounts.client_requests}
              </span>
            )}
          </button>
        )}

        {/* Invoice Approval Tab - Admin, Super Admin, Client only */}
        {(isAdminOrSuperAdmin || isClient) && (
          <button
            onClick={() => onTabChange('invoice_approval')}
            className={`py-1.5 sm:py-2 md:py-2.5 px-2 sm:px-3 md:px-4 rounded-lg sm:rounded-none sm:border-b-2 font-medium text-[11px] sm:text-xs md:text-sm flex items-center gap-1 sm:gap-1.5 transition-colors ${
              activeTab === 'invoice_approval'
                ? 'bg-amber-100 sm:bg-amber-50/30 text-amber-600 sm:border-amber-500'
                : 'bg-gray-100 sm:bg-transparent text-gray-500 hover:text-gray-700 sm:border-transparent sm:hover:border-gray-300'
            }`}
          >
            <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
            <span>{t('invoiceApproval')}</span>
            {tabCounts.invoice_approval > 0 && (
              <span className="bg-amber-200 sm:bg-amber-100 text-amber-700 sm:text-amber-600 px-1 sm:px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold min-w-[18px] text-center">
                {tabCounts.invoice_approval}
              </span>
            )}
          </button>
        )}

        {/* Sent To Other Tab */}
        <button
          onClick={() => onTabChange('sent_to_other')}
          className={`py-1.5 sm:py-2 md:py-2.5 px-2 sm:px-3 md:px-4 rounded-lg sm:rounded-none sm:border-b-2 font-medium text-[11px] sm:text-xs md:text-sm flex items-center gap-1 sm:gap-1.5 transition-colors ${
            activeTab === 'sent_to_other'
              ? 'bg-purple-100 sm:bg-purple-50/30 text-purple-600 sm:border-purple-500'
              : 'bg-gray-100 sm:bg-transparent text-gray-500 hover:text-gray-700 sm:border-transparent sm:hover:border-gray-300'
          }`}
        >
          <SendHorizontal className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
          <span>{isManufacturer ? t('sentToAdmin') : t('sentToManufacturer')}</span>
          {tabCounts.sent_to_other > 0 && (
            <span className="bg-purple-200 sm:bg-purple-100 text-purple-700 sm:text-purple-600 px-1 sm:px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold min-w-[18px] text-center">
              {tabCounts.sent_to_other}
            </span>
          )}
        </button>

        {/* Production Status Tab */}
        <button
          onClick={onProductionTabClick}
          className={`py-1.5 sm:py-2 md:py-2.5 px-2 sm:px-3 md:px-4 rounded-lg sm:rounded-none sm:border-b-2 font-medium text-[11px] sm:text-xs md:text-sm flex items-center gap-1 sm:gap-1.5 transition-colors ${
            activeTab === 'production_status'
              ? 'bg-indigo-100 sm:bg-indigo-50/30 text-indigo-600 sm:border-indigo-500'
              : 'bg-gray-100 sm:bg-transparent text-gray-500 hover:text-gray-700 sm:border-transparent sm:hover:border-gray-300'
          }`}
        >
          <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
          <span>{t('productionStatus')}</span>
          {tabCounts.production_total > 0 && (
            <span className="bg-indigo-200 sm:bg-indigo-100 text-indigo-700 sm:text-indigo-600 px-1 sm:px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold min-w-[18px] text-center">
              {tabCounts.production_total}
            </span>
          )}
        </button>

        {/* Ready to Ship Tab - Manufacturer only */}
        {isManufacturer && (
          <button
            onClick={() => onTabChange('ready_to_ship')}
            className={`py-1.5 sm:py-2 md:py-2.5 px-2 sm:px-3 md:px-4 rounded-lg sm:rounded-none sm:border-b-2 font-medium text-[11px] sm:text-xs md:text-sm flex items-center gap-1 sm:gap-1.5 transition-colors ${
              activeTab === 'ready_to_ship'
                ? 'bg-orange-100 sm:bg-orange-50/30 text-orange-600 sm:border-orange-500'
                : 'bg-gray-100 sm:bg-transparent text-gray-500 hover:text-gray-700 sm:border-transparent sm:hover:border-gray-300'
            }`}
          >
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
            <span className="truncate max-w-[60px] sm:max-w-none" title={shipQueueLabel}>
              {shipQueueLabel}
            </span>
            {tabCounts.ready_to_ship > 0 && (
              <span className="bg-orange-200 sm:bg-orange-100 text-orange-700 sm:text-orange-600 px-1 sm:px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold min-w-[18px] text-center">
                {tabCounts.ready_to_ship}
              </span>
            )}
          </button>
        )}

        {/* Shipped Tab */}
        <button
          onClick={() => onTabChange('shipped')}
          className={`py-1.5 sm:py-2 md:py-2.5 px-2 sm:px-3 md:px-4 rounded-lg sm:rounded-none sm:border-b-2 font-medium text-[11px] sm:text-xs md:text-sm flex items-center gap-1 sm:gap-1.5 transition-colors ${
            activeTab === 'shipped'
              ? 'bg-green-100 sm:bg-green-50/30 text-green-600 sm:border-green-500'
              : 'bg-gray-100 sm:bg-transparent text-gray-500 hover:text-gray-700 sm:border-transparent sm:hover:border-gray-300'
          }`}
        >
          <Truck className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
          <span>{t('shipped')}</span>
          {tabCounts.shipped > 0 && (
            <span className="bg-green-200 sm:bg-green-100 text-green-700 sm:text-green-600 px-1 sm:px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold min-w-[18px] text-center">
              {tabCounts.shipped}
            </span>
          )}
        </button>
      </nav>
    </div>
  );
};