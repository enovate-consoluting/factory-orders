/**
 * useInvoiceCheck Hook
 * Checks for existing invoices on an order before creating a new one
 * Returns invoice status and helper functions
 * Last Modified: December 1, 2025
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface ExistingInvoice {
  id: string;
  invoice_number: string;
  amount: number;
  status: string;
  created_at: string;
  sent_at?: string;
  voided: boolean;
  void_reason?: string;
}

interface InvoiceCheckResult {
  hasExistingInvoices: boolean;
  existingInvoices: ExistingInvoice[];
  uninvoicedProductCount: number;
  totalProductCount: number;
  allProductsInvoiced: boolean;
}

export function useInvoiceCheck() {
  const [loading, setLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<InvoiceCheckResult | null>(null);

  const checkExistingInvoices = useCallback(async (orderId: string): Promise<InvoiceCheckResult> => {
    setLoading(true);
    
    try {
      // 1. Get all invoices for this order (including voided for history)
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('id, invoice_number, amount, status, created_at, sent_at, voided, void_reason')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (invoicesError) {
        console.error('Error fetching invoices:', invoicesError);
        throw invoicesError;
      }

      // 2. Get all products for this order and their invoice status
      const { data: products, error: productsError } = await supabase
        .from('order_products')
        .select('id, invoiced, invoice_id')
        .eq('order_id', orderId);

      if (productsError) {
        console.error('Error fetching products:', productsError);
        throw productsError;
      }

      const totalProductCount = products?.length || 0;
      const invoicedProducts = products?.filter(p => p.invoiced) || [];
      const uninvoicedProductCount = totalProductCount - invoicedProducts.length;

      // Filter to only non-voided invoices for "has existing" check
      const activeInvoices = invoices?.filter(inv => !inv.voided) || [];

      const result: InvoiceCheckResult = {
        hasExistingInvoices: activeInvoices.length > 0,
        existingInvoices: invoices || [],
        uninvoicedProductCount,
        totalProductCount,
        allProductsInvoiced: uninvoicedProductCount === 0
      };

      setCheckResult(result);
      return result;

    } catch (error) {
      console.error('Error checking invoices:', error);
      // Return safe defaults on error
      return {
        hasExistingInvoices: false,
        existingInvoices: [],
        uninvoicedProductCount: 0,
        totalProductCount: 0,
        allProductsInvoiced: false
      };
    } finally {
      setLoading(false);
    }
  }, []);

  const markProductsAsInvoiced = useCallback(async (
    productIds: string[], 
    invoiceId: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('order_products')
        .update({
          invoiced: true,
          invoiced_at: new Date().toISOString(),
          invoice_id: invoiceId
        })
        .in('id', productIds);

      if (error) {
        console.error('Error marking products as invoiced:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in markProductsAsInvoiced:', error);
      return false;
    }
  }, []);

  const clearCheck = useCallback(() => {
    setCheckResult(null);
  }, []);

  return {
    loading,
    checkResult,
    checkExistingInvoices,
    markProductsAsInvoiced,
    clearCheck
  };
}
