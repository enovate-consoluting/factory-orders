/**
 * AccessoriesCard - Displays clothing accessories added to an order
 * Collapsible card showing accessory types, quantities, fees
 * Delete functionality restores inventory
 * Roles: Manufacturer, Admin, Super Admin
 * Last Modified: December 2025
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Tag,
  ChevronDown,
  Trash2,
  Loader2,
  Package,
  DollarSign,
  AlertCircle,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface OrderAccessory {
  id: string;
  order_id: string;
  accessory_type_id: string;
  quantity_used: number;
  fee_per_unit: number;
  total_fee: number;
  client_fee_per_unit: number | null;
  client_total_fee: number | null;
  inventory_id: string;
  created_at: string;
  accessory_type?: {
    id: string;
    name: string;
    code: string;
  };
  linked_products?: {
    id: string;
    order_product_id: string;
    order_product?: {
      product_order_number: string;
      description?: string;
    };
  }[];
}

interface AccessoriesCardProps {
  orderId: string;
  userRole: string;
  onUpdate?: () => void;
}

export function AccessoriesCard({ orderId, userRole, onUpdate }: AccessoriesCardProps) {
  const [loading, setLoading] = useState(true);
  const [accessories, setAccessories] = useState<OrderAccessory[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'single' | 'all';
    accessory?: OrderAccessory;
  }>({ isOpen: false, type: 'single' });

  // Can delete: Manufacturer, Admin, Super Admin (not Client)
  const canDelete = ['manufacturer', 'admin', 'super_admin'].includes(userRole);

  useEffect(() => {
    if (orderId) {
      loadAccessories();
    }
  }, [orderId]);

  const loadAccessories = async () => {
    setLoading(true);
    try {
      // Get accessories for this order
      const { data: accessoriesData, error: accError } = await supabase
        .from('order_accessories')
        .select(`
          id,
          order_id,
          accessory_type_id,
          quantity_used,
          fee_per_unit,
          total_fee,
          client_fee_per_unit,
          client_total_fee,
          inventory_id,
          created_at,
          accessory_type:accessory_types(id, name, code)
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (accError) throw accError;

      // Get linked products for each accessory
      const accessoriesWithProducts = await Promise.all(
        (accessoriesData || []).map(async (acc) => {
          const { data: links } = await supabase
            .from('order_accessory_products')
            .select(`
              id,
              order_product_id,
              order_product:order_products(product_order_number, description)
            `)
            .eq('order_accessory_id', acc.id);

          // Fix array issues from Supabase joins
          const fixedLinks = (links || []).map((link: any) => ({
            ...link,
            order_product: Array.isArray(link.order_product) ? link.order_product[0] : link.order_product
          }));

          return {
            ...acc,
            accessory_type: Array.isArray(acc.accessory_type) ? acc.accessory_type[0] : acc.accessory_type,
            linked_products: fixedLinks
          };
        })
      );

      setAccessories(accessoriesWithProducts);
    } catch (error) {
      console.error('Error loading accessories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    setDeletingId('all');
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const totalUnits = accessories.reduce((sum, a) => sum + a.quantity_used, 0);

      // Delete each accessory and restore inventory
      for (const accessory of accessories) {
        // Restore inventory
        const { data: currentInventory } = await supabase
          .from('manufacturer_accessories_inventory')
          .select('quantity_on_hand')
          .eq('id', accessory.inventory_id)
          .single();

        if (currentInventory) {
          const newQty = (currentInventory.quantity_on_hand || 0) + accessory.quantity_used;
          await supabase
            .from('manufacturer_accessories_inventory')
            .update({
              quantity_on_hand: newQty,
              updated_at: new Date().toISOString()
            })
            .eq('id', accessory.inventory_id);
        }

        // Delete linked products
        await supabase
          .from('order_accessory_products')
          .delete()
          .eq('order_accessory_id', accessory.id);

        // Delete accessory
        await supabase
          .from('order_accessories')
          .delete()
          .eq('id', accessory.id);
      }

      // Audit log
      await supabase.from('audit_log').insert({
        user_id: user.id,
        user_name: user.name || user.email || 'Unknown',
        action_type: 'all_accessories_removed',
        target_type: 'order',
        target_id: orderId,
        old_value: `Removed all ${accessories.length} accessories (${totalUnits} units, $${totalFee.toFixed(2)})`,
        timestamp: new Date().toISOString()
      });

      await loadAccessories();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error deleting all accessories:', error);
      alert('Error removing accessories. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDelete = async (accessory: OrderAccessory) => {
    setDeletingId(accessory.id);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      // 1. Restore inventory
      const { data: currentInventory, error: fetchError } = await supabase
        .from('manufacturer_accessories_inventory')
        .select('quantity_on_hand')
        .eq('id', accessory.inventory_id)
        .single();

      if (fetchError) {
        console.error('Error fetching inventory:', fetchError);
      } else if (currentInventory) {
        const newQty = (currentInventory.quantity_on_hand || 0) + accessory.quantity_used;
        
        await supabase
          .from('manufacturer_accessories_inventory')
          .update({
            quantity_on_hand: newQty,
            updated_at: new Date().toISOString()
          })
          .eq('id', accessory.inventory_id);
      }

      // 2. Delete linked products (cascade should handle this, but being explicit)
      await supabase
        .from('order_accessory_products')
        .delete()
        .eq('order_accessory_id', accessory.id);

      // 3. Delete the accessory record
      const { error: deleteError } = await supabase
        .from('order_accessories')
        .delete()
        .eq('id', accessory.id);

      if (deleteError) throw deleteError;

      // 4. Audit log
      await supabase.from('audit_log').insert({
        user_id: user.id,
        user_name: user.name || user.email || 'Unknown',
        action_type: 'accessory_removed',
        target_type: 'order',
        target_id: orderId,
        old_value: `Removed ${accessory.accessory_type?.name} (${accessory.quantity_used} units, $${accessory.total_fee})`,
        timestamp: new Date().toISOString()
      });

      // Reload accessories
      await loadAccessories();
      
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error deleting accessory:', error);
      alert('Error removing accessory. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  // Calculate totals - use client fees for admin/client, manufacturer fees for manufacturer
  const showClientPrices = userRole !== 'manufacturer';
  const totalFee = accessories.reduce((sum, acc) => {
    if (showClientPrices && acc.client_total_fee) {
      return sum + acc.client_total_fee;
    }
    return sum + (acc.total_fee || 0);
  }, 0);
  const totalQty = accessories.reduce((sum, acc) => sum + (acc.quantity_used || 0), 0);
  const accessoryNames = accessories.map(a => a.accessory_type?.name).filter(Boolean).join(', ');
  const totalItems = accessories.length;

  // Don't render if no accessories
  if (!loading && accessories.length === 0) {
    return null;
  }

  return (
    <>
    <div className="space-y-2">
      {/* Section Header */}
      <h2 className="text-sm sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
        <Tag className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
        Accessories
      </h2>
      
      {/* Card */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-300 overflow-hidden">
      {/* Header - Always visible */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3 sm:p-4 cursor-pointer bg-gray-50 border-b-2 border-gray-200"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
            <button className="p-0.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0">
              <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${!isExpanded ? '-rotate-90' : ''}`} />
            </button>
            
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Tag className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm sm:text-base text-gray-900">Clothing Accessories</h3>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  {totalQty.toLocaleString()} units
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 truncate">
                {loading ? 'Loading...' : accessoryNames}
              </p>
            </div>
          </div>
          
          {/* Total Fee Badge */}
          {!loading && totalFee > 0 && (
            <span className="px-2 sm:px-3 py-1 bg-green-100 text-green-700 text-xs sm:text-sm font-bold rounded-full flex-shrink-0">
              ${totalFee.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          )}
          
          {/* Delete All Button */}
          {!loading && canDelete && accessories.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteModal({ isOpen: true, type: 'all' });
              }}
              disabled={deletingId !== null}
              className="p-1.5 sm:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
              title="Remove all accessories (restores to inventory)"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-purple-100">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
            </div>
          ) : (
            <div className="p-4">
              {/* Accessories List */}
              <div className="space-y-3">
                {accessories.map((accessory) => {
                  const isDeleting = deletingId === accessory.id;
                  
                  return (
                    <div
                      key={accessory.id}
                      className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                        isDeleting ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex-1">
                        {/* Accessory Name & Quantity */}
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-gray-900">
                            {accessory.accessory_type?.name || 'Unknown Accessory'}
                          </span>
                          <span className="text-gray-500">×</span>
                          <span className="font-medium text-gray-700">
                            {accessory.quantity_used.toLocaleString()}
                          </span>
                          <span className="text-gray-400">@</span>
                          <span className="text-gray-600">
                            ${(showClientPrices && accessory.client_fee_per_unit 
                              ? accessory.client_fee_per_unit 
                              : accessory.fee_per_unit)?.toFixed(2)}/unit
                          </span>
                          <span className="text-gray-400">=</span>
                          <span className="font-bold text-green-600">
                            ${(showClientPrices && accessory.client_total_fee 
                              ? accessory.client_total_fee 
                              : accessory.total_fee)?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Applied to Products */}
                        {accessory.linked_products && accessory.linked_products.length > 0 && (
                          <div className="flex items-start gap-2 text-xs text-gray-500">
                            <Package className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                            <span>
                              Applied to:{' '}
                              {accessory.linked_products.map((lp, idx) => (
                                <span key={lp.id}>
                                  {idx > 0 && ', '}
                                  <span className="font-medium text-gray-700">
                                    {(lp.order_product as any)?.product_order_number || lp.order_product_id}
                                  </span>
                                </span>
                              ))}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Delete Button */}
                      {canDelete && (
                        <button
                          onClick={() => setDeleteModal({ isOpen: true, type: 'single', accessory })}
                          disabled={isDeleting}
                          className="ml-3 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Remove accessory (restores to inventory)"
                        >
                          {isDeleting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Total Footer */}
              <div className="mt-4 pt-3 border-t border-purple-200 flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Accessories Fee</span>
                <span className="text-lg font-bold text-purple-700">
                  ${totalFee.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {deleteModal.type === 'all' ? 'Remove All Accessories?' : 'Remove Accessory?'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {deleteModal.type === 'all' 
                    ? `This will remove all ${accessories.length} accessories from this order.`
                    : `This will remove "${deleteModal.accessory?.accessory_type?.name}" from this order.`
                  }
                </p>
              </div>
            </div>

            {/* Restore Info */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-6">
              <p className="text-sm text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>
                  {deleteModal.type === 'all'
                    ? `${totalQty.toLocaleString()} units will be restored to inventory.`
                    : `${deleteModal.accessory?.quantity_used.toLocaleString()} units will be restored to inventory.`
                  }
                </span>
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal({ isOpen: false, type: 'single' })}
                disabled={deletingId !== null}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (deleteModal.type === 'all') {
                    await handleDeleteAll();
                  } else if (deleteModal.accessory) {
                    await handleDelete(deleteModal.accessory);
                  }
                  setDeleteModal({ isOpen: false, type: 'single' });
                }}
                disabled={deletingId !== null}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deletingId !== null ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

