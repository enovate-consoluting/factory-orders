/**
 * useProductDelete - Hook for deleting products from orders
 * Handles invoice protection, audit logging, and cascade deletes
 * Roles: Admin (non-invoiced only), Super Admin (all)
 * Last Modified: December 2025
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface DeleteResult {
  success: boolean;
  error?: string;
}

export function useProductDelete() {
  const [deleting, setDeleting] = useState(false);

  const deleteProduct = async (
    productId: string,
    orderId: string,
    userRole: string,
    userId?: string,
    userName?: string
  ): Promise<DeleteResult> => {
    setDeleting(true);
    
    try {
      // 1. Fetch product details for audit log
      const { data: product, error: fetchError } = await supabase
        .from('order_products')
        .select(`
          *,
          order_items(id, variant_combo, quantity, notes),
          order_media(id, original_filename, file_url)
        `)
        .eq('id', productId)
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

      // 4. Delete media files from storage first
      if (product.order_media && product.order_media.length > 0) {
        const filePaths = product.order_media
          .map((m: any) => {
            // Extract path from URL - format: orderId/productId/filename
            const url = m.file_url || '';
            const match = url.match(/order-media\/(.+)$/);
            return match ? match[1] : null;
          })
          .filter(Boolean);

        if (filePaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('order-media')
            .remove(filePaths);
          
          if (storageError) {
            console.warn('Error deleting storage files:', storageError);
            // Continue anyway - DB cleanup is more important
          }
        }
      }

      // 5. Delete the product (cascades to order_items and order_media via DB)
      const { error: deleteError } = await supabase
        .from('order_products')
        .delete()
        .eq('id', productId);

      if (deleteError) {
        console.error('Error deleting product:', deleteError);
        return { success: false, error: 'Failed to delete product' };
      }

      // 6. Log to audit_log
      const auditEntry = {
        user_id: userId || crypto.randomUUID(),
        user_name: userName || 'Unknown User',
        action_type: 'product_deleted',
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
        new_value: null,
        timestamp: new Date().toISOString()
      };

      // Non-blocking audit log
      supabase
        .from('audit_log')
        .insert(auditEntry)
        .then(({ error }) => {
          if (error) console.warn('Audit log error:', error);
        });

      // 7. If product was invoiced, log a warning notification
      if (product.invoiced && product.invoice_id) {
        console.warn(
          `WARNING: Deleted invoiced product ${product.product_order_number}. ` +
          `Invoice ID: ${product.invoice_id} may need to be voided/updated.`
        );
        
        // Optionally create a notification for admins
        supabase
          .from('notifications')
          .insert({
            user_id: userId,
            message: `Product ${product.product_order_number} was deleted but had an existing invoice. Review invoice ${product.invoice_id}.`,
            type: 'warning',
            link: `/dashboard/invoices`,
            is_read: false
          })
          .then(({ error }) => {
            if (error) console.warn('Notification error:', error);
          });
      }

      return { success: true };
      
    } catch (error: any) {
      console.error('Delete product error:', error);
      return { success: false, error: error.message || 'Unknown error' };
    } finally {
      setDeleting(false);
    }
  };

  return { deleteProduct, deleting };
}