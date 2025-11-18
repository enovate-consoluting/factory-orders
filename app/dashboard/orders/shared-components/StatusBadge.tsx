// app/dashboard/orders/[id]/components/shared/StatusBadge.tsx

import React from 'react';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    submitted: 'bg-blue-100 text-blue-700',
    submitted_to_manufacturer: 'bg-purple-100 text-purple-700',
    submitted_for_sample: 'bg-yellow-100 text-yellow-700',
    submitted_to_client: 'bg-indigo-100 text-indigo-700',
    priced_by_manufacturer: 'bg-purple-100 text-purple-700',
    client_approved: 'bg-green-100 text-green-700',
    ready_for_production: 'bg-green-100 text-green-700',
    in_production: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    in_progress: 'bg-blue-100 text-blue-700'
  };

  const displayText = status === 'submitted_to_manufacturer' ? 'Sent to Manufacturer' :
                      status === 'submitted_for_sample' ? 'Sample Requested' :
                      status === 'submitted_to_client' ? 'Sent to Client' :
                      status === 'priced_by_manufacturer' ? 'Priced' :
                      status === 'client_approved' ? 'Client Approved' :
                      status === 'ready_for_production' ? 'Ready for Production' :
                      status === 'in_production' ? 'In Production' :
                      status === 'in_progress' ? 'In Progress' :
                      status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-700'} ${className}`}>
      {displayText}
    </span>
  );
}

export function PaidBadge({ isPaid }: { isPaid: boolean }) {
  if (!isPaid) return null;
  
  return (
    <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
      ✓ Paid
    </span>
  );
}

// Product status badge matching original
export function ProductStatusBadge({ status }: { status: string }) {
  const normalizedStatus = status || 'pending';
  const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700',
    in_production: 'bg-blue-100 text-blue-700',
    sample_requested: 'bg-yellow-100 text-yellow-700',
    pending_client_approval: 'bg-purple-100 text-purple-700',
    revision_requested: 'bg-orange-100 text-orange-700',
    completed: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    approved_for_production: 'bg-green-100 text-green-700'
  };

  const displayText = normalizedStatus === 'pending' ? 'Pending Admin' :
                      normalizedStatus === 'in_production' ? 'In Production' :
                      normalizedStatus === 'sample_requested' ? 'Sample Requested' :
                      normalizedStatus === 'pending_client_approval' ? 'Pending Client Approval' :
                      normalizedStatus === 'revision_requested' ? 'Revision Requested' :
                      normalizedStatus === 'approved_for_production' ? 'Approved for Production' :
                      normalizedStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[normalizedStatus] || statusColors.pending}`}>
      {displayText}
    </span>
  );
}