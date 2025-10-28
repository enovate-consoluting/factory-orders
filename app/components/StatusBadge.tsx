'use client';

import React from 'react';
import { OrderStatus, ProductStatus, ORDER_STATUS_COLORS, PRODUCT_STATUS_COLORS } from '@/app/types/database';

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export function OrderStatusBadge({ status, className = '' }: OrderStatusBadgeProps) {
  const colorClass = ORDER_STATUS_COLORS[status] || 'bg-gray-500';
  
  const getDisplayName = (status: OrderStatus): string => {
    const displayNames: Record<OrderStatus, string> = {
      pending: 'Pending Admin',  // Added this line
      draft: 'Draft',
      submitted: 'Submitted',
      submitted_to_manufacturer: 'With Manufacturer',
      manufacturer_processed: 'Manufacturer Processed',
      submitted_to_client: 'With Client',
      client_reviewed: 'Client Reviewed',
      approved_by_client: 'Client Approved',
      submitted_for_sample: 'Sample Requested',
      sample_in_production: 'Sample In Production',
      sample_delivered: 'Sample Delivered',
      sample_approved: 'Sample Approved',
      in_production: 'In Production',
      partially_in_production: 'Partially In Production',
      completed: 'Completed',
      rejected: 'Rejected',
      revision_requested: 'Revision Requested',  // Added for consistency
    };
    return displayNames[status] || status;
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${colorClass} ${className}`}>
      {getDisplayName(status)}
    </span>
  );
}

interface ProductStatusBadgeProps {
  status: ProductStatus;
  className?: string;
}

export function ProductStatusBadge({ status, className = '' }: ProductStatusBadgeProps) {
  const colorClass = PRODUCT_STATUS_COLORS[status] || 'bg-gray-500';
  
  const getDisplayName = (status: ProductStatus): string => {
    const displayNames: Record<ProductStatus, string> = {
      pending: 'Pending Admin',  // Updated to match
      manufacturer_review: 'Manufacturer Review',
      sample_required: 'Sample Required',
      sample_requested: 'Sample Requested',  // Added
      sample_pending: 'Sample Pending',
      sample_approved: 'Sample Approved',
      client_review: 'Client Review',
      pending_client_approval: 'Pending Client Approval',  // Added
      client_approved: 'Client Approved',
      approved: 'Approved',
      in_production: 'In Production',
      completed: 'Completed',
      on_hold: 'On Hold',
      revision_requested: 'Revision Requested',  // Added
      rejected: 'Rejected',  // Added
    };
    return displayNames[status] || status;
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${colorClass} ${className}`}>
      {getDisplayName(status)}
    </span>
  );
}

// Queue indicator component for showing where an order currently sits
interface QueueIndicatorProps {
  order: {
    status: OrderStatus;
    products?: Array<{
      product_status: ProductStatus;
      is_locked: boolean;
    }>;
  };
  className?: string;
}

export function QueueIndicator({ order, className = '' }: QueueIndicatorProps) {
  const getQueueLocation = (status: OrderStatus): string => {
    const queueMap: Record<OrderStatus, string> = {
      pending: 'Admin Queue',  // Added
      draft: 'Draft',
      submitted: 'Admin Queue',
      submitted_to_manufacturer: 'Manufacturer Queue',
      manufacturer_processed: 'Admin Queue',
      submitted_to_client: 'Client Queue',
      client_reviewed: 'Admin Queue',
      approved_by_client: 'Admin Queue',
      submitted_for_sample: 'Manufacturer Queue',
      sample_in_production: 'Manufacturer Queue',
      sample_delivered: 'Admin Queue',
      sample_approved: 'Admin Queue',
      in_production: 'Manufacturer Queue',
      partially_in_production: 'Manufacturer Queue',
      completed: 'Completed',
      rejected: 'Rejected',
      revision_requested: 'Admin Queue',  // Added
    };
    return queueMap[status] || 'Unknown';
  };

  const getQueueColor = (queue: string): string => {
    const colorMap: Record<string, string> = {
      'Draft': 'bg-gray-500/20 text-gray-400',
      'Admin Queue': 'bg-blue-500/20 text-blue-400',
      'Manufacturer Queue': 'bg-purple-500/20 text-purple-400',
      'Client Queue': 'bg-pink-500/20 text-pink-400',
      'Completed': 'bg-emerald-500/20 text-emerald-400',
      'Rejected': 'bg-red-500/20 text-red-400',
      'Unknown': 'bg-gray-500/20 text-gray-400',
    };
    return colorMap[queue] || colorMap['Unknown'];
  };

  const queue = getQueueLocation(order.status);
  const colorClass = getQueueColor(queue);

  // Count locked products if any
  const lockedCount = order.products?.filter(p => p.is_locked).length || 0;
  const totalProducts = order.products?.length || 0;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-gray-400">Currently with:</span>
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${colorClass}`}>
        {queue}
      </span>
      {lockedCount > 0 && (
        <span className="text-xs text-amber-500">
          ({lockedCount}/{totalProducts} in production)
        </span>
      )}
    </div>
  );
}

// Product lock indicator
interface LockIndicatorProps {
  isLocked: boolean;
  lockedAt?: string;
  className?: string;
}

export function LockIndicator({ isLocked, lockedAt, className = '' }: LockIndicatorProps) {
  if (!isLocked) return null;

  return (
    <div className={`flex items-center gap-1 text-amber-500 ${className}`}>
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <span className="text-sm">In Production</span>
      {lockedAt && (
        <span className="text-xs text-gray-500">
          (since {new Date(lockedAt).toLocaleDateString()})
        </span>
      )}
    </div>
  );
}

// Shipping method indicator
interface ShippingMethodProps {
  method?: 'air' | 'land';
  className?: string;
}

export function ShippingMethodIndicator({ method, className = '' }: ShippingMethodProps) {
  if (!method) return null;

  const icons = {
    air: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
    land: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0a3 3 0 01-3 3H8l-4 4V4a3 3 0 013-3h10a3 3 0 013 3v4z" />
      </svg>
    ),
  };

  const labels = {
    air: 'Air Shipping',
    land: 'Land Shipping',
  };

  return (
    <div className={`flex items-center gap-1 text-sm ${className}`}>
      {icons[method]}
      <span>{labels[method]}</span>
    </div>
  );
}

// Export all components
export default {
  OrderStatusBadge,
  ProductStatusBadge,
  QueueIndicator,
  LockIndicator,
  ShippingMethodIndicator,
};