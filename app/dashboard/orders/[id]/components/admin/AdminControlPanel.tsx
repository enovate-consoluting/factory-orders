/**
 * AdminControlPanel - Control panel for admin/super admin order actions
 * REDESIGNED: Compact icon-focused buttons, condensed warnings, room for growth
 * Shows order summary, totals, and action buttons
 * Includes Client Notes modal and Add Product modal trigger
 * Roles: Admin, Super Admin
 * Last Modified: December 2025
 */

import React, { useState, useEffect } from 'react';
import { 
  Package, Printer, Save, Send, DollarSign, 
  AlertCircle, Settings, MessageSquare, X, Loader2,
  Plus, FileText, Truck
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
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

interface AdminControlPanelProps {
  order: any;
  visibleProducts: any[];
  onSaveAndRoute: () => void;
  onPrintAll: () => void;
  totalAmount?: number;
}

export function AdminControlPanel({ 
  order, 
  visibleProducts,
  onSaveAndRoute,
  onPrintAll,
  totalAmount = 0
}: AdminControlPanelProps) {
  const { t } = useTranslation();
  
  // Notes Modal State
  const [notesModal, setNotesModal] = useState(false);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [sendingNote, setSendingNote] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Totals for sample and accessories
  const [accessoriesTotal, setAccessoriesTotal] = useState(0);

  // Add Product Modal State
  const [addProductModal, setAddProductModal] = useState(false);

  // Calculate product distribution
  const productCounts = {
    withAdmin: visibleProducts.filter(p => p.routed_to === 'admin').length,
    withManufacturer: visibleProducts.filter(p => p.routed_to === 'manufacturer').length,
    withClient: visibleProducts.filter(p => p.routed_to === 'client').length,
    total: visibleProducts.length
  };

  // Calculate totals using CLIENT prices
  const calculateTotals = () => {
    let productTotal = 0;
    let shippingTotal = 0;

    visibleProducts.forEach((product: any) => {
      const totalQty = product.order_items?.reduce((sum: number, item: any) =>
        sum + (item.quantity || 0), 0) || 0;

      productTotal += (parseFloat(product.client_product_price || 0) * totalQty);

      if (product.selected_shipping_method === 'air') {
        shippingTotal += parseFloat(product.client_shipping_air_price || 0);
      } else if (product.selected_shipping_method === 'boat') {
        shippingTotal += parseFloat(product.client_shipping_boat_price || 0);
      }
    });

    // Get sample fee from ORDER level (use client_sample_fee if available)
    const sampleTotal = parseFloat(order?.client_sample_fee || order?.sample_fee || 0);

    return {
      product: productTotal,
      shipping: shippingTotal,
      sample: sampleTotal,
      total: productTotal + shippingTotal + sampleTotal
    };
  };

  const totals = calculateTotals();

  // Check if any products need attention
  const productsNeedingPricing = visibleProducts.filter(p =>
    !p.client_product_price || parseFloat(p.client_product_price) === 0
  ).length;

  const productsWithoutShipping = visibleProducts.filter(p =>
    !p.selected_shipping_method && !p.shipping_link_note
  ).length;

  const hasWarnings = productsNeedingPricing > 0 || productsWithoutShipping > 0;

  // Fetch unread count on mount
  useEffect(() => {
    if (order?.id) {
      fetchUnreadCount();
    }
  }, [order?.id]);

  // Fetch accessories total for this order (using CLIENT fees)
  useEffect(() => {
    const fetchAccessoriesTotal = async () => {
      if (!order?.id) return;
      try {
        const { data, error } = await supabase
          .from('order_accessories')
          .select('client_total_fee, total_fee')
          .eq('order_id', order.id);
        
        if (!error && data) {
          // Use client_total_fee if available, otherwise fall back to total_fee
          const total = data.reduce((sum: number, acc: any) => 
            sum + parseFloat(acc.client_total_fee || acc.total_fee || 0), 0);
          setAccessoriesTotal(total);
        }
      } catch (err) {
        console.error('Error fetching accessories total:', err);
      }
    };
    fetchAccessoriesTotal();
  }, [order?.id]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (notesModal) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
      document.documentElement.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
      document.documentElement.style.overflow = "auto";
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
      
      if (error) {
        console.error('Error fetching notes:', error);
      } else {
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
    // Trigger page refresh to show new product
    window.location.reload();
  };

  return (
    <>
      <div className="mb-3 bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        {/* Compact Header */}
        <div className="px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-white/80" />
            <span className="text-sm font-medium text-white">{t('controlPanel')}</span>
          </div>
          {/* Quick Stats in Header */}
          <div className="flex items-center gap-3 text-xs text-blue-100">
            <span>{order.order_number}</span>
            <span>•</span>
            <span>{visibleProducts.length} products</span>
          </div>
        </div>

        <div className="p-3">
          {/* Top Row: Client + Distribution + Total */}
          <div className="flex items-center justify-between gap-3 mb-3">
            {/* Client & Distribution */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-gray-900">{order.client?.name}</span>
              
              {/* Compact Distribution Badges */}
              <div className="flex items-center gap-1">
                {productCounts.withAdmin > 0 && (
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                    {productCounts.withAdmin} Admin
                  </span>
                )}
                {productCounts.withManufacturer > 0 && (
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                    {productCounts.withManufacturer} Mfr
                  </span>
                )}
                {productCounts.withClient > 0 && (
                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                    {productCounts.withClient} Client
                  </span>
                )}
              </div>
            </div>

            {/* Total */}
            <div className="text-right">
              <p className="text-lg font-bold text-green-600">
                ${(totals.total + accessoriesTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <div className="text-xs text-gray-500 space-x-2">
                {totals.sample > 0 && (
                  <span className="text-amber-600">Sample: ${totals.sample.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                )}
                {accessoriesTotal > 0 && (
                  <span className="text-purple-600">Acc: ${accessoriesTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                )}
                {totals.shipping > 0 && (
                  <span>Ship: ${totals.shipping.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                )}
              </div>
            </div>
          </div>

          {/* Compact Warning Bar */}
          {hasWarnings && (
            <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span>
                {productsNeedingPricing > 0 && `${productsNeedingPricing} need pricing`}
                {productsNeedingPricing > 0 && productsWithoutShipping > 0 && ' • '}
                {productsWithoutShipping > 0 && `${productsWithoutShipping} need shipping`}
              </span>
            </div>
          )}

          {/* Action Buttons - Redesigned */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Notes Button */}
            <button
              onClick={openNotesModal}
              className="relative flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              title="Client Notes"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Notes</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Print Button */}
            <button
              onClick={onPrintAll}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              title="Print All"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>

            {/* Add Product Button */}
            <button
              onClick={() => setAddProductModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium"
              title="Add Product"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Product</span>
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Save All & Route - Primary Action */}
            {productCounts.withAdmin > 0 && (
              <button
                onClick={onSaveAndRoute}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>Save & Route</span>
                <span className="px-1.5 py-0.5 bg-green-500 rounded text-xs">
                  {productCounts.withAdmin}
                </span>
              </button>
            )}
          </div>
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-hidden">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl flex flex-col my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{t('clientNotes')}</h3>
                  <p className="text-sm text-gray-500">{order.client?.name} - {order.order_number}</p>
                </div>
              </div>
              <button
                onClick={() => setNotesModal(false)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {/* Notes History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[400px] bg-gray-50">
              {loadingNotes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              ) : notes.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">{t('noNotesYet')}</p>
                  <p className="text-gray-400 text-xs mt-1">{t('startConversationWithClient')}</p>
                </div>
              ) : (
                notes.map((note) => {
                  const isAdmin = note.created_by_role === 'admin' || note.created_by_role === 'super_admin';
                  return (
                    <div 
                      key={note.id}
                      className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
                        isAdmin 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-white border border-gray-200 text-gray-700'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                        <div className={`flex items-center gap-2 mt-1.5 text-xs ${
                          isAdmin ? 'text-blue-100' : 'text-gray-400'
                        }`}>
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
            
            {/* New Note Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder={t('typeMessageToClient')}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 self-end"
                >
                  {sendingNote ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">{t('pressEnterToSend')}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}