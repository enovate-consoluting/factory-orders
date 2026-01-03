// Complete useOrderData.ts with ALL features restored
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export const useOrderData = (orderId: string) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching order with ID:', orderId);
      
      // First, try to get everything in one query with all relationships
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients(id, name, email),
          manufacturer:manufacturers(id, name, email),
          order_media(*),
          audit_log(*),
          order_products(
            *,
            product:products(*),
            order_items(*),
            order_media(*),
            audit_log(*)
          )
        `)
        .eq('id', orderId)
        .single();
      
      // If the complex query fails, use the fallback approach
      if (orderError) {
        console.log('Complex query failed, using fallback approach:', orderError);
        
        // Get basic order first
        const { data: simpleOrder, error: simpleError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();
        
        if (simpleError) {
          throw simpleError;
        }
        
        // Get all related data in parallel
        const [
          clientData,
          manufacturerData,
          creatorData,
          orderMediaData,
          auditLogData,
          productsData
        ] = await Promise.all([
          // Get client
          simpleOrder?.client_id
            ? supabase.from('clients').select('*').eq('id', simpleOrder.client_id).single()
            : Promise.resolve({ data: null }),
            
          // Get manufacturer
          simpleOrder?.manufacturer_id
            ? supabase.from('manufacturers').select('*').eq('id', simpleOrder.manufacturer_id).single()
            : Promise.resolve({ data: null }),
            
          // Get creator user data
          simpleOrder?.created_by
            ? supabase.from('users').select('id, name, email').eq('id', simpleOrder.created_by).single()
            : Promise.resolve({ data: null }),
            
          // Get order-level media (not product media)
          supabase
            .from('order_media')
            .select('*')
            .eq('order_id', orderId)
            .is('order_product_id', null),
            
          // Get order-level audit log
          supabase
            .from('audit_log')
            .select('*')
            .eq('target_id', orderId)
            .in('target_type', ['order', 'order_sample'])
            .order('timestamp', { ascending: false }),
            
          // Get all products for this order (excluding soft-deleted)
          supabase
            .from('order_products')
            .select('*')
            .eq('order_id', orderId)
            .is('deleted_at', null)
        ]);
        
        // For each product, get ALL its related data
        let productsWithFullDetails = [];
        if (productsData.data && productsData.data.length > 0) {
          productsWithFullDetails = await Promise.all(
            productsData.data.map(async (prod: any) => {
              // Get all related data for each product
              const [
                productDetails,
                orderItems,
                productMedia,
                productAuditLog
              ] = await Promise.all([
                // Get product catalog details if exists
                prod.product_id
                  ? supabase.from('products').select('*').eq('id', prod.product_id).single()
                  : Promise.resolve({ data: null }),
                  
                // Get all order items (variants) for this product
                supabase
                  .from('order_items')
                  .select('*')
                  .eq('order_product_id', prod.id)
                  .order('variant_combo', { ascending: true }),
                  
                // Get all media for this product
                supabase
                  .from('order_media')
                  .select('*')
                  .eq('order_product_id', prod.id),
                  
                // Get audit log for this product
                supabase
                  .from('audit_log')
                  .select('*')
                  .eq('target_id', prod.id)
                  .eq('target_type', 'order_product')
                  .order('timestamp', { ascending: false })
              ]);
              
              return {
                ...prod,
                product: productDetails.data,
                order_items: orderItems.data || [],
                order_media: productMedia.data || [],
                audit_log: productAuditLog.data || []
              };
            })
          );
          
          // Sort products by product_order_number
          productsWithFullDetails.sort((a, b) => {
            if (a.product_order_number && b.product_order_number) {
              return a.product_order_number.localeCompare(b.product_order_number);
            }
            const dateA = new Date(a.created_at || 0).getTime();
            const dateB = new Date(b.created_at || 0).getTime();
            return dateA - dateB;
          });
        }
        
        // Assemble the complete order with all data
        const completeOrder = {
          ...simpleOrder,
          client: clientData.data,
          manufacturer: manufacturerData.data,
          created_by_user: creatorData.data,
          order_products: productsWithFullDetails,
          order_media: orderMediaData.data || [],
          audit_log: auditLogData.data || []
        };
        
        console.log('Order assembled with', productsWithFullDetails.length, 'products');
        setOrder(completeOrder);
        
      } else {
        // Complex query succeeded - just need to enhance it slightly
        console.log('Complex query succeeded');
        
        // Get creator data if needed
        let creatorData = null;
        if (orderData?.created_by) {
          const { data: creator } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('id', orderData.created_by)
            .single();
          creatorData = creator;
        }
        
        // Make sure we have order_media at order level
        if (!orderData.order_media || orderData.order_media.length === 0) {
          const { data: orderMedia } = await supabase
            .from('order_media')
            .select('*')
            .eq('order_id', orderId)
            .is('order_product_id', null);
          orderData.order_media = orderMedia || [];
        }
        
        // Make sure we have audit_log at order level
        if (!orderData.audit_log || orderData.audit_log.length === 0) {
          const { data: auditLog } = await supabase
            .from('audit_log')
            .select('*')
            .eq('target_id', orderId)
            .in('target_type', ['order', 'order_sample'])
            .order('timestamp', { ascending: false });
          orderData.audit_log = auditLog || [];
        }
        
        // Process products if they exist (filter out soft-deleted products)
        let finalProducts = (orderData.order_products || []).filter(
          (p: any) => !p.deleted_at
        );

        if (finalProducts.length > 0) {
          // Make sure each product has its audit log
          finalProducts = await Promise.all(
            finalProducts.map(async (product: any) => {
              // If audit_log is missing, fetch it
              if (!product.audit_log) {
                const { data: productAudit } = await supabase
                  .from('audit_log')
                  .select('*')
                  .eq('target_id', product.id)
                  .eq('target_type', 'order_product')
                  .order('timestamp', { ascending: false });
                
                product.audit_log = productAudit || [];
              }
              
              // Sort order_items by variant_combo for consistency
              if (product.order_items && product.order_items.length > 0) {
                product.order_items.sort((a: any, b: any) => {
                  return (a.variant_combo || '').localeCompare(b.variant_combo || '');
                });
              }
              
              return product;
            })
          );
          
          // Sort products by product_order_number
          finalProducts.sort((a: any, b: any) => {
            if (a.product_order_number && b.product_order_number) {
              return a.product_order_number.localeCompare(b.product_order_number);
            }
            const dateA = new Date(a.created_at || 0).getTime();
            const dateB = new Date(b.created_at || 0).getTime();
            return dateA - dateB;
          });
        }
        
        // Set the final complete order
        const completeOrder = {
          ...orderData,
          created_by_user: creatorData,
          order_products: finalProducts
        };
        
        console.log('Order ready with', finalProducts.length, 'products');
        setOrder(completeOrder);
      }
      
      console.log('Order fetch complete');
      
    } catch (err: any) {
      console.error('Error in fetchOrder:', err);
      setError(err?.message || 'Failed to fetch order');
      
      // Try to at least get basic order info even on error
      try {
        const { data: basicOrder } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();
        
        if (basicOrder) {
          // Try to get creator info
          let creatorData = null;
          if (basicOrder?.created_by) {
            const { data: creator } = await supabase
              .from('users')
              .select('id, name, email')
              .eq('id', basicOrder.created_by)
              .single();
            creatorData = creator;
          }
          
          // Try to get order-level media
          const { data: orderMedia } = await supabase
            .from('order_media')
            .select('*')
            .eq('order_id', orderId)
            .is('order_product_id', null);
          
          // Try to get audit log
          const { data: auditLog } = await supabase
            .from('audit_log')
            .select('*')
            .eq('target_id', orderId)
            .in('target_type', ['order', 'order_sample'])
            .order('timestamp', { ascending: false });
          
          // Try to get products with basic info at least (excluding soft-deleted)
          const { data: products } = await supabase
            .from('order_products')
            .select('*')
            .eq('order_id', orderId)
            .is('deleted_at', null);
          
          setOrder({
            ...basicOrder,
            created_by_user: creatorData,
            order_media: orderMedia || [],
            audit_log: auditLog || [],
            order_products: products || []
          });
        }
      } catch (fallbackError) {
        console.error('Even fallback failed:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    await fetchOrder();
  };

  const updateOrder = async (updates: any) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId);
      
      if (error) throw error;
      
      await refetch();
      return { success: true };
    } catch (err: any) {
      console.error('Update error:', err);
      return { error: err.message };
    }
  };

  return {
    order,
    loading,
    error,
    refetch,
    updateOrder
  };
};

// Helper hook to calculate order total
export const useOrderTotal = (order: any) => {
  if (!order?.order_products) return 0;
  
  return order.order_products.reduce((total: number, product: any) => {
    const productTotal = product.order_items?.reduce((sum: number, item: any) => {
      const price = item.client_price || item.bulk_price || item.standard_price || 0;
      return sum + (price * (item.quantity || 0));
    }, 0) || 0;
    
    return total + productTotal;
  }, 0);
};

// Helper to get user role
export const getUserRole = () => {
  const userData = localStorage.getItem('user');
  if (!userData) return null;
  
  try {
    const user = JSON.parse(userData);
    return user.role;
  } catch {
    return null;
  }
};