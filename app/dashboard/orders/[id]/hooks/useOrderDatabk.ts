// app/dashboard/orders/[id]/hooks/useOrderData.ts

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Order } from '../types/order.types';
import { getUserRole } from './usePermissions';

export function useOrderData(orderId: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const userRole = getUserRole();
      
      // Base query - everyone gets this
      let query = supabase
        .from('orders')
        .select(`
          *,
          client:clients(*),
          manufacturer:manufacturers(*),
          order_products(
            *,
            product:products(*),
            order_items(*),
            order_media(*)
          )
        `)
        .eq('id', orderId);

      // Role-based filtering
      if (userRole === 'manufacturer') {
        // Manufacturers only see orders assigned to them
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        query = query.eq('manufacturer_id', userData.manufacturer_id || userData.id);
      }
      
      if (userRole === 'client') {
        // Clients only see their orders
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        query = query.eq('client_id', userData.client_id || userData.id);
      }

      const { data, error: fetchError } = await query.single();

      if (fetchError) throw fetchError;
      
      // Filter sensitive data based on role
      if (userRole === 'manufacturer') {
        // Remove cost and client pricing from manufacturer view
        if (data?.order_products) {
          data.order_products = data.order_products.map((product: any) => ({
            ...product,
            order_items: product.order_items?.map((item: any) => ({
              ...item,
              cost_price: null,
              client_price: null,
              margin_percentage: null
            }))
          }));
        }
      }
      
      if (userRole === 'client') {
        // Remove cost and internal notes from client view
        if (data?.order_products) {
          data.order_products = data.order_products.map((product: any) => ({
            ...product,
            internal_notes: null,
            order_items: product.order_items?.map((item: any) => ({
              ...item,
              cost_price: null,
              manufacturer_standard_price: null,
              manufacturer_bulk_price: null,
              margin_percentage: null
            }))
          }));
        }
      }

      setOrder(data);
    } catch (err: any) {
      console.error('Error fetching order:', err);
      setError(err.message || 'Failed to fetch order');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  return { order, loading, error, refetch: fetchOrder };
}

// Calculate total amount based on user role
export function useOrderTotal(order: Order | null) {
  const userRole = getUserRole();
  
  if (!order?.order_products) return 0;
  
  let total = 0;
  
  order.order_products.forEach(product => {
    product.order_items?.forEach(item => {
      if (userRole === 'super_admin') {
        // Super admin sees cost
        total += (item.cost_price || 0) * item.quantity;
      } else if (['admin', 'order_approver', 'client'].includes(userRole || '')) {
        // Others see client price
        total += (item.client_price || 0) * item.quantity;
      }
      // Manufacturers don't see totals
    });
  });
  
  return total;
}