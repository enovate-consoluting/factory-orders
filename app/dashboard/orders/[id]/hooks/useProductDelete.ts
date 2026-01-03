/**
 * useProductDelete - Hook for soft-deleting products from orders
 * Handles invoice protection, audit logging, and soft delete
 * Products are marked as deleted but remain in database for recovery
 * Roles: Admin (non-invoiced only), Super Admin (all)
 * Last Modified: January 2026
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface DeleteResult {
  success: boolean;
  error?: string;
}

export function useProductDelete() {
  const [deleting, setDeleting] = useState(false);

  /**
   * Soft delete a product from an order
   * @param productId - The product to delete
   * @param orderId - The order containing the product
   * @param userRole - Current user's role
   * @param deletionReason - Required reason for deletion
   * @param userId - Current user's ID
   * @param userName - Current user's name
   */
  const deleteProduct = async (
    productId: string,
    orderId: string,
    userRole: string,
    deletionReason: string,
    userId?: string,
    userName?: string
  ): Promise<DeleteResult> => {
    setDeleting(true);

    try {
      // Validate deletion reason
      if (!deletionReason || deletionReason.trim() === '') {
        return { success: false, error: 'Deletion reason is required' };
      }

      // 1. Fetch product details for audit log
      const { data: product, error: fetchError } = await supabase
        .from('order_products')
        .select(`
          *,
          order_items(id, variant_combo, quantity, notes),
          order_media(id, original_filename, file_url)
        `)
        .eq('id', productId)
        .is('deleted_at', null)
        .single();

      if (fetchError || !product) {
        console.error('Error fetching product:', fetchError?.message || fetchError || 'No product found');
        console.error('Product ID:', productId);
        return { success: false, error: `Product not found: ${fetchError?.message || 'Unknown error'}` };
      }

      // 2. Check invoice protection
      if (product.invoiced && userRole !== 'super_admin') {
        return {
          success: false,
          error: 'Cannot delete invoiced product. Please void the invoice first or contact a Super Admin.'
        };
      }

      // 3. Calculate totals for audit log
      const totalQuantity = product.order_items?.reduce(
        (sum: number, item: any) => sum + (item.quantity || 0), 0
      ) || 0;
      const mediaCount = product.order_media?.length || 0;

      // 4. HANDLE INVOICE CLEANUP - Remove product from any invoices
      if (product.invoice_id) {
        // Delete invoice_items for this product
        const { error: itemsDeleteError } = await supabase
          .from('invoice_items')
          .delete()
          .eq('order_product_id', productId);

        if (itemsDeleteError) {
          console.warn('Error deleting invoice items:', itemsDeleteError);
        }

        // Recalculate invoice total
        const { data: remainingItems } = await supabase
          .from('invoice_items')
          .select('amount')
          .eq('invoice_id', product.invoice_id);

        const newTotal = (remainingItems || []).reduce(
          (sum: number, item: any) => sum + (parseFloat(item.amount) || 0), 0
        );

        if (remainingItems && remainingItems.length > 0) {
          // Update invoice with new total
          await supabase
            .from('invoices')
            .update({ amount: newTotal })
            .eq('id', product.invoice_id);
        } else {
          // No items left - void the invoice
          await supabase
            .from('invoices')
            .update({
              voided: true,
              voided_at: new Date().toISOString(),
              voided_by: userId,
              voided_reason: `Auto-voided: All products removed (last product: ${product.product_order_number})`
            })
            .eq('id', product.invoice_id);
        }
      }

      // 5. SOFT DELETE - Update the product with deletion metadata and clear invoice flag
      const { error: updateError } = await supabase
        .from('order_products')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: userId || null,
          deleted_by_name: userName || 'Unknown User',
          deletion_reason: deletionReason.trim(),
          invoiced: false,
          invoice_id: null
        })
        .eq('id', productId);

      if (updateError) {
        console.error('Error soft-deleting product:', updateError);
        return { success: false, error: 'Failed to delete product' };
      }

      // 6. Log to audit_log (includes invoice cleanup info)
      const auditEntry = {
        user_id: userId || crypto.randomUUID(),
        user_name: userName || 'Unknown User',
        action_type: 'product_soft_deleted',
        target_type: 'order_product',
        target_id: productId,
        old_value: JSON.stringify({
          order_id: orderId,
          product_order_number: product.product_order_number,
          description: product.description,
          total_quantity: totalQuantity,
          items_count: product.order_items?.length || 0,
          media_count: mediaCount,
          invoiced: product.invoiced,
          invoice_id: product.invoice_id,
          client_product_price: product.client_product_price,
          sample_fee: product.sample_fee,
          product_status: product.product_status,
          routed_to: product.routed_to,
          variants: product.order_items?.map((item: any) => ({
            variant: item.variant_combo,
            quantity: item.quantity
          }))
        }),
        new_value: JSON.stringify({
          deleted_at: new Date().toISOString(),
          deleted_by: userId,
          deleted_by_name: userName,
          deletion_reason: deletionReason.trim(),
          invoice_items_removed: product.invoice_id ? true : false
        }),
        timestamp: new Date().toISOString()
      };

      // Non-blocking audit log
      supabase
        .from('audit_log')
        .insert(auditEntry)
        .then(({ error }) => {
          if (error) console.warn('Audit log error:', error);
        });

      return { success: true };

    } catch (error: any) {
      console.error('Delete product error:', error);
      return { success: false, error: error.message || 'Unknown error' };
    } finally {
      setDeleting(false);
    }
  };

  /**
   * Permanently delete a product (hard delete)
   * Only for super_admin when data needs to be truly removed
   */
  const permanentlyDeleteProduct = async (
    productId: string,
    userId?: string,
    userName?: string
  ): Promise<DeleteResult> => {
    setDeleting(true);

    try {
      // 1. Fetch product details including media
      const { data: product, error: fetchError } = await supabase
        .from('order_products')
        .select(`
          *,
          order_media(id, file_url)
        `)
        .eq('id', productId)
        .single();

      if (fetchError || !product) {
        return { success: false, error: 'Product not found' };
      }

      // 2. Delete media files from storage
      if (product.order_media && product.order_media.length > 0) {
        const filePaths = product.order_media
          .map((m: any) => {
            const url = m.file_url || '';
            const match = url.match(/order-media\/(.+)$/);
            return match ? match[1] : null;
          })
          .filter(Boolean);

        if (filePaths.length > 0) {
          await supabase.storage
            .from('order-media')
            .remove(filePaths);
        }
      }

      // 3. Hard delete the product (cascades to order_items and order_media)
      const { error: deleteError } = await supabase
        .from('order_products')
        .delete()
        .eq('id', productId);

      if (deleteError) {
        console.error('Error permanently deleting product:', deleteError);
        return { success: false, error: 'Failed to permanently delete product' };
      }

      // 4. Log permanent deletion
      supabase
        .from('audit_log')
        .insert({
          user_id: userId || crypto.randomUUID(),
          user_name: userName || 'Unknown User',
          action_type: 'product_permanently_deleted',
          target_type: 'order_product',
          target_id: productId,
          old_value: JSON.stringify({
            product_order_number: product.product_order_number,
            was_soft_deleted: !!product.deleted_at,
            deletion_reason: product.deletion_reason
          }),
          new_value: null,
          timestamp: new Date().toISOString()
        })
        .then(({ error }) => {
          if (error) console.warn('Audit log error:', error);
        });

      return { success: true };

    } catch (error: any) {
      console.error('Permanent delete error:', error);
      return { success: false, error: error.message || 'Unknown error' };
    } finally {
      setDeleting(false);
    }
  };

  /**
   * Restore a soft-deleted product
   */
  const restoreProduct = async (
    productId: string,
    userId?: string,
    userName?: string
  ): Promise<DeleteResult> => {
    setDeleting(true);

    try {
      // Get current product state for audit
      const { data: product } = await supabase
        .from('order_products')
        .select('product_order_number, deleted_at, deleted_by_name, deletion_reason')
        .eq('id', productId)
        .single();

      // Clear deletion fields
      const { error: updateError } = await supabase
        .from('order_products')
        .update({
          deleted_at: null,
          deleted_by: null,
          deleted_by_name: null,
          deletion_reason: null
        })
        .eq('id', productId);

      if (updateError) {
        console.error('Error restoring product:', updateError);
        return { success: false, error: 'Failed to restore product' };
      }

      // Log restoration
      supabase
        .from('audit_log')
        .insert({
          user_id: userId || crypto.randomUUID(),
          user_name: userName || 'Unknown User',
          action_type: 'product_restored',
          target_type: 'order_product',
          target_id: productId,
          old_value: JSON.stringify({
            deleted_at: product?.deleted_at,
            deleted_by_name: product?.deleted_by_name,
            deletion_reason: product?.deletion_reason
          }),
          new_value: JSON.stringify({ restored: true }),
          timestamp: new Date().toISOString()
        })
        .then(({ error }) => {
          if (error) console.warn('Audit log error:', error);
        });

      return { success: true };

    } catch (error: any) {
      console.error('Restore product error:', error);
      return { success: false, error: error.message || 'Unknown error' };
    } finally {
      setDeleting(false);
    }
  };

  return {
    deleteProduct,
    permanentlyDeleteProduct,
    restoreProduct,
    deleting
  };
}
