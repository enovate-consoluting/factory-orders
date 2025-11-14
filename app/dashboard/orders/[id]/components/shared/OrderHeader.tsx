// app/dashboard/orders/[id]/components/shared/OrderHeader.tsx

import React from 'react';
import { Calendar, Edit, CheckCircle, DollarSign, Package } from 'lucide-react';
import { Order } from '../../types/order.types';
import { StatusBadge } from './StatusBadge';
import { usePermissions, getUserRole } from '../../hooks/usePermissions';
import { formatOrderNumber } from '@/lib/utils/orderUtils';

interface OrderHeaderProps {
  order: Order;
  totalAmount?: number;
  onEditDraft?: () => void;
  onStatusChange?: (status: string) => void;
  onTogglePaid?: (isPaid: boolean) => void;
  allProductsPaid?: boolean;
}

export function OrderHeader({ 
  order, 
  totalAmount = 0, 
  onEditDraft,
  onStatusChange,
  onTogglePaid,
  allProductsPaid = false 
}: OrderHeaderProps) {
  const permissions = usePermissions() as any;
  const userRole = getUserRole();
  const isSuperAdmin = userRole === 'super_admin';
  const isManufacturer = userRole === 'manufacturer';
  
  // Get creator name - check multiple places for the name
  const getCreatorName = () => {
    // First try the creator object - using type assertion to avoid TypeScript errors
    if ((order as any).created_by_user) {
      return (order as any).created_by_user.name || (order as any).created_by_user.email || 'Admin User';
    }
    // Then try creator field
    if ((order as any).creator) {
      return (order as any).creator.name || (order as any).creator.email || 'Admin User';
    }
    // Try to get from created_by and users table (might need to fetch separately)
    // For now, if we don't have the creator info, show "Admin"
    return 'Admin';
  };

  const creatorName = getCreatorName();

  return (
    <div className="bg-white border-b sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          {/* Left side - Title and status */}
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <div>
                {/* SHOW ORDER NAME/DESCRIPTION AS MAIN TITLE */}
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  {(order as any).order_name || `Order ${formatOrderNumber(order.order_number)}`}
                </h1>
                {/* Show order number as subtitle if we have a name */}
                {(order as any).order_name && (
                  <p className="text-sm text-gray-600">
                    Order #{formatOrderNumber(order.order_number)}
                  </p>
                )}
              </div>
              
              {/* Status Dropdown - SUPER ADMIN ONLY */}
              {isSuperAdmin && onStatusChange ? (
                <select
                  value={order.status}
                  onChange={(e) => onStatusChange(e.target.value)}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                  <option value="pending">Pending</option>
                  <option value="submitted_to_manufacturer">Submitted to Manufacturer</option>
                  <option value="submitted_for_sample">Submitted for Sample</option>
                  <option value="submitted_to_client">Submitted to Client</option>
                  <option value="priced_by_manufacturer">Priced by Manufacturer</option>
                  <option value="client_approved">Client Approved</option>
                  <option value="ready_for_production">Ready for Production</option>
                  <option value="in_production">In Production</option>
                </select>
              ) : (
                // Regular admins and manufacturers just see the status badge
                <StatusBadge status={order.status} />
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {/* Show status badge for super admin too (in addition to dropdown) */}
              {isSuperAdmin && (
                <StatusBadge status={order.status} />
              )}
              
              {/* SHOW PAID BADGE HERE IN THE HEADER - BUT NOT FOR MANUFACTURERS */}
              {!isManufacturer && ((order as any).is_paid || allProductsPaid) && (
                <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Paid
                </span>
              )}
              
              {!(order as any).order_name && (
                <span className="text-xs sm:text-sm text-gray-500">
                  #{formatOrderNumber(order.order_number)}
                </span>
              )}
              <span className="hidden sm:inline text-gray-400">•</span>
              <div className="w-full sm:w-auto flex items-center gap-1 text-xs sm:text-sm text-gray-600">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>{new Date(order.created_at).toLocaleDateString()}</span>
                <span className="text-gray-400">Created by</span>
                <span className="font-medium text-gray-900">{creatorName}</span>
              </div>
            </div>
          </div>
          
          {/* Right side - Total and actions - HIDE TOTAL FOR MANUFACTURERS */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Order Total - ONLY SHOW FOR NON-MANUFACTURERS */}
            {!isManufacturer && (
              <div className="flex flex-col items-end gap-2">
                <div className="bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <div className="text-right">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Estimated Total</p>
                      <p className="text-2xl font-bold text-gray-900">
                        ${(Number(totalAmount) || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Paid checkbox for super admin */}
                {isSuperAdmin && onTogglePaid && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(order as any).is_paid || false}
                      onChange={(e) => onTogglePaid(e.target.checked)}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {(order as any).is_paid ? 'Paid' : 'Mark as Paid'}
                    </span>
                  </label>
                )}
                
                {/* For non-super admins (but not manufacturers), just show paid status */}
                {!isSuperAdmin && (order as any).is_paid && (
                  <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Paid
                  </span>
                )}
              </div>
            )}
            
            {/* Edit Draft button - NOT FOR MANUFACTURERS */}
            {!isManufacturer && order.status === 'draft' && permissions?.canEditOrders && onEditDraft && (
              <button
                onClick={onEditDraft}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Edit Draft</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}