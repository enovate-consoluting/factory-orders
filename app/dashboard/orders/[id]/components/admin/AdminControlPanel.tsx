/**
 * AdminControlPanel - Control panel for admin/super admin order actions
 * Shows order summary, totals, and action buttons (Print, Save All & Route, Client Notes)
 * Includes Client Notes modal for admin-client communication
 * Roles: Admin, Super Admin
 * Last Modified: November 30, 2025
 */

import React, { useState, useEffect } from 'react';
import { 
  Package, Printer, Save, Send, DollarSign, 
  AlertCircle, Settings, MessageSquare, X, Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

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
  // Notes Modal State
  const [notesModal, setNotesModal] = useState(false);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [sendingNote, setSendingNote] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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
      
      // Use CLIENT prices
      productTotal += (parseFloat(product.client_product_price || 0) * totalQty);
      
      if (product.selected_shipping_method === 'air') {
        shippingTotal += parseFloat(product.client_shipping_air_price || 0);
      } else if (product.selected_shipping_method === 'boat') {
        shippingTotal += parseFloat(product.client_shipping_boat_price || 0);
      }
    });
    
    return {
      product: productTotal,
      shipping: shippingTotal,
      total: productTotal + shippingTotal
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

  // Fetch unread count on mount
  useEffect(() => {
    if (order?.id) {
      fetchUnreadCount();
    }
  }, [order?.id]);

  const fetchUnreadCount = async () => {
    try {
      const { data, error } = await supabase
        .from('client_admin_notes')
        .select('id')
        .eq('order_id', order.id)
        .eq('created_by_role', 'client');
      
      if (!error && data) {
        // For now, show count of client messages (could enhance with read tracking later)
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

  return (
    <>
      <div className="mb-4 bg-white rounded-lg shadow-lg border border-gray-300 overflow-hidden">
        {/* Header Row - Control Panel Title and Order Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {/* Control Panel Header */}
          <div className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2">
            <Settings className="w-4 h-4 text-white flex-shrink-0" />
            <h3 className="text-sm font-semibold text-white">Control Panel</h3>
          </div>

          {/* Order Info Summary */}
          <div className="px-4 py-2 bg-gray-50 flex flex-wrap items-center gap-3 sm:gap-4">
            <div>
              <span className="text-xs text-gray-500">Order</span>
              <p className="font-bold text-sm sm:text-base text-gray-900">{order.order_number}</p>
            </div>
            <div className="hidden sm:block h-8 w-px bg-gray-300" />
            <div>
              <span className="text-xs text-gray-500">Client</span>
              <p className="font-semibold text-xs sm:text-sm text-gray-900 truncate max-w-[150px]">{order.client?.name}</p>
            </div>
            <div className="hidden sm:block h-8 w-px bg-gray-300" />
            <div>
              <span className="text-xs text-gray-500">Products</span>
              <p className="font-semibold text-sm text-gray-900">{visibleProducts.length}</p>
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-4">
          {/* Product Distribution and Totals */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4 mb-4">
            {/* Product Distribution */}
            {productCounts.total > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {productCounts.withAdmin > 0 && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded whitespace-nowrap">
                    {productCounts.withAdmin} with Admin
                  </span>
                )}
                {productCounts.withManufacturer > 0 && (
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded whitespace-nowrap">
                    {productCounts.withManufacturer} with Mfr
                  </span>
                )}
                {productCounts.withClient > 0 && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded whitespace-nowrap">
                    {productCounts.withClient} with Client
                  </span>
                )}
              </div>
            )}

            {/* Totals */}
            <div className="flex items-center gap-3 sm:gap-4 justify-end sm:justify-start lg:justify-end">
              {totals.shipping > 0 && (
                <div className="text-right">
                  <span className="text-xs text-gray-500">Shipping</span>
                  <p className="font-semibold text-sm sm:text-base text-blue-600">${totals.shipping.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
              )}
              <div className="text-right">
                <span className="text-xs text-gray-500">Client Total</span>
                <p className="font-bold text-lg sm:text-xl text-green-600">${totals.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>

          {/* Warnings Row */}
          {(productsNeedingPricing > 0 || productsWithoutShipping > 0) && (
            <div className="flex flex-wrap gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
              <div className="flex-1 text-sm text-amber-800">
                {productsNeedingPricing > 0 && (
                  <span>{productsNeedingPricing} product{productsNeedingPricing > 1 ? 's' : ''} need pricing. </span>
                )}
                {productsWithoutShipping > 0 && (
                  <span>{productsWithoutShipping} product{productsWithoutShipping > 1 ? 's' : ''} need shipping selection.</span>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons Row */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 pt-3 border-t">
            {/* Print All */}
            <button
              onClick={onPrintAll}
              className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium text-sm sm:text-base"
            >
              <Printer className="w-4 h-4" />
              <span>Print All</span>
            </button>

            {/* Client Notes */}
            <button
              onClick={openNotesModal}
              className="px-3 sm:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 font-medium relative text-sm sm:text-base"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Client Notes</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Save All & Route - Only show if there are products with admin */}
            {productCounts.withAdmin > 0 && (
              <button
                onClick={onSaveAndRoute}
                className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-medium sm:ml-auto text-sm sm:text-base"
              >
                <Save className="w-4 h-4" />
                <span className="whitespace-nowrap">Save All & Route ({productCounts.withAdmin})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Client Notes Modal */}
      {notesModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Client Notes</h3>
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
                  <p className="text-gray-500 text-sm">No notes yet</p>
                  <p className="text-gray-400 text-xs mt-1">Start a conversation with the client</p>
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
                  placeholder="Type your message to the client..."
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
              <p className="text-xs text-gray-400 mt-2">Press Enter to send, Shift+Enter for new line</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}