// Fixed useOrderData.ts - With consistent product ordering
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
      
      // First, get the order with basic relations
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients(id, name, email),
          manufacturer:manufacturers(id, name, email)
        `)
        .eq('id', orderId)
        .single();
      
      // If there's an error, try a simpler query
      if (orderError) {
        console.log('Complex query failed, trying simple query:', orderError);
        
        // Fallback to simple queries
        const { data: simpleOrder, error: simpleError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();
        
        if (simpleError) {
          throw simpleError;
        }
        
        // Get related data separately
        let clientData = null;
        let manufacturerData = null;
        let creatorData = null;
        
        if (simpleOrder?.client_id) {
          const { data: client } = await supabase
            .from('clients')
            .select('*')
            .eq('id', simpleOrder.client_id)
            .single();
          clientData = client;
        }
        
        if (simpleOrder?.manufacturer_id) {
          const { data: manufacturer } = await supabase
            .from('manufacturers')
            .select('*')
            .eq('id', simpleOrder.manufacturer_id)
            .single();
          manufacturerData = manufacturer;
        }
        
        // GET CREATOR DATA
        if (simpleOrder?.created_by) {
          const { data: creator } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('id', simpleOrder.created_by)
            .single();
          creatorData = creator;
        }
        
        setOrder({
          ...simpleOrder,
          client: clientData,
          manufacturer: manufacturerData,
          created_by_user: creatorData
        });
      } else {
        // Add creator data to successful query too
        let creatorData = null;
        if (orderData?.created_by) {
          const { data: creator } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('id', orderData.created_by)
            .single();
          creatorData = creator;
        }
        
        setOrder({
          ...orderData,
          created_by_user: creatorData
        });
      }
      
      // Now get the order products with all related data
      if (orderData || order) {
        const currentOrderId = orderData?.id || order?.id || orderId;
        
        const { data: productsData, error: productsError } = await supabase
          .from('order_products')
          .select(`
            *,
            product:products(*),
            order_items(*),
            order_media(*)
          `)
          .eq('order_id', currentOrderId);
        
        // If complex query fails, get products simply
        if (productsError) {
          console.log('Complex products query failed, using simple query:', productsError);
          
          const { data: simpleProducts } = await supabase
            .from('order_products')
            .select('*')
            .eq('order_id', currentOrderId);
          
          // For each product, get related data
          const productsWithRelations = await Promise.all(
            (simpleProducts || []).map(async (prod: any) => {
              // Get product details
              const { data: productDetails } = await supabase
                .from('products')
                .select('*')
                .eq('id', prod.product_id)
                .single();
              
              // Get order items - SORT BY variant_combo for consistency
              const { data: items } = await supabase
                .from('order_items')
                .select('*')
                .eq('order_product_id', prod.id)
                .order('variant_combo', { ascending: true });
              
              // Get media
              const { data: media } = await supabase
                .from('order_media')
                .select('*')
                .eq('order_product_id', prod.id);
              
              // Get audit log
              const { data: auditLog } = await supabase
                .from('audit_log')
                .select('*')
                .eq('target_id', prod.id)
                .eq('target_type', 'order_product');
              
              return {
                ...prod,
                product: productDetails,
                order_items: items || [],
                order_media: media || [],
                audit_log: auditLog || []
              };
            })
          );
          
          // SORT PRODUCTS BY product_order_number to maintain consistent order
          const sortedProducts = productsWithRelations.sort((a, b) => {
            // First try to sort by product_order_number (PRD-0001, PRD-0002, etc.)
            if (a.product_order_number && b.product_order_number) {
              return a.product_order_number.localeCompare(b.product_order_number);
            }
            
            // Fallback to created_at if product_order_number is missing
            const dateA = new Date(a.created_at || 0).getTime();
            const dateB = new Date(b.created_at || 0).getTime();
            return dateA - dateB;
          });
          
          setOrder((prevOrder: any) => ({
            ...prevOrder,
            order_products: sortedProducts
          }));
        } else {
          // Fetch audit_log separately for each product
          const productsWithAudit = await Promise.all(
            (productsData || []).map(async (product: any) => {
              // Get audit log for this product
              const { data: auditLog } = await supabase
                .from('audit_log')
                .select('*')
                .eq('target_id', product.id)
                .eq('target_type', 'order_product');

              return {
                ...product,
                audit_log: auditLog || [],
                // Sort order_items within each product for consistency
                order_items: product.order_items?.sort((a: any, b: any) =>
                  (a.variant_combo || '').localeCompare(b.variant_combo || '')
                ) || []
              };
            })
          );

          // SORT PRODUCTS BY product_order_number to maintain consistent order
          const sortedProducts = productsWithAudit?.sort((a, b) => {
            // First try to sort by product_order_number (PRD-0001, PRD-0002, etc.)
            if (a.product_order_number && b.product_order_number) {
              return a.product_order_number.localeCompare(b.product_order_number);
            }

            // Fallback to created_at if product_order_number is missing
            const dateA = new Date(a.created_at || 0).getTime();
            const dateB = new Date(b.created_at || 0).getTime();
            return dateA - dateB;
          }) || [];

          setOrder((prevOrder: any) => ({
            ...prevOrder,
            order_products: sortedProducts
          }));
        }
      }
      
      console.log('Order fetch complete');
      
    } catch (err: any) {
      console.error('Error in fetchOrder:', err);
      setError(err?.message || 'Failed to fetch order');
      
      // Even on error, try to show something
      const { data: basicOrder } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
      
      if (basicOrder) {
        // Try to get creator info even on error
        let creatorData = null;
        if (basicOrder?.created_by) {
          const { data: creator } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('id', basicOrder.created_by)
            .single();
          creatorData = creator;
        }
        
        setOrder({
          ...basicOrder,
          created_by_user: creatorData
        });
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