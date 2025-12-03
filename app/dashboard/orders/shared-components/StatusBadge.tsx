// app/dashboard/orders/[id]/components/shared/StatusBadge.tsx

import React from 'react';
import { useTranslation } from 'react-i18next';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const { t } = useTranslation();
  
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
    in_progress: 'bg-blue-100 text-blue-700',
    sent_to_manufacturer: 'bg-purple-100 text-purple-700'
  };

  const getDisplayText = () => {
    switch(status) {
      case 'submitted_to_manufacturer':
      case 'sent_to_manufacturer':
        return t('sentToManufacturer');
      case 'submitted_for_sample':
        return t('sampleRequested');
      case 'submitted_to_client':
        return t('submittedToClient');
      case 'priced_by_manufacturer':
        return t('pricedByManufacturer');
      case 'client_approved':
        return t('clientApproved');
      case 'ready_for_production':
        return t('readyForProduction');
      case 'in_production':
        return t('inProduction');
      case 'in_progress':
        return t('inProgress');
      case 'draft':
        return t('draft');
      case 'submitted':
        return t('submitted');
      case 'approved':
        return t('approved');
      case 'pending':
        return t('pending');
      case 'completed':
        return t('completed');
      case 'rejected':
        return t('rejected');
      default:
        return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-700'} ${className}`}>
      {getDisplayText()}
    </span>
  );
}

export function PaidBadge({ isPaid }: { isPaid: boolean }) {
  const { t } = useTranslation();
  
  if (!isPaid) return null;
  
  return (
    <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
      ✓ {t('paid')}
    </span>
  );
}

// Product status badge matching original
export function ProductStatusBadge({
  status,
  translate = (text) => text || '',
  t: tProp
}: {
  status: string;
  translate?: (text: string | null | undefined) => string;
  t?: (key: string) => string;
}) {
  const { t: tHook } = useTranslation();
  const t = tProp || tHook;
  const normalizedStatus = status || 'pending';

  const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700',
    in_production: 'bg-blue-100 text-blue-700',
    sample_requested: 'bg-yellow-100 text-yellow-700',
    pending_client_approval: 'bg-purple-100 text-purple-700',
    revision_requested: 'bg-orange-100 text-orange-700',
    completed: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    approved_for_production: 'bg-green-100 text-green-700',
    sent_to_manufacturer: 'bg-purple-100 text-purple-700',
    submitted_to_manufacturer: 'bg-purple-100 text-purple-700'
  };

  const getDisplayText = () => {
    switch(normalizedStatus) {
      case 'pending':
        return t('pendingAdmin');
      case 'in_production':
        return t('inProduction');
      case 'sample_requested':
        return t('sampleRequested');
      case 'pending_client_approval':
        return t('pendingClient');
      case 'revision_requested':
        return t('revisionRequested');
      case 'approved_for_production':
        return t('approvedForProduction');
      case 'completed':
        return t('completed');
      case 'rejected':
        return t('rejected');
      case 'sent_to_manufacturer':
      case 'submitted_to_manufacturer':
        return t('sentToManufacturer');
      default:
        return normalizedStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[normalizedStatus] || statusColors.pending}`}>
      {getDisplayText()}
    </span>
  );
}