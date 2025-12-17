/**
 * Order Sample Request Component - UPDATED
 * Order-level sample request with independent routing workflow
 * 
 * UPDATED: Consistent naming "Tech Pack / Sample"
 * UPDATED: Button styles to match product cards (solid colors)
 * UPDATED: Route buttons are solid blue, Save is lighter green
 * FIXED: Removed extra $ sign from fee display
 * FIXED: Removed flask icons as requested
 * FIXED: Route modal simplified to just 2 options (Send to Client, Back to Manufacturer)
 * FIXED: Currency formatting always shows 2 decimal places ($1,537.50 not $1,537.5)
 * FIXED: Status dropdown unlocked for Manufacturer and Super Admin after approval
 * 
 * Last Modified: December 15, 2025
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertCircle, Calendar, DollarSign, Upload, X, Save, Loader2, 
  Paperclip, History, Send, Building, User,
  Factory, Ban, MessageSquare, FileText, Users, RotateCcw, Truck, Package, CheckCircle
} from 'lucide-react';
import { ACCEPTED_FILE_TYPES } from '@/lib/constants/fileUpload';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';

// Data to pass to save function
interface SampleSaveData {
  fee: string;
  eta: string;
  status: string;
  notes: string;
}

interface ShippingData {
  trackingNumber?: string;
  shippingCarrier?: string;
  estimatedDelivery?: string;
  shippingNotes?: string;
}

interface OrderSampleRequestProps {
  orderId?: string;
  sampleFee: string;
  sampleETA: string;
  sampleStatus: string;
  sampleNotes: string;
  sampleFiles?: File[];
  existingMedia?: any[];
  existingSampleNotes?: string;
  sampleRoutedTo?: 'admin' | 'manufacturer' | 'client';
  sampleWorkflowStatus?: string;
  onRouteToManufacturer?: (notes?: string) => Promise<boolean>;
  onRouteToAdmin?: (notes?: string) => Promise<boolean>;
  onRouteToClient?: (notes?: string) => Promise<boolean>;
  onShipSample?: (shippingData: ShippingData) => Promise<boolean>;
  canRouteToManufacturer?: boolean;
  canRouteToAdmin?: boolean;
  canRouteToClient?: boolean;
  canShipSample?: boolean;
  isRouting?: boolean;
  isSampleShipped?: boolean;
  existingTrackingNumber?: string;
  existingCarrier?: string;
  onUpdate: (field: string, value: any) => void;
  onFileUpload?: (files: FileList | null) => void;
  onFileRemove?: (index: number) => void;
  onExistingFileDelete?: (mediaId: string) => void;
  onViewHistory?: () => void;
  hasNewHistory?: boolean;
  isManufacturer?: boolean;
  isClient?: boolean;
  userRole?: string;
  readOnly?: boolean;
  onSave?: (data: SampleSaveData) => Promise<void>;
  saving?: boolean;
  hideHeader?: boolean;
}

export const OrderSampleRequest: React.FC<OrderSampleRequestProps> = ({
  orderId,
  sampleFee,
  sampleETA,
  sampleStatus,
  sampleNotes,
  sampleFiles = [],
  existingMedia = [],
  existingSampleNotes = '',
  sampleRoutedTo = 'admin',
  sampleWorkflowStatus = 'pending',
  onRouteToManufacturer,
  onRouteToAdmin,
  onRouteToClient,
  onShipSample,
  canRouteToManufacturer = false,
  canRouteToAdmin = false,
  canRouteToClient = false,
  canShipSample = false,
  isRouting = false,
  isSampleShipped = false,
  existingTrackingNumber,
  existingCarrier,
  onUpdate,
  onFileUpload,
  onFileRemove,
  onExistingFileDelete,
  onViewHistory,
  hasNewHistory = false,
  isManufacturer = false,
  isClient = false,
  userRole = 'admin',
  readOnly = false,
  onSave,
  saving = false,
  hideHeader = false
}) => {
  const { t } = useTranslation();

  // Track if this is initial mount vs user interaction
  const isInitialMount = useRef(true);
  const userChangedStatus = useRef(false);

  // LOCAL state for form fields
  const getInitialStatus = () => {
    if (sampleStatus && sampleStatus !== 'pending') return sampleStatus;
    const hasFee = sampleFee && parseFloat(sampleFee) > 0;
    const hasETA = sampleETA && sampleETA.trim() !== '';
    const hasFiles = existingMedia && existingMedia.length > 0;
    if (!hasFee && !hasETA && !hasFiles) {
      return 'no_sample';
    }
    return sampleStatus || 'pending';
  };

  const [localFee, setLocalFee] = useState(sampleFee);
  const [localETA, setLocalETA] = useState(sampleETA);
  const [localStatus, setLocalStatus] = useState(getInitialStatus());
  const [localNotes, setLocalNotes] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  
  // Route modal state
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeDestination, setRouteDestination] = useState<'manufacturer' | 'admin' | 'client' | 'ship' | null>(null);
  const [routeNotes, setRouteNotes] = useState('');
  
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
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    };
  }, [showRouteModal]);

  // Sync on initial mount
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      setLocalFee(sampleFee);
      setLocalETA(sampleETA);
      setLocalStatus(getInitialStatus());
      setIsDirty(false);
    } else if (!isDirty && !userChangedStatus.current) {
      setLocalFee(sampleFee);
      setLocalETA(sampleETA);
      setLocalStatus(getInitialStatus());
    }
    userChangedStatus.current = false;
  }, [sampleFee, sampleETA, sampleStatus]);

  // Check if sample has any data
  const hasSampleData = (): boolean => {
    const hasFee = localFee && parseFloat(localFee) > 0;
    const hasETA = localETA && localETA.trim() !== '';
    const hasFiles = existingMedia.length > 0 || sampleFiles.length > 0;
    return hasFee || hasETA || hasFiles;
  };

  // Auto-detect status based on data
  const getAutoStatus = (): string => {
    if (!hasSampleData() && localStatus === 'no_sample') {
      return 'no_sample';
    }
    if (hasSampleData() && localStatus === 'no_sample') {
      return 'pending';
    }
    return localStatus;
  };

  const handleFeeChange = (value: string) => {
    setLocalFee(value);
    onUpdate('sampleFee', value);
    setIsDirty(true);
    
    if (value && parseFloat(value) > 0 && localStatus === 'no_sample') {
      setLocalStatus('pending');
      onUpdate('sampleStatus', 'pending');
    }
  };

  const handleETAChange = (value: string) => {
    setLocalETA(value);
    onUpdate('sampleETA', value);
    setIsDirty(true);
    
    if (value && localStatus === 'no_sample') {
      setLocalStatus('pending');
      onUpdate('sampleStatus', 'pending');
    }
  };

  const handleStatusChange = (value: string) => {
    userChangedStatus.current = true;
    setLocalStatus(value);
    onUpdate('sampleStatus', value);
    onUpdate('sampleWorkflowStatus', value);
    setIsDirty(true);
  };

  const handleNotesChange = (value: string) => {
    setLocalNotes(value);
    onUpdate('sampleNotes', value);
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (onSave) {
      const finalStatus = getAutoStatus();
      
      await onSave({
        fee: localFee,
        eta: localETA,
        status: finalStatus,
        notes: localNotes
      });
      setLocalNotes('');
      setLocalStatus(finalStatus);
      setIsDirty(false);
    }
  };

  const handleCancel = () => {
    setLocalFee(sampleFee);
    setLocalETA(sampleETA);
    setLocalStatus(getInitialStatus());
    setLocalNotes('');
    setIsDirty(false);
  };

  const handleFileClick = (fileUrl: string) => {
    window.open(fileUrl, '_blank');
  };

  // Route modal handlers - opens modal for selection
  const openRouteModal = () => {
    console.log('openRouteModal called - setting showRouteModal to true');
    setRouteDestination(null);
    setRouteNotes('');
    setTrackingNumber('');
    setShippingCarrier('');
    setShippingNotes('');
    setEstimatedDelivery('');
    setShowRouteModal(true);
    console.log('showRouteModal should now be true');
  };

  const saveNoteToClientAdminNotes = async (note: string) => {
    if (!note.trim() || !orderId) return;
    
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const role = user.role === 'super_admin' ? 'super_admin' : 
                   user.role === 'manufacturer' ? 'admin' :
                   'admin';
      
      await supabase
        .from('client_admin_notes')
        .insert({
          order_id: orderId,
          note: note.trim(),
          created_by: user.id,
          created_by_name: user.name || user.email || 'Admin',
          created_by_role: role,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error saving note to client_admin_notes:', error);
    }
  };

  const handleRoute = async () => {
    if (!routeDestination) return;
    
    if (onSave && isDirty) {
      const finalStatus = getAutoStatus();
      await onSave({
        fee: localFee,
        eta: localETA,
        status: finalStatus,
        notes: localNotes
      });
      setLocalNotes('');
      setLocalStatus(finalStatus);
    }
    
    if (routeDestination === 'client' && routeNotes.trim()) {
      await saveNoteToClientAdminNotes(routeNotes);
    }
    
    let success = false;
    
    if (routeDestination === 'manufacturer' && onRouteToManufacturer) {
      success = await onRouteToManufacturer(routeNotes);
    } else if (routeDestination === 'admin' && onRouteToAdmin) {
      success = await onRouteToAdmin(routeNotes);
    } else if (routeDestination === 'client' && onRouteToClient) {
      success = await onRouteToClient(routeNotes);
    } else if (routeDestination === 'ship' && onShipSample) {
      success = await onShipSample({
        trackingNumber: trackingNumber || undefined,
        shippingCarrier: shippingCarrier || undefined,
        estimatedDelivery: estimatedDelivery || undefined,
        shippingNotes: shippingNotes || routeNotes || undefined
      });
    }
    
    if (success) {
      setShowRouteModal(false);
      setRouteNotes('');
      setRouteDestination(null);
      setTrackingNumber('');
      setShippingCarrier('');
      setShippingNotes('');
      setEstimatedDelivery('');
      setIsDirty(false);
    }
  };

  const isSampleActive = localStatus !== 'no_sample' || hasSampleData();

  const getRoutingStatusBadge = () => {
    if (localStatus === 'no_sample' && !hasSampleData()) {
      return (
        <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs font-medium flex items-center gap-1">
          <Ban className="w-3 h-3" />
          {t('noSample') || 'No Sample'}
        </span>
      );
    }
    
    const badges: Record<string, { bg: string; text: string; label: string; icon: any }> = {
      admin: { bg: 'bg-purple-100', text: 'text-purple-700', label: t('withAdmin') || 'With Admin', icon: User },
      manufacturer: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: t('withManufacturer') || 'With Manufacturer', icon: Factory },
      client: { bg: 'bg-blue-100', text: 'text-blue-700', label: t('withClient') || 'With Client', icon: Building }
    };
    
    const badge = badges[sampleRoutedTo] || badges.admin;
    const Icon = badge.icon;
    
    return (
      <span className={`px-2 py-1 ${badge.bg} ${badge.text} rounded text-xs font-medium flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  const getSampleStatusBadge = () => {
    const statuses: Record<string, { bg: string; text: string; label: string }> = {
      no_sample: { bg: 'bg-gray-100', text: 'text-gray-500', label: t('noSample') || 'No Sample' },
      pending: { bg: 'bg-gray-100', text: 'text-gray-700', label: t('pending') || 'Pending' },
      in_production: { bg: 'bg-amber-100', text: 'text-amber-700', label: t('inProduction') || 'In Production' },
      ready: { bg: 'bg-blue-100', text: 'text-blue-700', label: t('ready') || 'Ready' },
      shipped: { bg: 'bg-purple-100', text: 'text-purple-700', label: t('shipped') || 'Shipped' },
      delivered: { bg: 'bg-green-100', text: 'text-green-700', label: t('delivered') || 'Delivered' },
      sample_approved: { bg: 'bg-green-100', text: 'text-green-700', label: t('sampleApproved') || 'Approved' },
      approved: { bg: 'bg-green-100', text: 'text-green-700', label: t('sampleApproved') || 'Approved' },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', label: t('rejected') || 'Rejected' }
    };
    
    const status = statuses[localStatus] || statuses.pending;
    
    if (localStatus === 'no_sample' && !hasSampleData()) {
      return null;
    }
    
    return (
      <span className={`px-2 py-1 ${status.bg} ${status.text} rounded text-xs font-medium`}>
        {status.label}
      </span>
    );
  };

  const showSaveButton = isDirty || sampleFiles.length > 0;
  
  // canEdit: Who can edit status and notes
  // - Super Admin can ALWAYS edit (regardless of routing)
  // - Manufacturer can edit when sample is with them OR when updating status (e.g., to "In Production")
  // - Admin can edit when sample is with admin
  // - Client can edit when sample is with client
  const canEdit = !readOnly && (
    userRole === 'super_admin' ||
    (sampleRoutedTo === 'admin' && userRole === 'admin') ||
    (sampleRoutedTo === 'manufacturer' && isManufacturer) ||
    (isManufacturer && ['sample_approved', 'in_production', 'ready', 'shipped', 'delivered'].includes(localStatus)) ||
    (sampleRoutedTo === 'client' && isClient)
  );
  
  const canEditFeeETA = !readOnly && (userRole === 'super_admin' || isManufacturer);
  
  const showRoutingButtons = isSampleActive;
  
  // Check if any routing option is available
  // For manufacturers: they can route to admin OR ship when sample is with them
  // For admins: they can route to manufacturer, client, or approve
  const hasAnyRouteOption = canRouteToManufacturer || canRouteToClient || canRouteToAdmin || canShipSample;
  
  // Debug logging - remove after fixing
  console.log('OrderSampleRequest Route Debug:', {
    userRole,
    isManufacturer,
    sampleRoutedTo,
    isSampleShipped,
    canRouteToAdmin,
    canShipSample,
    canRouteToManufacturer,
    canRouteToClient,
    hasAnyRouteOption,
    showRouteModal
  });
  
  // Override hasAnyRouteOption for manufacturers - if sample is with them, they can always route
  const manufacturerCanRoute = isManufacturer && sampleRoutedTo === 'manufacturer' && !isSampleShipped;
  const adminCanRoute = !isManufacturer && sampleRoutedTo === 'admin' && !isSampleShipped;
  const effectiveHasRouteOption = hasAnyRouteOption || manufacturerCanRoute || adminCanRoute;

  return (
    <div className={`${hideHeader ? 'p-3 sm:p-4' : 'rounded-lg p-2.5 sm:p-4 border mb-2 sm:mb-4'} ${
      hideHeader ? '' : (isSampleActive ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200')
    }`}>
      {/* Header - CONDITIONALLY HIDDEN - NO FLASK ICONS */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2 mb-2 sm:mb-3">
          <h3 className={`text-xs sm:text-sm font-semibold flex items-center ${
            isSampleActive ? 'text-amber-900' : 'text-gray-500'
          }`}>
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 flex-shrink-0" />
            <span>{t('techPackSample') || 'Tech Pack / Sample'}</span>
          </h3>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {getRoutingStatusBadge()}
            {getSampleStatusBadge()}
            
            {/* Fee display - NO extra $, always 2 decimal places */}
            {localFee && parseFloat(localFee) > 0 && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                {parseFloat(localFee).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
            
            {/* ETA display */}
            {localETA && (
              <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {localETA}
              </span>
            )}

            {/* Shipped tracking display */}
            {isSampleShipped && existingTrackingNumber && (
              <span className="px-2 py-1 bg-cyan-100 text-cyan-700 rounded text-xs font-medium flex items-center gap-1">
                <Truck className="w-3 h-3" />
                {existingCarrier ? `${existingCarrier}: ` : ''}{existingTrackingNumber}
              </span>
            )}

            {existingMedia && existingMedia.length > 0 && (
              <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium flex items-center gap-1">
                <Paperclip className="w-3 h-3" />
                {existingMedia.length} {t('files') || 'files'}
              </span>
            )}

            {/* History Button */}
            {onViewHistory && (
              <button
                onClick={onViewHistory}
                className="px-2.5 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs font-medium flex items-center gap-1.5 relative flex-shrink-0"
                title="View sample history"
              >
                <History className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('history') || 'History'}</span>
                {hasNewHistory && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                )}
              </button>
            )}
            
            {/* Route Button - Single button that opens modal */}
            {showRoutingButtons && effectiveHasRouteOption && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  console.log('Route button clicked! Opening modal...');
                  openRouteModal();
                }}
                disabled={isRouting}
                className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
              >
                {isRouting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{t('route') || 'Route'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sample Details Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 mb-2 sm:mb-3">
        <div className={!canEditFeeETA ? "opacity-60" : ""}>
          <label className="block text-xs font-medium text-amber-800 mb-1">
            {t('sampleFee') || 'Sample Fee'}
            {!canEditFeeETA && <span className="text-gray-500 font-normal ml-1 text-[10px] sm:text-xs">({t('manufacturerOnly') || 'Manufacturer only'})</span>}
          </label>
          <div className="relative">
            <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-amber-600" />
            <input
              type="number"
              min="0"
              step="0.01"
              value={localFee}
              onChange={(e) => handleFeeChange(e.target.value)}
              placeholder={isManufacturer ? (t('enterFee') || 'Enter fee') : (t('setByManufacturer') || 'Set by manufacturer')}
              disabled={!canEditFeeETA}
              className="w-full pl-7 pr-2 py-2 sm:py-1.5 text-sm border border-amber-300 rounded bg-white text-gray-900 placeholder-gray-500 disabled:bg-amber-50 disabled:text-gray-500 focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className={!canEditFeeETA ? "opacity-60" : ""}>
          <label className="block text-xs font-medium text-amber-800 mb-1">
            {t('sampleEta') || 'Sample ETA'}
            {!canEditFeeETA && <span className="text-gray-500 font-normal ml-1 text-[10px] sm:text-xs">({t('manufacturerOnly') || 'Manufacturer only'})</span>}
          </label>
          <div className="relative">
            <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-amber-600" />
            <input
              type="date"
              value={localETA}
              onChange={(e) => handleETAChange(e.target.value)}
              disabled={!canEditFeeETA}
              className="w-full pl-7 pr-2 py-2 sm:py-1.5 text-sm border border-amber-300 rounded bg-white text-gray-900 disabled:bg-amber-50 disabled:text-gray-500 focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className={`${!canEdit ? "opacity-60" : ""} sm:col-span-2 lg:col-span-1`}>
          <label className="block text-xs font-medium text-amber-800 mb-1">
            {t('status') || 'Status'}
          </label>
          <select
            value={localStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={!canEdit}
            className="w-full px-2 py-2 sm:py-1.5 text-sm border border-amber-300 rounded bg-white text-gray-900 disabled:bg-amber-50 disabled:text-gray-500 focus:ring-2 focus:ring-amber-500"
          >
            <option value="no_sample">{t('noSample') || 'No Sample'}</option>
            <option value="pending">{t('pending') || 'Pending'}</option>
            <option value="in_production">{t('inProduction') || 'In Production'}</option>
            <option value="ready">{t('ready') || 'Ready'}</option>
            <option value="shipped">{t('shipped') || 'Shipped'}</option>
            <option value="delivered">{t('delivered') || 'Delivered'}</option>
            <option value="sample_approved">{t('sampleApproved') || 'Sample Approved'}</option>
            <option value="rejected">{t('rejected') || 'Rejected'}</option>
          </select>
        </div>
      </div>

      {/* EXISTING NOTES DISPLAY */}
      {existingSampleNotes && existingSampleNotes.trim() && (
        <div className="mb-3 p-3 bg-white rounded-lg border border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-amber-600" />
            <h5 className="text-sm font-medium text-amber-800">{t('previousNotes') || 'Previous Notes'}</h5>
          </div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap bg-amber-50 p-2 rounded border border-amber-100">
            {existingSampleNotes}
          </div>
        </div>
      )}

      {/* ADD NEW NOTE Section */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-amber-800 mb-1">
          {t('addNote') || 'Add Note'}...
          {onViewHistory && !existingSampleNotes && (
            <span className="text-gray-500 font-normal ml-2">({t('viewPreviousNotesInHistory') || 'View previous notes in History'})</span>
          )}
        </label>
        
        <textarea
          value={localNotes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder={t('addNoteSampleRequest') || 'Add a note about the sample request...'}
          rows={2}
          disabled={!canEdit}
          className="w-full px-2 py-1.5 text-sm border border-amber-300 rounded bg-white text-gray-900 font-medium placeholder-gray-500 disabled:bg-amber-50 focus:ring-1 focus:ring-amber-500"
        />
      </div>

      {/* Existing Files */}
      {existingMedia && existingMedia.length > 0 && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-amber-800 mb-1">
            {t('existingSampleFiles') || 'Existing Sample Files'}
          </label>
          <div className="flex flex-wrap gap-1">
            {existingMedia.map((file: any) => (
              <div key={file.id} className="group relative inline-flex">
                <button
                  onClick={() => handleFileClick(file.file_url)}
                  className="px-2 py-1 bg-white border border-amber-300 rounded text-xs text-amber-700 hover:bg-amber-50 hover:border-amber-400 transition-colors flex items-center gap-1"
                  title={file.display_name || file.original_filename || (t('sampleFile') || 'Sample File')}
                >
                  <Paperclip className="w-3 h-3" />
                  <span>{file.display_name || file.original_filename || (t('sampleFile') || 'Sample File')}</span>
                </button>
                {canEdit && onExistingFileDelete && (
                  <button
                    onClick={() => onExistingFileDelete(file.id)}
                    className="absolute -top-1 -right-1 p-0.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                    title={t('deleteFile') || 'Delete file'}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File Upload */}
      {onFileUpload && canEdit && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-amber-800 mb-1">
            {t('uploadNewTechPack') || 'Upload New Technical Pack / Sample Media'}
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="px-3 py-2 sm:py-1.5 bg-amber-600 text-white rounded hover:bg-amber-700 cursor-pointer flex items-center justify-center gap-1.5 text-xs sm:text-sm transition-colors w-full sm:w-auto">
              <Upload className="w-4 h-4 flex-shrink-0" />
              <span>{t('uploadTechPack') || 'Upload Tech Pack'}</span>
              <input
                type="file"
                multiple
                accept={ACCEPTED_FILE_TYPES}
                onChange={(e) => {
                  onFileUpload(e.target.files);
                  setIsDirty(true);
                  if (localStatus === 'no_sample') {
                    setLocalStatus('pending');
                    onUpdate('sampleStatus', 'pending');
                  }
                }}
                className="hidden"
              />
            </label>
            {sampleFiles.length > 0 && (
              <span className="text-xs text-amber-700">
                {sampleFiles.length} {t('newFilesToUpload') || 'new file(s) to upload'}
              </span>
            )}
          </div>

          {sampleFiles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sampleFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-1 bg-amber-100 px-2 py-1.5 rounded text-xs border border-amber-300">
                  <Upload className="w-3 h-3 text-amber-700 flex-shrink-0" />
                  <span className="text-amber-800 truncate max-w-[150px] sm:max-w-none">{file.name}</span>
                  {onFileRemove && (
                    <button
                      onClick={() => {
                        onFileRemove(index);
                        if (sampleFiles.length === 1 && !localNotes) {
                          setIsDirty(false);
                        }
                      }}
                      className="text-red-600 hover:text-red-800 ml-1 flex-shrink-0 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save Button */}
      {showSaveButton && onSave && canEdit && (
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-amber-200">
          <button
            onClick={handleCancel}
            disabled={saving}
            className="px-3 sm:px-4 py-2 sm:py-1.5 text-xs sm:text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {t('cancel') || 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 sm:px-4 py-2 sm:py-1.5 bg-emerald-500 text-white rounded-lg text-xs sm:text-sm hover:bg-emerald-600 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                <span>{t('saving') || 'Saving...'}</span>
              </>
            ) : (
              <>
                <Save className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>{t('saveSampleSection') || 'Save Sample Section'}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ROUTE MODAL - With Ship Option for Manufacturers */}
      {showRouteModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowRouteModal(false);
              setRouteNotes('');
              setRouteDestination(null);
              setTrackingNumber('');
              setShippingCarrier('');
              setShippingNotes('');
              setEstimatedDelivery('');
            }
          }}
        >
          <div className="min-h-screen flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Send className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  {isManufacturer ? (t('updateSampleStatus') || 'Update Sample Status') : (t('routeSample') || 'Route Sample')}
                </h3>
                <button
                  onClick={() => {
                    setShowRouteModal(false);
                    setRouteNotes('');
                    setRouteDestination(null);
                    setTrackingNumber('');
                    setShippingCarrier('');
                    setShippingNotes('');
                    setEstimatedDelivery('');
                  }}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Already shipped warning */}
              {isSampleShipped && (
                <div className="mb-4 p-3 bg-green-50 border border-green-300 rounded-lg">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-green-800 text-sm">Sample Already Shipped</h4>
                      <p className="text-xs text-green-700 mt-1">
                        This sample has been shipped and cannot be re-routed.
                      </p>
                      {existingTrackingNumber && (
                        <p className="text-xs text-green-700 mt-1">
                          <strong>Tracking:</strong> {existingCarrier ? `${existingCarrier} - ` : ''}{existingTrackingNumber}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Route Options */}
              {!isSampleShipped && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {/* MANUFACTURER VIEW: Send to Admin + Ship Sample */}
                  {/* Show for manufacturers when sample is routed to them */}
                  {isManufacturer && sampleRoutedTo === 'manufacturer' && (
                    <>
                      {/* Send to Admin - Always available for manufacturer when sample is with them */}
                      {true && (
                        <button
                          onClick={() => setRouteDestination('admin')}
                          className={`p-3 sm:p-4 rounded-lg border-2 text-left transition-all ${
                            routeDestination === 'admin'
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`p-1.5 rounded-full ${routeDestination === 'admin' ? 'bg-blue-500' : 'bg-gray-200'}`}>
                              <Send className={`w-4 h-4 ${routeDestination === 'admin' ? 'text-white' : 'text-gray-600'}`} />
                            </div>
                            <span className="font-semibold text-sm text-gray-900">{t('sendToAdmin') || 'Send to Admin'}</span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {t('sendQuestionOrUpdate') || 'Send question or update to admin'}
                          </p>
                        </button>
                      )}

                      {/* Ship Sample - Always available for manufacturer when sample is with them */}
                      {true && (
                        <button
                          onClick={() => setRouteDestination('ship')}
                          className={`p-3 sm:p-4 rounded-lg border-2 text-left transition-all ${
                            routeDestination === 'ship'
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`p-1.5 rounded-full ${routeDestination === 'ship' ? 'bg-purple-500' : 'bg-gray-200'}`}>
                              <Truck className={`w-4 h-4 ${routeDestination === 'ship' ? 'text-white' : 'text-gray-600'}`} />
                            </div>
                            <span className="font-semibold text-sm text-gray-900">{t('shipSample') || 'Ship Sample'}</span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {t('sampleCompleteReadyToShip') || 'Sample complete, ready to ship'}
                          </p>
                        </button>
                      )}
                    </>
                  )}

                  {/* ADMIN VIEW: Send to Client, Back to Manufacturer */}
                  {!isManufacturer && (
                    <>
                      {/* Send to Client */}
                      {canRouteToClient && (
                        <button
                          onClick={() => setRouteDestination('client')}
                          className={`p-3 sm:p-4 rounded-lg border-2 text-left transition-all ${
                            routeDestination === 'client'
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`p-1.5 rounded-full ${routeDestination === 'client' ? 'bg-blue-500' : 'bg-gray-200'}`}>
                              <Users className={`w-4 h-4 ${routeDestination === 'client' ? 'text-white' : 'text-gray-600'}`} />
                            </div>
                            <span className="font-semibold text-sm text-gray-900">{t('sendToClient') || 'Send to Client'}</span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {t('sendForClientApproval') || 'Send for client approval'}
                          </p>
                        </button>
                      )}

                      {/* Back to Manufacturer */}
                      {canRouteToManufacturer && (
                        <button
                          onClick={() => setRouteDestination('manufacturer')}
                          className={`p-3 sm:p-4 rounded-lg border-2 text-left transition-all ${
                            routeDestination === 'manufacturer'
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`p-1.5 rounded-full ${routeDestination === 'manufacturer' ? 'bg-indigo-500' : 'bg-gray-200'}`}>
                              <RotateCcw className={`w-4 h-4 ${routeDestination === 'manufacturer' ? 'text-white' : 'text-gray-600'}`} />
                            </div>
                            <span className="font-semibold text-sm text-gray-900">{t('backToManufacturer') || 'Back to Manufacturer'}</span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {t('requestRevisionsFromManufacturer') || 'Request revisions from manufacturer'}
                          </p>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Shipping Fields - Show when "ship" is selected */}
              {routeDestination === 'ship' && (
                <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Package className="w-4 h-4 text-purple-600" />
                    {t('shippingInformation') || 'Shipping Information'}
                  </h4>

                  <div>
                    <label className="block text-xs font-semibold text-gray-800 mb-1">
                      {t('trackingNumberOptional') || 'Tracking Number (optional)'}
                    </label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder={t('enterTrackingNumber') || 'Enter tracking number'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium placeholder-gray-500 focus:ring-2 focus:ring-purple-500 bg-white text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-800 mb-1">
                      {t('shippingCarrierOptional') || 'Shipping Carrier (optional)'}
                    </label>
                    <select
                      value={shippingCarrier}
                      onChange={(e) => setShippingCarrier(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-purple-500 bg-white text-sm"
                    >
                      <option value="">{t('selectCarrier') || 'Select carrier'}</option>
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
                    <label className="block text-xs font-semibold text-gray-800 mb-1">
                      {t('estimatedDeliveryOptional') || 'Estimated Delivery (optional)'}
                    </label>
                    <input
                      type="date"
                      value={estimatedDelivery}
                      onChange={(e) => setEstimatedDelivery(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-purple-500 bg-white text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-800 mb-1">
                      {t('shippingNotesOptional') || 'Shipping Notes (optional)'}
                    </label>
                    <textarea
                      value={shippingNotes}
                      onChange={(e) => setShippingNotes(e.target.value)}
                      placeholder={t('packageDetailsInstructions') || 'Package details, special instructions...'}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium placeholder-gray-500 focus:ring-2 focus:ring-purple-500 bg-white text-sm"
                    />
                  </div>
                </div>
              )}
              
              {/* Routing Notes - Hide when shipping (use shipping notes instead) */}
              {routeDestination !== 'ship' && !isSampleShipped && (
                <div className="mb-4">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    {t('routingNotesOptional') || 'Routing Notes (Optional)'}
                  </label>
                  <textarea
                    value={routeNotes}
                    onChange={(e) => setRouteNotes(e.target.value)}
                    placeholder={t('addAnyNotesOrInstructions') || 'Add any notes or instructions...'}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setShowRouteModal(false);
                    setRouteNotes('');
                    setRouteDestination(null);
                    setTrackingNumber('');
                    setShippingCarrier('');
                    setShippingNotes('');
                    setEstimatedDelivery('');
                  }}
                  disabled={isRouting}
                  className="w-full sm:flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  {t('cancel') || 'Cancel'}
                </button>
                {!isSampleShipped && (
                  <button
                    onClick={handleRoute}
                    disabled={isRouting || !routeDestination}
                    className={`w-full sm:flex-1 px-4 py-2.5 text-white rounded-lg transition-colors disabled:opacity-50 disabled:bg-gray-300 flex items-center justify-center gap-2 text-sm font-medium ${
                      routeDestination === 'ship'
                        ? 'bg-purple-600 hover:bg-purple-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isRouting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {routeDestination === 'ship' ? (t('shipping') || 'Shipping...') : (t('routing') || 'Routing...')}
                      </>
                    ) : (
                      <>
                        {routeDestination === 'ship' ? <Truck className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                        {routeDestination === 'ship' ? (t('shipSample') || 'Ship Sample') : (t('submitRouting') || 'Submit Routing')}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};