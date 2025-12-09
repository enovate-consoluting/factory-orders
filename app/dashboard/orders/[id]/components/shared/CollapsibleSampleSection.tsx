/**
 * CollapsibleSampleSection Component
 * Wraps OrderSampleRequest in a collapsible container matching product card style
 * Location: /app/dashboard/orders/[id]/components/shared/CollapsibleSampleSection.tsx
 * 
 * Features:
 * - Section header like "Order Products (2)"
 * - Collapsed view shows: Fee, ETA, Status, Routing badges
 * - Expands to show full OrderSampleRequest form
 * - Matches product card visual style
 * 
 * UPDATED Dec 9, 2024:
 * - Changed direct route buttons to single "Route" button
 * - Route button opens SampleRouteModal with 3 options
 * - Route button stays visible when expanded (like product cards)
 * - Consistent with product card behavior
 * 
 * Last Modified: December 9, 2024
 */

import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  DollarSign,
  Calendar,
  Clock,
  Users,
  Building,
  Send,
  FileText,
  History,
  FlaskConical
} from 'lucide-react';
import { SampleRouteModal } from '../modals/SampleRouteModal';

interface CollapsibleSampleSectionProps {
  orderId: string;
  sampleFee: string;
  sampleETA: string;
  sampleStatus: string;
  sampleNotes: string;
  sampleFiles: File[];
  existingMedia: any[];
  existingSampleNotes: string;
  sampleRoutedTo: string;
  sampleWorkflowStatus: string;
  isManufacturer: boolean;
  isClient: boolean;
  userRole: string;
  hasNewHistory?: boolean;
  isRouting?: boolean;
  saving?: boolean;
  onUpdate: (field: string, value: any) => void;
  onFileUpload: (files: FileList | null) => void;
  onFileRemove: (index: number) => void;
  onExistingFileDelete: (mediaId: string) => void;
  onViewHistory: () => void;
  onSave: (data: any) => void;
  onRouteToManufacturer: (notes?: string) => Promise<boolean>;
  onRouteToAdmin: (notes?: string) => Promise<boolean>;
  onRouteToClient: (notes?: string) => Promise<boolean>;
  onSampleApproved?: (notes?: string) => Promise<boolean>;
  canRouteToManufacturer: boolean;
  canRouteToAdmin: boolean;
  canRouteToClient: boolean;
  // Pass through the actual sample request component
  children: React.ReactNode;
  t?: (key: string) => string;
  defaultExpanded?: boolean;
}

export const CollapsibleSampleSection: React.FC<CollapsibleSampleSectionProps> = ({
  orderId,
  sampleFee,
  sampleETA,
  sampleStatus,
  sampleNotes,
  sampleRoutedTo,
  sampleWorkflowStatus,
  isManufacturer,
  isClient,
  userRole,
  hasNewHistory = false,
  existingMedia,
  children,
  onViewHistory,
  onRouteToManufacturer,
  onRouteToAdmin,
  onRouteToClient,
  onSampleApproved,
  canRouteToManufacturer,
  canRouteToAdmin,
  canRouteToClient,
  isRouting,
  t = (key) => key,
  defaultExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showRouteModal, setShowRouteModal] = useState(false);

  // Determine if user can route at all (show Route button)
  const isAdminOrSuper = userRole === 'admin' || userRole === 'super_admin';
  
  // Admin can always see Route button when sample is with them
  // Manufacturer can see Route button when sample is with them
  // Client can see Route button when sample is with them
  const canShowRouteButton = 
    (isAdminOrSuper && sampleRoutedTo === 'admin') ||
    (isManufacturer && sampleRoutedTo === 'manufacturer') ||
    (isClient && sampleRoutedTo === 'client');

  // Admin can approve sample when it's with them
  const canApproveSample = isAdminOrSuper && sampleRoutedTo === 'admin';

  // Handle sample approved - update status to approved
  const handleSampleApproved = async (notes?: string): Promise<boolean> => {
    if (onSampleApproved) {
      return onSampleApproved(notes);
    }
    // Fallback: If no onSampleApproved provided, we need to handle it
    // This will be implemented in the parent component
    console.warn('onSampleApproved not provided');
    return false;
  };

  // Determine routing badge
  const getRoutingBadge = () => {
    if (sampleRoutedTo === 'admin') {
      return {
        label: 'With Admin',
        icon: Users,
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200'
      };
    } else if (sampleRoutedTo === 'manufacturer') {
      return {
        label: 'With Manufacturer',
        icon: Building,
        bgColor: 'bg-amber-100',
        textColor: 'text-amber-700',
        borderColor: 'border-amber-200'
      };
    } else if (sampleRoutedTo === 'client') {
      return {
        label: 'With Client',
        icon: Users,
        bgColor: 'bg-purple-100',
        textColor: 'text-purple-700',
        borderColor: 'border-purple-200'
      };
    }
    return {
      label: 'Pending',
      icon: Clock,
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-700',
      borderColor: 'border-gray-200'
    };
  };

  const routingBadge = getRoutingBadge();

  // Get status badge styling
  const getStatusBadge = () => {
    switch (sampleStatus) {
      case 'approved':
      case 'sample_approved':
        return {
          label: 'Approved',
          bgColor: 'bg-emerald-100',
          textColor: 'text-emerald-700',
          borderColor: 'border-emerald-200'
        };
      case 'in_production':
      case 'sample_in_production':
        return {
          label: 'In Production',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-700',
          borderColor: 'border-blue-200'
        };
      case 'pending':
        return {
          label: 'Pending',
          bgColor: 'bg-slate-100',
          textColor: 'text-slate-700',
          borderColor: 'border-slate-200'
        };
      case 'rejected':
        return {
          label: 'Rejected',
          bgColor: 'bg-red-100',
          textColor: 'text-red-700',
          borderColor: 'border-red-200'
        };
      case 'shipped':
        return {
          label: 'Shipped',
          bgColor: 'bg-cyan-100',
          textColor: 'text-cyan-700',
          borderColor: 'border-cyan-200'
        };
      case 'no_sample':
        return {
          label: 'No Sample',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-500',
          borderColor: 'border-gray-200'
        };
      default:
        return {
          label: formatStatus(sampleStatus),
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-700',
          borderColor: 'border-gray-200'
        };
    }
  };

  const statusBadge = getStatusBadge();

  const formatStatus = (status: string) => {
    return status
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="mb-4">
      {/* Section Header - Like "Order Products (2)" */}
      <h2 className="text-sm sm:text-lg font-semibold text-gray-900 flex items-center gap-2 mb-2">
        <FlaskConical className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
        Sample
      </h2>

      {/* Collapsible Card */}
      <div 
        className={`bg-white rounded-lg shadow-lg border overflow-hidden transition-all ${
          isExpanded ? 'border-amber-300' : 'border-gray-300'
        }`}
      >
        {/* Header - Always Visible (Clickable) */}
        <div 
          className="flex items-center justify-between p-3 sm:p-4 cursor-pointer bg-gray-50 border-b-2 border-gray-200 hover:bg-gray-100 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {/* Left: Expand Arrow + Icon */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Expand/Collapse Arrow */}
            <button
              className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <ChevronDown className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-600" />
              )}
            </button>

            {/* Icon - Flask/Beaker for Sample */}
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FlaskConical className="w-5 h-5 text-amber-600" />
            </div>
            
            <div className="min-w-0 flex-1">
              {/* Title Row with Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                  Tech Pack / Sample
                </h3>
                
                {/* Status Badge */}
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${statusBadge.bgColor} ${statusBadge.textColor} ${statusBadge.borderColor}`}>
                  {statusBadge.label}
                </span>
                
                {/* Routing Badge */}
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1 border ${routingBadge.bgColor} ${routingBadge.textColor} ${routingBadge.borderColor}`}>
                  <routingBadge.icon className="w-3 h-3" />
                  {routingBadge.label}
                </span>
              </div>
              
              {/* Quick Stats Row */}
              <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-600 flex-wrap">
                {sampleFee && parseFloat(sampleFee) > 0 && (
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <span className="font-medium text-gray-700">${parseFloat(sampleFee).toLocaleString()}</span>
                  </span>
                )}
                {sampleETA && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <span className="font-medium text-gray-700">
                      {new Date(sampleETA + 'T00:00:00').toLocaleDateString('en-US', { 
                        month: '2-digit', 
                        day: '2-digit', 
                        year: 'numeric' 
                      })}
                    </span>
                  </span>
                )}
                {existingMedia.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-purple-500" />
                    <span className="font-medium text-gray-700">{existingMedia.length} file{existingMedia.length !== 1 ? 's' : ''}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Action Buttons - ALWAYS VISIBLE (collapsed and expanded) */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {/* History Button - Solid gray like product cards */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewHistory();
              }}
              className="px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium flex items-center gap-2 relative"
              title="View History"
            >
              <History className="w-4 h-4" />
              {hasNewHistory && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              )}
            </button>

            {/* Route Button - Opens Modal - VISIBLE COLLAPSED AND EXPANDED */}
            {canShowRouteButton && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRouteModal(true);
                }}
                disabled={isRouting}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Route
              </button>
            )}
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t border-gray-200 bg-gray-50">
            {children}
          </div>
        )}
      </div>

      {/* Route Modal */}
      <SampleRouteModal
        isOpen={showRouteModal}
        onClose={() => setShowRouteModal(false)}
        onRouteToManufacturer={onRouteToManufacturer}
        onRouteToClient={onRouteToClient}
        onSampleApproved={handleSampleApproved}
        canRouteToManufacturer={canRouteToManufacturer}
        canRouteToClient={canRouteToClient}
        canApproveSample={canApproveSample}
        currentRoutedTo={sampleRoutedTo}
        isRouting={isRouting}
      />
    </div>
  );
};