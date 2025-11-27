/**
 * Save All & Route Modal Component
 * Bulk routing modal for all visible products
 * Used by manufacturers to route all products at once
 * Last Modified: November 2025
 */

import React, { useState } from 'react';
import { Send, Package, AlertCircle, Loader2, X, Truck } from 'lucide-react';

interface SaveAllRouteModalProps {
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onRoute: (route: string, notes?: string) => void;
  productCount: number;
  userRole?: string;
}

export function SaveAllRouteModal({ 
  isOpen, 
  isSaving,
  onClose, 
  onRoute,
  productCount,
  userRole 
}: SaveAllRouteModalProps) {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  
  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!selectedRoute) return;
    onRoute(selectedRoute, notes);
  };

  const isManufacturer = userRole === 'manufacturer';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Save All & Route {productCount} Products
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          This will save all pending changes and route all {productCount} products
        </p>

        <div className="space-y-3 mb-6">
          {isManufacturer ? (
            <>
              <button
                onClick={() => setSelectedRoute('send_to_admin')}
                disabled={isSaving}
                className={`w-full p-4 border-2 rounded-lg transition-all text-left ${
                  selectedRoute === 'send_to_admin'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Send className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Send to Admin</h3>
                    <p className="text-xs text-gray-500">Send all products to admin for review</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedRoute('in_production')}
                disabled={isSaving}
                className={`w-full p-4 border-2 rounded-lg transition-all text-left ${
                  selectedRoute === 'in_production'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-green-500 hover:bg-green-50'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Mark In Production</h3>
                    <p className="text-xs text-gray-500">Mark all products as in production</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedRoute('shipped')}
                disabled={isSaving}
                className={`w-full p-4 border-2 rounded-lg transition-all text-left ${
                  selectedRoute === 'shipped'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-500 hover:bg-purple-50'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Truck className="w-5 h-5 text-purple-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Mark as Shipped</h3>
                    <p className="text-xs text-gray-500">All products have been shipped</p>
                  </div>
                </div>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setSelectedRoute('approve_for_production')}
                disabled={isSaving}
                className={`w-full p-4 border-2 rounded-lg transition-all text-left ${
                  selectedRoute === 'approve_for_production'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-green-500 hover:bg-green-50'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Approve for Production</h3>
                    <p className="text-xs text-gray-500">Send all to manufacturer for production</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedRoute('request_sample')}
                disabled={isSaving}
                className={`w-full p-4 border-2 rounded-lg transition-all text-left ${
                  selectedRoute === 'request_sample'
                    ? 'border-yellow-500 bg-yellow-50'
                    : 'border-gray-200 hover:border-yellow-500 hover:bg-yellow-50'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Request Samples</h3>
                    <p className="text-xs text-gray-500">Request samples for all products</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedRoute('send_back_to_manufacturer')}
                disabled={isSaving}
                className={`w-full p-4 border-2 rounded-lg transition-all text-left ${
                  selectedRoute === 'send_back_to_manufacturer'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-orange-500 hover:bg-orange-50'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Send className="w-5 h-5 text-orange-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Back to Manufacturer</h3>
                    <p className="text-xs text-gray-500">Request revisions from manufacturer</p>
                  </div>
                </div>
              </button>
            </>
          )}
        </div>

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
      </div>
    </div>
  );
}