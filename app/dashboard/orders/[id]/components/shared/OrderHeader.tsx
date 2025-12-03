/**
 * OrderHeader Component - /dashboard/orders/[id]/components/shared/OrderHeader.tsx
 * Displays order title, status dropdown, total, and actions
 * FIXED: Added sent_to_manufacturer to dropdown options
 * Roles: Admin, Super Admin, Manufacturer (limited view)
 * Last Modified: November 29, 2025
 */

import React from 'react';
import { Calendar, Edit, CheckCircle, DollarSign, Package } from 'lucide-react';
import { Order } from '../../types/order.types';
import { StatusBadge } from '../../../shared-components/StatusBadge';
import { usePermissions, getUserRole } from '../../hooks/usePermissions';
import { formatOrderNumber } from '@/lib/utils/orderUtils';
import { formatCurrency } from '../../../utils/orderCalculations';
import { useTranslation } from 'react-i18next';
import { useDynamicTranslation } from '@/hooks/useDynamicTranslation';

interface OrderHeaderProps {
  order: Order;
  totalAmount?: number;
  onEditDraft?: () => void;
  onStatusChange?: (status: string) => void;
  onTogglePaid?: (isPaid: boolean) => void;
  allProductsPaid?: boolean;
  language?: 'en' | 'zh';
  setLanguage?: (lang: 'en' | 'zh') => void;
}

export function OrderHeader({
  order,
  totalAmount = 0,
  onEditDraft,
  onStatusChange,
  onTogglePaid,
  allProductsPaid = false,
  language = 'en',
  setLanguage
}: OrderHeaderProps) {
  const { t } = useTranslation();
  const { translate } = useDynamicTranslation();
  const permissions = usePermissions() as any;
  const userRole = getUserRole();
  const isSuperAdmin = userRole === 'super_admin';
  const isManufacturer = userRole === 'manufacturer';
  
  // Get creator name - check multiple places for the name
  const getCreatorName = () => {
    // First try the creator object - using type assertion to avoid TypeScript errors
    if ((order as any).created_by_user) {
      return (order as any).created_by_user.name || (order as any).created_by_user.email || t('adminUser');
    }
    // Then try creator field
    if ((order as any).creator) {
      return (order as any).creator.name || (order as any).creator.email || t('adminUser');
    }
    // Try to get from created_by and users table (might need to fetch separately)
    // For now, if we don't have the creator info, show "Admin"
    return t('admin');
  };

  const creatorName = getCreatorName();

  return (
    <div className="bg-white border-b sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col gap-3 sm:gap-2">
          {/* Top Row - Title and Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            {/* Left side - Title and status */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="min-w-0">
                  {/* SHOW ORDER NAME/DESCRIPTION AS MAIN TITLE */}
                  <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 truncate">
                    {(order as any).order_name ? translate((order as any).order_name) : `${t('order')} ${formatOrderNumber(order.order_number)}`}
                  </h1>
                  {/* Show order number as subtitle if we have a name */}
                  {(order as any).order_name && (
                    <p className="text-sm text-gray-600">
                      {t('order')} #{formatOrderNumber(order.order_number)}
                    </p>
                  )}
                </div>

                {/* Status Dropdown - SUPER ADMIN ONLY */}
                {isSuperAdmin && onStatusChange ? (
                  <select
                    value={order.status}
                    onChange={(e) => onStatusChange(e.target.value)}
                    className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-auto"
                  >
                    <option value="draft">{t('draft')}</option>
                    <option value="sent_to_manufacturer">{t('sentToManufacturer')}</option>
                    <option value="submitted_to_manufacturer">{t('submittedToManufacturer')}</option>
                    <option value="submitted">{t('submitted')}</option>
                    <option value="approved">{t('approved')}</option>
                    <option value="pending">{t('pending')}</option>
                    <option value="submitted_for_sample">{t('submittedForSample')}</option>
                    <option value="priced_by_manufacturer">{t('pricedByManufacturer')}</option>
                    <option value="submitted_to_client">{t('submittedToClient')}</option>
                    <option value="client_approved">{t('clientApproved')}</option>
                    <option value="ready_for_production">{t('readyForProduction')}</option>
                    <option value="in_progress">{t('inProgress')}</option>
                    <option value="in_production">{t('inProduction')}</option>
                    <option value="completed">{t('completed')}</option>
                    <option value="rejected">{t('rejected')}</option>
                  </select>
                ) : (
                  // Regular admins and manufacturers just see the status badge
                  <div className="flex-shrink-0">
                    <StatusBadge status={order.status} />
                  </div>
                )}
              </div>

              {/* Metadata row */}
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {/* Show status badge for super admin too (in addition to dropdown) */}
                {isSuperAdmin && (
                  <StatusBadge status={order.status} />
                )}

                {/* SHOW PAID BADGE HERE IN THE HEADER - BUT NOT FOR MANUFACTURERS */}
                {!isManufacturer && ((order as any).is_paid || allProductsPaid) && (
                  <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1 flex-shrink-0">
                    <CheckCircle className="w-3 h-3" />
                    {t('paid')}
                  </span>
                )}

                {!(order as any).order_name && (
                  <span className="text-xs sm:text-sm text-gray-500">
                    #{formatOrderNumber(order.order_number)}
                  </span>
                )}
                <span className="hidden sm:inline text-gray-400">•</span>
                <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-600 flex-wrap">
                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span>{new Date(order.created_at).toLocaleDateString()}</span>
                  <span className="text-gray-400">{t('created')}</span>
                  <span className="font-medium text-gray-900">{creatorName}</span>
                </div>
              </div>
            </div>

            {/* Right side - Total and actions - HIDE TOTAL FOR MANUFACTURERS */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              {/* Language Switcher - On Order Detail pages */}
              {setLanguage && (
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'en' | 'zh')}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer self-center"
                  style={{ minWidth: 90 }}
                >
                  <option value="en">🇺🇸 EN</option>
                  <option value="zh">🇨🇳 中文</option>
                </select>
              )}

              {/* Order Total - ONLY SHOW FOR NON-MANUFACTURERS */}
              {!isManufacturer && (
                <div className="flex flex-col gap-2">
                  <div className="bg-gray-50 px-3 sm:px-4 py-2 rounded-lg border border-gray-200">
                    <div className="text-right">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">{t('estimatedTotal')}</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900">
                        ${formatCurrency(totalAmount || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Paid checkbox for super admin */}
                  {isSuperAdmin && onTogglePaid && (
                    <label className="flex items-center gap-2 cursor-pointer justify-end">
                      <input
                        type="checkbox"
                        checked={(order as any).is_paid || false}
                        onChange={(e) => onTogglePaid(e.target.checked)}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {(order as any).is_paid ? t('paid') : t('markAsPaid')}
                      </span>
                    </label>
                  )}

                  {/* For non-super admins (but not manufacturers), just show paid status */}
                  {!isSuperAdmin && (order as any).is_paid && (
                    <span className="text-sm text-green-600 font-medium flex items-center gap-1 justify-end">
                      <CheckCircle className="w-3 h-3" />
                      {t('paid')}
                    </span>
                  )}
                </div>
              )}

              {/* Edit Draft button - NOT FOR MANUFACTURERS */}
              {!isManufacturer && order.status === 'draft' && permissions?.canEditOrders && onEditDraft && (
                <button
                  onClick={onEditDraft}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <Edit className="w-4 h-4" />
                  <span>{t('editDraft')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}