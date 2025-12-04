/**
 * Save All & Route Modal Component
 * Bulk routing modal for all visible products
 * Used by manufacturers AND admins to route all products at once
 * UPDATED: Removed sample request option (now handled independently)
 * Last Modified: November 30, 2025
 */

import React, { useState } from 'react';
import { 
  Send, Package, Loader2, X, Truck, 
  Factory, User, CheckCircle, Building, PlayCircle
} from 'lucide-react';

interface RouteOption {
  value: string;
  label: string;
  description: string;
  icon?: any;
  color?: string;
}

interface SaveAllRouteModalProps {
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onRoute: (route: string, notes?: string) => void;
  productCount: number;
  userRole?: string;
  routeOptions?: RouteOption[];
  currentStep?: number;
  steps?: string[];
}

export function SaveAllRouteModal({
  isOpen,
  isSaving,
  onClose,
  onRoute,
  productCount,
  userRole,
  routeOptions,
  currentStep = 0,
  steps = []
}: SaveAllRouteModalProps) {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // Prevent background scroll when modal is open
  React.useEffect(() => {
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

  const handleSubmit = () => {
    if (!selectedRoute) return;
    onRoute(selectedRoute, notes);
  };

  const isManufacturer = userRole === 'manufacturer';

  // Get color classes for button based on route type
  const getButtonColors = (routeValue: string) => {
    const colors: Record<string, { selected: string; hover: string; icon: string }> = {
      send_to_admin: { 
        selected: 'border-blue-500 bg-blue-50', 
        hover: 'hover:border-blue-500 hover:bg-blue-50',
        icon: 'text-blue-600'
      },
      send_to_manufacturer: { 
        selected: 'border-indigo-500 bg-indigo-50', 
        hover: 'hover:border-indigo-500 hover:bg-indigo-50',
        icon: 'text-indigo-600'
      },
      in_production: { 
        selected: 'border-green-500 bg-green-50', 
        hover: 'hover:border-green-500 hover:bg-green-50',
        icon: 'text-green-600'
      },
      shipped: { 
        selected: 'border-purple-500 bg-purple-50', 
        hover: 'hover:border-purple-500 hover:bg-purple-50',
        icon: 'text-purple-600'
      },
      approve_for_production: { 
        selected: 'border-green-500 bg-green-50', 
        hover: 'hover:border-green-500 hover:bg-green-50',
        icon: 'text-green-600'
      },
      send_back_to_manufacturer: { 
        selected: 'border-orange-500 bg-orange-50', 
        hover: 'hover:border-orange-500 hover:bg-orange-50',
        icon: 'text-orange-600'
      },
      send_for_approval: { 
        selected: 'border-purple-500 bg-purple-50', 
        hover: 'hover:border-purple-500 hover:bg-purple-50',
        icon: 'text-purple-600'
      }
    };
    
    const defaultColors = { 
      selected: 'border-blue-500 bg-blue-50', 
      hover: 'hover:border-blue-500 hover:bg-blue-50',
      icon: 'text-blue-600'
    };
    
    return colors[routeValue] || defaultColors;
  };

  // Get icon for route type
  const getRouteIcon = (routeValue: string) => {
    const icons: Record<string, any> = {
      send_to_admin: User,
      send_to_manufacturer: Factory,
      in_production: PlayCircle,
      shipped: Truck,
      approve_for_production: CheckCircle,
      send_back_to_manufacturer: Send,
      send_for_approval: Building
    };
    return icons[routeValue] || Send;
  };

  // Default route options if not provided
  const defaultManufacturerOptions: RouteOption[] = [
    { value: 'send_to_admin', label: 'Send to Admin', description: 'Send all products to admin for review' },
    { value: 'in_production', label: 'Mark In Production', description: 'Mark all products as in production' },
    { value: 'shipped', label: 'Mark as Shipped', description: 'All products have been shipped' }
  ];

  // Admin options - NO request_sample (samples handled independently now)
  const defaultAdminOptions: RouteOption[] = [
    { value: 'send_to_manufacturer', label: 'Send to Manufacturer', description: 'Send all products to manufacturer for pricing/production' },
    { value: 'approve_for_production', label: 'Approve for Production', description: 'Send all to manufacturer for production' },
    { value: 'send_for_approval', label: 'Send to Client', description: 'Send all products to client for approval' }
  ];

  const options = routeOptions || (isManufacturer ? defaultManufacturerOptions : defaultAdminOptions);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold text-gray-900">
            Save All & Route {productCount} Products
          </h2>
          {!isSaving && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-6">
          This will save all pending changes and route all {productCount} products
        </p>

        {/* Progress Display when Saving */}
        {isSaving && steps.length > 0 ? (
          <div className="py-4">
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-200 rounded-full"></div>
                <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
              </div>
            </div>
            
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div 
                  key={index}
                  className={`flex items-center gap-3 ${
                    index < currentStep 
                      ? 'text-green-600' 
                      : index === currentStep 
                      ? 'text-blue-600' 
                      : 'text-gray-400'
                  }`}
                >
                  {index < currentStep ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : index === currentStep ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-current" />
                  )}
                  <span className="text-sm font-medium">{step}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Route Options - Button Style */}
            <div className="space-y-3 mb-6">
              {options.map((option) => {
                const Icon = getRouteIcon(option.value);
                const colors = getButtonColors(option.value);
                
                return (
                  <button
                    key={option.value}
                    onClick={() => setSelectedRoute(option.value)}
                    disabled={isSaving}
                    className={`w-full p-4 border-2 rounded-lg transition-all text-left ${
                      selectedRoute === option.value
                        ? colors.selected
                        : `border-gray-200 ${colors.hover}`
                    } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${colors.icon}`} />
                      <div>
                        <h3 className="font-semibold text-gray-900">{option.label}</h3>
                        <p className="text-xs text-gray-500">{option.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Warning Messages */}
            {selectedRoute === 'shipped' && (
              <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-start gap-2">
                <Truck className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-purple-800">
                  <strong>Shipping:</strong> This will set the shipped date and notify the admin. Make sure all products are ready.
                </div>
              </div>
            )}

            {selectedRoute === 'in_production' && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                <PlayCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-800">
                  <strong>Production:</strong> Starting production will lock these products from further edits.
                </div>
              </div>
            )}

            {selectedRoute === 'send_to_manufacturer' && (
              <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-start gap-2">
                <Factory className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-indigo-800">
                  <strong>Note:</strong> Products will be sent to manufacturer for pricing.
                </div>
              </div>
            )}

            {selectedRoute === 'send_for_approval' && (
              <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-start gap-2">
                <Building className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-purple-800">
                  <strong>Note:</strong> Products will be sent to client portal for approval.
                </div>
              </div>
            )}

            {/* Notes Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSaving}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                rows={3}
                placeholder={isManufacturer ? "Add any notes for admin..." : "Add routing instructions..."}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedRoute || isSaving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Save All & Route
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