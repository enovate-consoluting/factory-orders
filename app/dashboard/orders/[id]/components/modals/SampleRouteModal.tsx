/**
 * Sample Route Modal Component - Sample Request Routing
 * Used by admins to route sample requests
 * Matches ProductRouteModal styling for consistency
 * 
 * Options for Admin:
 * - Sample Approved (green) - like "Approve for Production"
 * - Send to Client (purple) - like "Send for Approval"
 * - To Manufacturer (orange) - like "Back to Manufacturer"
 * 
 * Location: /app/dashboard/orders/[id]/components/modals/SampleRouteModal.tsx
 * Last Modified: December 9, 2024
 */

import React, { useState, useEffect } from 'react';
import { X, Send, CheckCircle, RotateCcw, Loader2, User } from 'lucide-react';

interface SampleRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRouteToManufacturer: (notes?: string) => Promise<boolean>;
  onRouteToClient: (notes?: string) => Promise<boolean>;
  onSampleApproved: (notes?: string) => Promise<boolean>;
  canRouteToManufacturer: boolean;
  canRouteToClient: boolean;
  canApproveSample: boolean;
  currentRoutedTo: string;
  isRouting?: boolean;
}

export function SampleRouteModal({
  isOpen,
  onClose,
  onRouteToManufacturer,
  onRouteToClient,
  onSampleApproved,
  canRouteToManufacturer,
  canRouteToClient,
  canApproveSample,
  currentRoutedTo,
  isRouting = false
}: SampleRouteModalProps) {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRoute = async () => {
    if (!selectedRoute) return;

    setSending(true);
    try {
      let success = false;
      
      switch (selectedRoute) {
        case 'send_to_manufacturer':
          success = await onRouteToManufacturer(notes);
          break;
        case 'send_to_client':
          success = await onRouteToClient(notes);
          break;
        case 'sample_approved':
          success = await onSampleApproved(notes);
          break;
      }

      if (success) {
        handleClose();
      }
    } catch (error) {
      console.error('Error routing sample:', error);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSelectedRoute(null);
    setNotes('');
    onClose();
  };

  // Check if any routing options are available
  const hasAnyOption = canRouteToManufacturer || canRouteToClient || canApproveSample;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header - Matches Product RouteModal */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              Route Sample Request
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Currently with: <span className="capitalize">{currentRoutedTo}</span>
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!hasAnyOption ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No routing options available from current state.</p>
            <p className="text-sm text-gray-400 mt-2">
              The sample is currently with {currentRoutedTo} and cannot be routed by your role.
            </p>
          </div>
        ) : (
          <>
            {/* Routing Options - 3 Cards matching Product RouteModal layout */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
              
              {/* Sample Approved - Green (like Approve for Production) */}
              <button
                onClick={() => canApproveSample && setSelectedRoute('sample_approved')}
                disabled={!canApproveSample}
                className={`p-3 sm:p-4 border-2 rounded-lg transition-all text-left group ${
                  !canApproveSample
                    ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                    : selectedRoute === 'sample_approved'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-green-500 hover:bg-green-50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-colors ${
                    !canApproveSample
                      ? 'bg-gray-100'
                      : selectedRoute === 'sample_approved'
                      ? 'bg-green-200'
                      : 'bg-green-100 group-hover:bg-green-200'
                  }`}>
                    <CheckCircle className={`w-4 h-4 sm:w-5 sm:h-5 ${!canApproveSample ? 'text-gray-400' : 'text-green-600'}`} />
                  </div>
                  <h3 className={`font-semibold ${!canApproveSample ? 'text-gray-400' : 'text-gray-900'}`}>
                    Sample Approved
                  </h3>
                </div>
                <p className={`text-xs sm:text-sm ${!canApproveSample ? 'text-gray-400' : 'text-gray-500'}`}>
                  Mark sample as approved
                </p>
              </button>

              {/* Send to Client - Purple (like Send for Approval) */}
              <button
                onClick={() => canRouteToClient && setSelectedRoute('send_to_client')}
                disabled={!canRouteToClient}
                className={`p-3 sm:p-4 border-2 rounded-lg transition-all text-left group ${
                  !canRouteToClient
                    ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                    : selectedRoute === 'send_to_client'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-500 hover:bg-purple-50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-colors ${
                    !canRouteToClient
                      ? 'bg-gray-100'
                      : selectedRoute === 'send_to_client'
                      ? 'bg-purple-200'
                      : 'bg-purple-100 group-hover:bg-purple-200'
                  }`}>
                    <User className={`w-4 h-4 sm:w-5 sm:h-5 ${!canRouteToClient ? 'text-gray-400' : 'text-purple-600'}`} />
                  </div>
                  <h3 className={`font-semibold ${!canRouteToClient ? 'text-gray-400' : 'text-gray-900'}`}>
                    Send to Client
                  </h3>
                </div>
                <p className={`text-xs sm:text-sm ${!canRouteToClient ? 'text-gray-400' : 'text-gray-500'}`}>
                  Send for client review/approval
                </p>
              </button>

              {/* Send to Manufacturer - Orange (like Back to Manufacturer) */}
              <button
                onClick={() => canRouteToManufacturer && setSelectedRoute('send_to_manufacturer')}
                disabled={!canRouteToManufacturer}
                className={`p-3 sm:p-4 border-2 rounded-lg transition-all text-left group ${
                  !canRouteToManufacturer
                    ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                    : selectedRoute === 'send_to_manufacturer'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-orange-500 hover:bg-orange-50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-colors ${
                    !canRouteToManufacturer
                      ? 'bg-gray-100'
                      : selectedRoute === 'send_to_manufacturer'
                      ? 'bg-orange-200'
                      : 'bg-orange-100 group-hover:bg-orange-200'
                  }`}>
                    <RotateCcw className={`w-4 h-4 sm:w-5 sm:h-5 ${!canRouteToManufacturer ? 'text-gray-400' : 'text-orange-600'}`} />
                  </div>
                  <h3 className={`font-semibold ${!canRouteToManufacturer ? 'text-gray-400' : 'text-gray-900'}`}>
                    To Manufacturer
                  </h3>
                </div>
                <p className={`text-xs sm:text-sm ${!canRouteToManufacturer ? 'text-gray-400' : 'text-gray-500'}`}>
                  Send sample request to manufacturer
                </p>
              </button>
            </div>

            {/* Routing Notes - Always visible like Product RouteModal */}
            <div className="mb-4 sm:mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Routing Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Add notes or instructions..."
              />
            </div>

            {/* Action Buttons - Matches Product RouteModal */}
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <button
                onClick={handleClose}
                className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRoute}
                disabled={!selectedRoute || sending || isRouting}
                className={`w-full sm:w-auto px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                  selectedRoute === 'send_to_client'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {sending || isRouting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Routing...
                  </>
                ) : (
                  <>
                    {selectedRoute === 'send_to_client' ? <User className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                    {selectedRoute === 'sample_approved' ? 'Approve Sample' :
                     selectedRoute === 'send_to_client' ? 'Send to Client' :
                     selectedRoute === 'send_to_manufacturer' ? 'Send to Manufacturer' :
                     'Submit'}
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}