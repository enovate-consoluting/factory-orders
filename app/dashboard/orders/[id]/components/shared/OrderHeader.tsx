/**
 * OrderHeaderV2 Component - Consolidated Order Header
 * Location: /app/dashboard/orders/[id]/components/shared/OrderHeaderV2.tsx
 * 
 * UPDATED Dec 8, 2025:
 * - COMPACT LAYOUT: Total/Paid moved to Row 1 (next to toggle) - saves vertical space
 * - Row 1: Title + Status + Toggle + Total/Paid
 * - Row 2: Client + Manufacturer cards
 * - Row 3: Actions LEFT (Notes, Print, Add Product) | DIVIDER | Badges + Save & Route RIGHT
 * - Vertical divider line between left and right button groups
 * - Distribution badges on right side near Save & Route
 * - Room to grow when toggle is removed later
 * 
 * Roles: Admin, Super Admin, Manufacturer (limited view)
 * Last Modified: December 8, 2025
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Edit2,
  CheckCircle,
  Building,
  Mail,
  X,
  Check,
  Loader2,
  MessageSquare,
  Printer,
  Plus,
  Save,
  AlertCircle,
  Send
} from 'lucide-react';
import { StatusBadge } from '../../../shared-components/StatusBadge';
import { formatOrderNumber } from '@/lib/utils/orderUtils';
import { formatCurrency } from '../../../utils/orderCalculations';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { useDynamicTranslation } from '@/hooks/useDynamicTranslation';
import { AddProductModal } from '../modals/AddProductModal';

interface ClientNote {
  id: string;
  order_id: string;
  note: string;
  created_by: string;
  created_by_name: string;
  created_by_role: 'client' | 'admin' | 'super_admin';
  created_at: string;
}

interface OrderHeaderV2Props {
  order: any;
  totalAmount?: number;
  userRole: string | null;
  visibleProducts: any[];
  availableClients: any[];
  availableManufacturers: any[];
  language?: 'en' | 'zh';
  setLanguage?: (lang: 'en' | 'zh') => void;
  onEditDraft?: () => void;
  onTogglePaid?: (isPaid: boolean) => void;
  onClientChange?: (clientId: string) => Promise<void>;
  onManufacturerChange?: (manufacturerId: string) => Promise<void>;
  onSaveAndRoute?: () => void;
  onPrintAll?: () => void;
  onRefetch?: () => void;
  sampleNeedsRouting?: boolean;
}

export function OrderHeaderV2({
  order,
  totalAmount = 0,
  userRole,
  visibleProducts,
  availableClients,
  availableManufacturers,
  onEditDraft,
  onTogglePaid,
  onClientChange,
  onManufacturerChange,
  onSaveAndRoute,
  onPrintAll,
  onRefetch,
  sampleNeedsRouting = false
}: OrderHeaderV2Props) {
  const { t } = useTranslation();
  const { translate } = useDynamicTranslation();
  
  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = userRole === 'admin';
  const isManufacturer = userRole === 'manufacturer';
  const isClientRequest = order?.status === 'client_request';

  // Layout toggle removed - V2 is now permanent

  // Client editing state
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [savingClient, setSavingClient] = useState(false);

  // Manufacturer editing state
  const [isEditingManufacturer, setIsEditingManufacturer] = useState(false);
  const [selectedManufacturerId, setSelectedManufacturerId] = useState('');
  const [savingManufacturer, setSavingManufacturer] = useState(false);

  // Notes modal state
  const [notesModal, setNotesModal] = useState(false);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [sendingNote, setSendingNote] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Add Product modal state
  const [addProductModal, setAddProductModal] = useState(false);

  // Calculate product distribution
  const productsWithAdmin = visibleProducts.filter(p => p.routed_to === 'admin').length;
  const productsWithMfr = visibleProducts.filter(p => p.routed_to === 'manufacturer').length;
  const productsWithClient = visibleProducts.filter(p => p.routed_to === 'client').length;

  // Calculate total items that can be routed (products with admin + sample if needs routing)
  const sampleCanRoute = order?.sample_routed_to === 'admin' && (isAdmin || isSuperAdmin);
  const totalRoutableItems = productsWithAdmin + (sampleCanRoute ? 1 : 0);

  // Check warnings
  const productsNeedingPricing = visibleProducts.filter(p =>
    !p.client_product_price || parseFloat(p.client_product_price) === 0
  ).length;

  const productsWithoutShipping = visibleProducts.filter(p =>
    !p.selected_shipping_method && !p.shipping_link_note
  ).length;

  // Get creator name
  const getCreatorName = () => {
    if ((order as any).created_by_user) {
      return (order as any).created_by_user.name || (order as any).created_by_user.email || 'Admin User';
    }
    if ((order as any).creator) {
      return (order as any).creator.name || (order as any).creator.email || 'Admin User';
    }
    return 'Admin';
  };

  // Layout toggle removed - V2 is now permanent

  // Fetch unread notes count
  useEffect(() => {
    if (order?.id && (isAdmin || isSuperAdmin)) {
      fetchUnreadCount();
    }
  }, [order?.id]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (notesModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [notesModal]);

  const fetchUnreadCount = async () => {
    try {
      const { data, error } = await supabase
        .from('client_admin_notes')
        .select('id')
        .eq('order_id', order.id)
        .eq('created_by_role', 'client');

      if (!error && data) {
        setUnreadCount(data.length);
      }
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  };

  const openNotesModal = async () => {
    setNotesModal(true);
    setLoadingNotes(true);

    try {
      const { data, error } = await supabase
        .from('client_admin_notes')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });

      if (!error) {
        setNotes(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleSendNote = async () => {
    if (!newNote.trim() || !order?.id) return;

    setSendingNote(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const role = user.role === 'super_admin' ? 'super_admin' : 'admin';

      const noteData = {
        order_id: order.id,
        note: newNote.trim(),
        created_by: user.id,
        created_by_name: user.name || user.email || 'Admin',
        created_by_role: role,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('client_admin_notes')
        .insert(noteData)
        .select()
        .single();

      if (error) throw error;

      setNotes(prev => [...prev, data]);
      setNewNote('');
    } catch (error) {
      console.error('Error sending note:', error);
      alert('Failed to send note. Please try again.');
    } finally {
      setSendingNote(false);
    }
  };

  const handleClientSave = async () => {
    if (!selectedClientId || !onClientChange) return;
    setSavingClient(true);
    try {
      await onClientChange(selectedClientId);
      setIsEditingClient(false);
    } catch (error) {
      console.error('Error updating client:', error);
    } finally {
      setSavingClient(false);
    }
  };

  const handleManufacturerSave = async () => {
    if (!selectedManufacturerId || !onManufacturerChange) return;
    setSavingManufacturer(true);
    try {
      await onManufacturerChange(selectedManufacturerId);
      setIsEditingManufacturer(false);
    } catch (error) {
      console.error('Error updating manufacturer:', error);
    } finally {
      setSavingManufacturer(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const handleAddProductSuccess = () => {
    if (onRefetch) onRefetch();
    else window.location.reload();
  };

  return (
    <>
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
          
          {/* Row 1: Title + Status + Total/Paid */}
          <div className="flex items-start justify-between gap-3 mb-4">
            {/* Left: Title and meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  {order.order_name ? translate(order.order_name) : `Order ${formatOrderNumber(order.order_number)}`}
                </h1>
                <StatusBadge status={order.status} />
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-sm text-gray-500 flex-wrap">
                <span className="font-medium">#{formatOrderNumber(order.order_number)}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(order.created_at).toLocaleDateString()}
                </span>
                <span>•</span>
                <span>{getCreatorName()}</span>
              </div>
            </div>

            {/* Right: Total/Paid */}
            <div className="flex items-center gap-4 flex-shrink-0">
              {/* Layout toggle removed - V2 is now the default */}

              {/* Total/Paid Box - Moved to Row 1 */}
              {!isManufacturer && (
                <div className="bg-gray-50 rounded-xl px-4 py-2 border border-gray-200 flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total</p>
                    <p className="text-xl font-bold text-gray-900">${formatCurrency(totalAmount)}</p>
                  </div>
                  
                  {/* Paid Toggle */}
                  {(isAdmin || isSuperAdmin) && onTogglePaid && (
                    <button
                      onClick={() => onTogglePaid(!order.is_paid)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        order.is_paid 
                          ? 'bg-green-100 text-green-700 border border-green-200' 
                          : 'bg-white text-gray-500 border border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {order.is_paid ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Paid</span>
                        </>
                      ) : (
                        <span>Mark Paid</span>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Client & Manufacturer Cards (Admin/SuperAdmin only) */}
          {!isManufacturer && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {/* Client Card */}
              <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-xl p-4 border border-blue-100">
                {isEditingClient ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">Select Client</span>
                      <button onClick={() => setIsEditingClient(false)} className="p-1 text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
                      disabled={savingClient}
                    >
                      <option value="">Select...</option>
                      {availableClients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsEditingClient(false)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                        disabled={savingClient}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleClientSave}
                        disabled={!selectedClientId || savingClient}
                        className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {savingClient ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Building className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Client</p>
                      <p className="text-base font-semibold text-gray-900 truncate">{translate(order.client?.name) || '-'}</p>
                      {order.client?.email && (
                        <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3" />
                          {order.client.email}
                        </p>
                      )}
                    </div>
                    {(isAdmin || isSuperAdmin) && (
                      <button
                        onClick={() => {
                          setIsEditingClient(true);
                          setSelectedClientId(order.client?.id || '');
                        }}
                        className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Manufacturer Card */}
              <div className="bg-gradient-to-br from-emerald-50 to-slate-50 rounded-xl p-4 border border-emerald-100">
                {isEditingManufacturer ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">{order.manufacturer_id ? 'Change Manufacturer' : 'Assign Manufacturer'}</span>
                      <button onClick={() => setIsEditingManufacturer(false)} className="p-1 text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <select
                      value={selectedManufacturerId}
                      onChange={(e) => setSelectedManufacturerId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-500"
                      disabled={savingManufacturer}
                    >
                      <option value="">Select...</option>
                      {availableManufacturers.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsEditingManufacturer(false)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                        disabled={savingManufacturer}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleManufacturerSave}
                        disabled={!selectedManufacturerId || savingManufacturer}
                        className="flex-1 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {savingManufacturer ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Save
                      </button>
                    </div>
                    {isClientRequest && selectedManufacturerId && (
                      <p className="text-xs text-amber-600">Order will convert to "Draft" status.</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Building className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Manufacturer</p>
                      <p className="text-base font-semibold text-gray-900 truncate">
                        {order.manufacturer?.name ? translate(order.manufacturer.name) : (
                          <span className="text-amber-600 italic text-sm">Not assigned</span>
                        )}
                      </p>
                      {order.manufacturer?.email && (
                        <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3" />
                          {order.manufacturer.email}
                        </p>
                      )}
                    </div>
                    {(isAdmin || isSuperAdmin) && (
                      <button
                        onClick={() => {
                          setIsEditingManufacturer(true);
                          setSelectedManufacturerId(order.manufacturer?.id || '');
                        }}
                        className="p-2 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Row 3: Action Bar - LEFT: Notes, Print, Add Product | DIVIDER | RIGHT: Badges + Save & Route */}
          {(isAdmin || isSuperAdmin) && (
            <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-200">
              {/* LEFT SIDE: Notes, Print, Add Product */}
              <div className="flex items-center gap-2">
                {/* Notes Button */}
                <button
                  onClick={openNotesModal}
                  className="relative px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm font-medium border border-gray-200"
                  title="Client Notes"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">Notes</span>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Print Button */}
                {onPrintAll && (
                  <button
                    onClick={onPrintAll}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm font-medium border border-gray-200"
                    title="Print"
                  >
                    <Printer className="w-4 h-4" />
                    <span className="hidden sm:inline">Print</span>
                  </button>
                )}

                {/* Add Product Button */}
                <button
                  onClick={() => setAddProductModal(true)}
                  className="px-3 py-2 text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Product</span>
                </button>
              </div>

              {/* VERTICAL DIVIDER LINE */}
              <div className="hidden sm:block h-8 w-px bg-gray-300"></div>

              {/* RIGHT SIDE: Badges + Edit Draft + Save & Route All */}
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {/* Distribution Badges */}
                {productsWithAdmin > 0 && (
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    {productsWithAdmin} with Admin
                  </span>
                )}
                {productsWithMfr > 0 && (
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                    {productsWithMfr} with Mfr
                  </span>
                )}
                {productsWithClient > 0 && (
                  <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                    {productsWithClient} with Client
                  </span>
                )}
                {productsWithoutShipping > 0 && (
                  <span className="px-2.5 py-1 bg-red-50 text-red-600 text-xs font-medium rounded-full border border-red-200 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {productsWithoutShipping} need shipping
                  </span>
                )}

                {/* Edit Draft Button (if applicable) */}
                {order.status === 'draft' && onEditDraft && (
                  <button
                    onClick={onEditDraft}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium flex items-center gap-1.5 border border-gray-200"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Edit Draft</span>
                  </button>
                )}

                {/* Save & Route All Button */}
                {onSaveAndRoute && totalRoutableItems > 0 && (
                  <button
                    onClick={onSaveAndRoute}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-2 shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save & Route All</span>
                    <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold">
                      {totalRoutableItems}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={addProductModal}
        onClose={() => setAddProductModal(false)}
        orderId={order.id}
        orderNumber={order.order_number}
        onSuccess={handleAddProductSuccess}
      />

      {/* Client Notes Modal */}
      {notesModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">Client Notes</h3>
                  <p className="text-xs text-gray-500">{order.client?.name}</p>
                </div>
              </div>
              <button onClick={() => setNotesModal(false)} className="p-1.5 hover:bg-gray-200 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] bg-gray-50">
              {loadingNotes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              ) : notes.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No notes yet</p>
                </div>
              ) : (
                notes.map((note) => {
                  const isAdminNote = note.created_by_role === 'admin' || note.created_by_role === 'super_admin';
                  return (
                    <div key={note.id} className={`flex ${isAdminNote ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
                        isAdminNote ? 'bg-blue-500 text-white' : 'bg-white border border-gray-200 text-gray-700'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                        <div className={`flex items-center gap-2 mt-1 text-xs ${isAdminNote ? 'text-blue-100' : 'text-gray-400'}`}>
                          <span>{note.created_by_name}</span>
                          <span>•</span>
                          <span>{formatDate(note.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Type a message to the client..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 resize-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendNote();
                    }
                  }}
                />
                <button
                  onClick={handleSendNote}
                  disabled={!newNote.trim() || sendingNote}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {sendingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}