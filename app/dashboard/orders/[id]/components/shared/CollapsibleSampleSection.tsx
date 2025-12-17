/**
 * CollapsibleSampleSection Component
 * Wraps OrderSampleRequest in a collapsible container matching product card style
 * 
 * UPDATED Dec 2025:
 * - Route button now opens inline modal (like ProductRouteModal)
 * - Includes Ship Sample option for manufacturers
 * 
 * Last Modified: December 2025
 */

import React, { useState, useEffect } from 'react';
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
  FlaskConical,
  Truck,
  CheckCircle,
  X,
  Loader2,
  Package,
  RotateCcw
} from 'lucide-react';

interface ShippingData {
  trackingNumber?: string;
  shippingCarrier?: string;
  estimatedDelivery?: string;
  shippingNotes?: string;
}

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
  isSampleShipped?: boolean;
  existingTrackingNumber?: string;
  existingCarrier?: string;
  onUpdate: (field: string, value: any) => void;
  onFileUpload: (files: FileList | null) => void;
  onFileRemove: (index: number) => void;
  onExistingFileDelete: (mediaId: string) => void;
  onViewHistory: () => void;
  onSave: (data: any) => void;
  onRouteToManufacturer: (notes?: string) => Promise<boolean>;
  onRouteToAdmin: (notes?: string) => Promise<boolean>;
  onRouteToClient: (notes?: string) => Promise<boolean>;
  onShipSample?: (shippingData: ShippingData) => Promise<boolean>;
  onSampleApproved?: (notes?: string) => Promise<boolean>;
  canRouteToManufacturer: boolean;
  canRouteToAdmin: boolean;
  canRouteToClient: boolean;
  canShipSample?: boolean;
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
  onShipSample,
  onSampleApproved,
  canRouteToManufacturer,
  canRouteToAdmin,
  canRouteToClient,
  canShipSample = false,
  isRouting = false,
  isSampleShipped = false,
  existingTrackingNumber,
  existingCarrier,
  t = (key) => key,
  defaultExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [routeNotes, setRouteNotes] = useState('');
  const [sending, setSending] = useState(false);
  
  // Shipping fields
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingCarrier, setShippingCarrier] = useState('');
  const [shippingNotes, setShippingNotes] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (showRouteModal) {
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
  }, [showRouteModal]);

  // Determine if user can route at all
  const isAdminOrSuper = userRole === 'admin' || userRole === 'super_admin';
  
  // Manufacturer can route when sample is with them
  const manufacturerCanRoute = isManufacturer && sampleRoutedTo === 'manufacturer' && !isSampleShipped;
  // Admin can route when sample is with admin
  const adminCanRoute = isAdminOrSuper && sampleRoutedTo === 'admin' && !isSampleShipped;
  
  const canShowRouteButton = manufacturerCanRoute || adminCanRoute;

  const handleRoute = async () => {
    if (!selectedRoute) return;
    
    setSending(true);
    try {
      let success = false;
      
      if (selectedRoute === 'admin' && onRouteToAdmin) {
        success = await onRouteToAdmin(routeNotes);
      } else if (selectedRoute === 'manufacturer' && onRouteToManufacturer) {
        success = await onRouteToManufacturer(routeNotes);
      } else if (selectedRoute === 'client' && onRouteToClient) {
        success = await onRouteToClient(routeNotes);
      } else if (selectedRoute === 'ship' && onShipSample) {
        success = await onShipSample({
          trackingNumber: trackingNumber || undefined,
          shippingCarrier: shippingCarrier || undefined,
          estimatedDelivery: estimatedDelivery || undefined,
          shippingNotes: shippingNotes || routeNotes || undefined
        });
      }
      
      if (success) {
        handleCloseModal();
      }
    } catch (error) {
      console.error('Error routing sample:', error);
    } finally {
      setSending(false);
    }
  };

  const handleCloseModal = () => {
    setShowRouteModal(false);
    setSelectedRoute(null);
    setRouteNotes('');
    setTrackingNumber('');
    setShippingCarrier('');
    setShippingNotes('');
    setEstimatedDelivery('');
  };

  // Determine routing badge
  const getRoutingBadge = () => {
    if (isSampleShipped) {
      return { label: 'Shipped', icon: Truck, bgColor: 'bg-cyan-100', textColor: 'text-cyan-700', borderColor: 'border-cyan-200' };
    }
    if (sampleRoutedTo === 'admin') {
      return { label: 'With Admin', icon: Users, bgColor: 'bg-blue-100', textColor: 'text-blue-700', borderColor: 'border-blue-200' };
    } else if (sampleRoutedTo === 'manufacturer') {
      return { label: 'With Manufacturer', icon: Building, bgColor: 'bg-amber-100', textColor: 'text-amber-700', borderColor: 'border-amber-200' };
    } else if (sampleRoutedTo === 'client') {
      return { label: 'With Client', icon: Users, bgColor: 'bg-purple-100', textColor: 'text-purple-700', borderColor: 'border-purple-200' };
    }
    return { label: 'Pending', icon: Clock, bgColor: 'bg-gray-100', textColor: 'text-gray-700', borderColor: 'border-gray-200' };
  };

  const routingBadge = getRoutingBadge();

  // Get status badge styling
  const getStatusBadge = () => {
    const statuses: Record<string, { label: string; bgColor: string; textColor: string; borderColor: string; icon?: any }> = {
      'approved': { label: 'Approved', bgColor: 'bg-emerald-100', textColor: 'text-emerald-700', borderColor: 'border-emerald-200', icon: CheckCircle },
      'sample_approved': { label: 'Approved', bgColor: 'bg-emerald-100', textColor: 'text-emerald-700', borderColor: 'border-emerald-200', icon: CheckCircle },
      'in_production': { label: 'In Production', bgColor: 'bg-blue-100', textColor: 'text-blue-700', borderColor: 'border-blue-200' },
      'pending': { label: 'Pending', bgColor: 'bg-slate-100', textColor: 'text-slate-700', borderColor: 'border-slate-200' },
      'rejected': { label: 'Rejected', bgColor: 'bg-red-100', textColor: 'text-red-700', borderColor: 'border-red-200' },
      'shipped': { label: 'Shipped', bgColor: 'bg-cyan-100', textColor: 'text-cyan-700', borderColor: 'border-cyan-200', icon: Truck },
      'delivered': { label: 'Delivered', bgColor: 'bg-green-100', textColor: 'text-green-700', borderColor: 'border-green-200', icon: CheckCircle },
      'no_sample': { label: 'No Sample', bgColor: 'bg-gray-100', textColor: 'text-gray-500', borderColor: 'border-gray-200' }
    };
    return statuses[sampleStatus] || statuses.pending;
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="mb-4">
      {/* Section Header */}
      <h2 className="text-sm sm:text-lg font-semibold text-gray-900 flex items-center gap-2 mb-2">
        <FlaskConical className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
        Sample
      </h2>

      {/* Collapsible Card */}
      <div className={`bg-white rounded-lg shadow-lg border overflow-hidden transition-all ${isExpanded ? 'border-amber-300' : 'border-gray-300'}`}>
        {/* Header - Always Visible */}
        <div 
          className="flex items-center justify-between p-3 sm:p-4 cursor-pointer bg-gray-50 border-b-2 border-gray-200 hover:bg-gray-100 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0">
              {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-600" /> : <ChevronRight className="w-5 h-5 text-gray-600" />}
            </button>

            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FlaskConical className="w-5 h-5 text-amber-600" />
            </div>
            
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Tech Pack / Sample</h3>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full border flex items-center gap-1 ${statusBadge.bgColor} ${statusBadge.textColor} ${statusBadge.borderColor}`}>
                  {statusBadge.icon && <statusBadge.icon className="w-3 h-3" />}
                  {statusBadge.label}
                </span>
                {!isSampleShipped && sampleStatus !== 'shipped' && (
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1 border ${routingBadge.bgColor} ${routingBadge.textColor} ${routingBadge.borderColor}`}>
                    <routingBadge.icon className="w-3 h-3" />
                    {routingBadge.label}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-600 flex-wrap">
                {sampleFee && parseFloat(sampleFee) > 0 && (
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <span className="font-medium text-gray-700">${parseFloat(sampleFee).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </span>
                )}
                {sampleETA && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <span className="font-medium text-gray-700">{new Date(sampleETA + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                  </span>
                )}
                {existingMedia.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-purple-500" />
                    <span className="font-medium text-gray-700">{existingMedia.length} file{existingMedia.length !== 1 ? 's' : ''}</span>
                  </span>
                )}
                {isSampleShipped && existingTrackingNumber && (
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-cyan-500" />
                    <span className="font-medium text-cyan-700">{existingCarrier ? `${existingCarrier}: ` : ''}{existingTrackingNumber}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <button
              onClick={(e) => { e.stopPropagation(); onViewHistory(); }}
              className="px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium flex items-center gap-2 relative"
            >
              <History className="w-4 h-4" />
              {hasNewHistory && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />}
            </button>

            {canShowRouteButton && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowRouteModal(true); }}
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

      {/* ROUTE MODAL - Same style as ProductRouteModal */}
      {showRouteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                  {isManufacturer ? 'Update Sample Status' : 'Route Sample'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">Tech Pack / Sample Request</p>
              </div>
              <button onClick={handleCloseModal} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Already shipped warning */}
            {isSampleShipped && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-lg">
                <div className="flex items-start gap-3">
                  <Truck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-amber-800">Sample Already Shipped</h3>
                    <p className="text-sm text-amber-700 mt-1">This sample has been shipped and cannot be re-routed.</p>
                    {existingTrackingNumber && (
                      <p className="text-sm text-amber-700 mt-2"><strong>Tracking:</strong> {existingTrackingNumber}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Routing Options */}
            {!isSampleShipped && (
              <div className="grid grid-cols-1 gap-3 sm:gap-4 mb-4 sm:mb-6">
                {/* MANUFACTURER OPTIONS */}
                {isManufacturer && sampleRoutedTo === 'manufacturer' && (
                  <>
                    <button
                      onClick={() => setSelectedRoute('admin')}
                      className={`p-3 sm:p-4 border-2 rounded-lg transition-all text-left group ${selectedRoute === 'admin' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-colors ${selectedRoute === 'admin' ? 'bg-blue-200' : 'bg-blue-100 group-hover:bg-blue-200'}`}>
                          <Send className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">Send to Admin</h3>
                          <p className="text-xs sm:text-sm text-gray-500">Send question or update to admin</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setSelectedRoute('ship')}
                      className={`p-3 sm:p-4 border-2 rounded-lg transition-all text-left group ${selectedRoute === 'ship' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-500 hover:bg-purple-50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-colors ${selectedRoute === 'ship' ? 'bg-purple-200' : 'bg-purple-100 group-hover:bg-purple-200'}`}>
                          <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">Ship Sample</h3>
                          <p className="text-xs sm:text-sm text-gray-500">Sample complete, ready to ship</p>
                        </div>
                      </div>
                    </button>
                  </>
                )}

                {/* ADMIN OPTIONS */}
                {isAdminOrSuper && sampleRoutedTo === 'admin' && (
                  <>
                    <button
                      onClick={() => setSelectedRoute('client')}
                      className={`p-3 sm:p-4 border-2 rounded-lg transition-all text-left group ${selectedRoute === 'client' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-500 hover:bg-purple-50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-colors ${selectedRoute === 'client' ? 'bg-purple-200' : 'bg-purple-100 group-hover:bg-purple-200'}`}>
                          <Users className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">Send to Client</h3>
                          <p className="text-xs sm:text-sm text-gray-500">Send for client approval</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setSelectedRoute('manufacturer')}
                      className={`p-3 sm:p-4 border-2 rounded-lg transition-all text-left group ${selectedRoute === 'manufacturer' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-500 hover:bg-orange-50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-colors ${selectedRoute === 'manufacturer' ? 'bg-orange-200' : 'bg-orange-100 group-hover:bg-orange-200'}`}>
                          <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">Back to Manufacturer</h3>
                          <p className="text-xs sm:text-sm text-gray-500">Request revisions from manufacturer</p>
                        </div>
                      </div>
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Shipping Fields */}
            {selectedRoute === 'ship' && (
              <div className="mb-4 sm:mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-purple-600" />
                  Shipping Information
                </h3>
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">Tracking Number (optional)</label>
                  <input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Enter tracking number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium placeholder-gray-500 focus:ring-2 focus:ring-purple-500 bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">Shipping Carrier (optional)</label>
                  <select value={shippingCarrier} onChange={(e) => setShippingCarrier(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-purple-500 bg-white">
                    <option value="">Select carrier</option>
                    <option value="DHL">DHL</option>
                    <option value="FedEx">FedEx</option>
                    <option value="UPS">UPS</option>
                    <option value="USPS">USPS</option>
                    <option value="China Post">China Post</option>
                    <option value="SF Express">SF Express</option>
                    <option value="EMS">EMS</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">Estimated Delivery (optional)</label>
                  <input type="date" value={estimatedDelivery} onChange={(e) => setEstimatedDelivery(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-purple-500 bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">Shipping Notes (optional)</label>
                  <textarea value={shippingNotes} onChange={(e) => setShippingNotes(e.target.value)} placeholder="Package details, special instructions..." rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium placeholder-gray-500 focus:ring-2 focus:ring-purple-500 bg-white" />
                </div>
              </div>
            )}

            {/* Routing Notes */}
            {selectedRoute !== 'ship' && !isSampleShipped && (
              <div className="mb-4 sm:mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {isManufacturer ? 'Notes for Admin' : 'Routing Notes'} (optional)
                </label>
                <textarea value={routeNotes} onChange={(e) => setRouteNotes(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" rows={3} placeholder={isManufacturer ? 'Add questions or updates for admin...' : 'Add notes or instructions...'} />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <button onClick={handleCloseModal} className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleRoute}
                disabled={!selectedRoute || sending || isSampleShipped}
                className={`w-full sm:w-auto px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${selectedRoute === 'ship' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {selectedRoute === 'ship' ? 'Shipping...' : 'Routing...'}
                  </>
                ) : (
                  <>
                    {selectedRoute === 'ship' ? <Truck className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                    {selectedRoute === 'ship' ? 'Ship Sample' : 'Submit Routing'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
