'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function MarginDiagnosticPage() {
  const [diagnosticData, setDiagnosticData] = useState<any>({
    orders: [],
    orderMargins: [],
    systemConfig: [],
    orderProducts: [],
    environment: '',
    errors: []
  });
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState(false);
  const [fixResults, setFixResults] = useState<any>(null);

  useEffect(() => {
    // Check auth
    const userData = localStorage.getItem('user');
    if (!userData) {
      window.location.href = '/';
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== 'super_admin') {
      window.location.href = '/dashboard';
      return;
    }
    
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    const results: any = {
      orders: [],
      orderMargins: [],
      systemConfig: [],
      orderProducts: [],
      environment: window.location.hostname,
      errors: [],
      timestamp: new Date().toISOString()
    };

    try {
      // 1. Check system_config table for default margins
      console.log('Checking system_config...');
      const { data: configData, error: configError } = await supabase
        .from('system_config')
        .select('*')
        .in('config_key', ['default_margin_percentage', 'default_shipping_margin_percentage']);
      
      if (configError) {
        results.errors.push(`system_config error: ${configError.message}`);
      } else {
        results.systemConfig = configData || [];
      }

      // 2. Check order_margins table
      console.log('Checking order_margins table...');
      const { data: marginData, error: marginError } = await supabase
        .from('order_margins')
        .select('*')
        .limit(10);
      
      if (marginError) {
        results.errors.push(`order_margins error: ${marginError.message}`);
      } else {
        results.orderMargins = marginData || [];
      }

      // 3. Check recent orders with products
      console.log('Checking recent orders with products...');
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_name,
          status,
          created_at,
          client:clients(id, name),
          order_products(
            id,
            product_order_number,
            product_price,
            client_product_price,
            product_margin_override,
            shipping_margin_override,
            margin_applied,
            shipping_air_price,
            client_shipping_air_price,
            shipping_boat_price,
            client_shipping_boat_price
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (orderError) {
        results.errors.push(`orders error: ${orderError.message}`);
      } else {
        results.orders = orderData || [];
      }

      // 4. Check order_products directly for margin fields
      console.log('Checking order_products directly...');
      const { data: productData, error: productError } = await supabase
        .from('order_products')
        .select('id, product_order_number, product_price, client_product_price, product_margin_override, margin_applied')
        .not('product_price', 'is', null)
        .limit(10);
      
      if (productError) {
        results.errors.push(`order_products error: ${productError.message}`);
      } else {
        results.orderProducts = productData || [];
      }

    } catch (error) {
      results.errors.push(`General error: ${error}`);
    }

    setDiagnosticData(results);
    setLoading(false);
    
    // Log to console for debugging
    console.log('=== MARGIN DIAGNOSTIC RESULTS ===');
    console.log('Environment:', results.environment);
    console.log('System Config:', results.systemConfig);
    console.log('Order Margins:', results.orderMargins);
    console.log('Recent Orders:', results.orders);
    console.log('Direct Products:', results.orderProducts);
    console.log('Errors:', results.errors);
    console.log('================================');
  };

  const runFix = async () => {
    setFixing(true);
    const results: any = {
      systemConfigFixed: false,
      productsFixed: 0,
      marginsCreated: 0,
      errors: []
    };

    try {
      // 1. Ensure system_config has defaults
      const { data: configCheck } = await supabase
        .from('system_config')
        .select('*')
        .in('config_key', ['default_margin_percentage', 'default_shipping_margin_percentage']);
      
      if (!configCheck || configCheck.length < 2) {  // Changed to check for both configs
        await supabase.from('system_config').upsert([
          {
            config_key: 'default_margin_percentage',
            config_value: '80',
            updated_at: new Date().toISOString()
          },
          {
            config_key: 'default_shipping_margin_percentage', 
            config_value: '0',
            updated_at: new Date().toISOString()
          }
        ], { onConflict: 'config_key' });
        results.systemConfigFixed = true;
      }

      // 2. Get products needing client price calculation
      const { data: products } = await supabase
        .from('order_products')
        .select('*')
        .not('product_price', 'is', null)
        .is('client_product_price', null);

      // 3. Get order margins
      const { data: orderMargins } = await supabase
        .from('order_margins')
        .select('order_id, margin_percentage, shipping_margin_percentage');
      
      const marginMap = new Map();
      orderMargins?.forEach(m => {
        marginMap.set(m.order_id, {
          product: m.margin_percentage || 80,
          shipping: m.shipping_margin_percentage || 0
        });
      });

      // 4. Fix each product
      for (const product of products || []) {
        const orderMargin = marginMap.get(product.order_id) || { product: 80, shipping: 0 };
        const productMargin = product.product_margin_override || orderMargin.product;
        
        const clientProductPrice = product.product_price * (1 + productMargin / 100);
        const clientShippingAir = product.shipping_air_price 
          ? product.shipping_air_price * (1 + orderMargin.shipping / 100)
          : null;
        const clientShippingBoat = product.shipping_boat_price
          ? product.shipping_boat_price * (1 + orderMargin.shipping / 100)
          : null;

        const { error } = await supabase
          .from('order_products')
          .update({
            client_product_price: clientProductPrice,
            client_shipping_air_price: clientShippingAir,
            client_shipping_boat_price: clientShippingBoat,
            margin_applied: productMargin
          })
          .eq('id', product.id);

        if (!error) {
          results.productsFixed++;
        }
      }

      // 5. Create missing order_margins
      const { data: allOrders } = await supabase
        .from('orders')
        .select('id');
      
      for (const order of allOrders || []) {
        if (!marginMap.has(order.id)) {
          await supabase.from('order_margins').insert({
            order_id: order.id,
            margin_percentage: 80,
            shipping_margin_percentage: 0,
            updated_at: new Date().toISOString()
          });
          results.marginsCreated++;
        }
      }

    } catch (error: any) {
      results.errors.push(error.message);
    }

    setFixResults(results);
    setFixing(false);
    await runDiagnostics(); // Refresh diagnostic
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4">Running diagnostics...</p>
        </div>
      </div>
    );
  }

  const issuesFound = diagnosticData.systemConfig.length === 0 || 
                      diagnosticData.orderProducts.some((p: any) => p.product_price && !p.client_product_price);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Margin System Diagnostic</h1>
        <Link href="/dashboard/settings/finance/orders" className="text-blue-600 hover:text-blue-800">
          ← Back to Order Margins
        </Link>
      </div>
      
      {/* Environment Info */}
      <div className="bg-gray-100 p-4 rounded mb-6">
        <h2 className="font-bold text-lg mb-2">Environment</h2>
        <p>URL: {diagnosticData.environment}</p>
        <p>Time: {diagnosticData.timestamp}</p>
        <p className={`font-semibold ${diagnosticData.environment.includes('localhost') ? 'text-green-600' : 'text-blue-600'}`}>
          Running on: {diagnosticData.environment.includes('localhost') ? 'LOCAL' : 'PRODUCTION'}
        </p>
      </div>

      {/* ALWAYS SHOW FIX BUTTON - Modified this section */}
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded mb-6">
        <h2 className="font-bold text-lg mb-2 text-yellow-800">
          {issuesFound ? 'Issues Detected' : 'System Check'}
        </h2>
        <p className="mb-4">
          {issuesFound 
            ? 'The diagnostic found issues that may be causing margin calculation problems.'
            : 'No issues detected, but you can run the fix to ensure everything is configured correctly.'}
        </p>
        <div className="flex gap-4">
          <button
            onClick={runFix}
            disabled={fixing}
            className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 disabled:bg-gray-400"
          >
            {fixing ? 'Fixing...' : 'Run Automatic Fix'}
          </button>
          <button
            onClick={runDiagnostics}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            Re-run Diagnostic
          </button>
        </div>
      </div>

      {/* Fix Results */}
      {fixResults && (
        <div className="bg-green-50 border border-green-200 p-4 rounded mb-6">
          <h2 className="font-bold text-lg mb-2 text-green-800">Fix Results</h2>
          <ul className="space-y-1">
            {fixResults.systemConfigFixed && <li>✅ System config defaults created</li>}
            <li>✅ Fixed {fixResults.productsFixed} products with missing client prices</li>
            <li>✅ Created {fixResults.marginsCreated} missing order margin records</li>
          </ul>
          {fixResults.errors.length > 0 && (
            <div className="mt-2 text-red-600">
              Errors: {fixResults.errors.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Errors */}
      {diagnosticData.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 p-4 rounded mb-6">
          <h2 className="font-bold text-lg mb-2 text-red-800">Errors Found</h2>
          <ul className="list-disc ml-5">
            {diagnosticData.errors.map((error: string, idx: number) => (
              <li key={idx} className="text-red-700">{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* System Config */}
      <div className="bg-white border rounded p-4 mb-6">
        <h2 className="font-bold text-lg mb-3">System Configuration</h2>
        {diagnosticData.systemConfig.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Config Key</th>
                <th className="text-left p-2">Value</th>
              </tr>
            </thead>
            <tbody>
              {diagnosticData.systemConfig.map((config: any) => (
                <tr key={config.config_key} className="border-b">
                  <td className="p-2">{config.config_key}</td>
                  <td className="p-2 font-mono">{config.config_value}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-red-600">⚠️ No system config found - this is causing the issue!</p>
        )}
      </div>

      {/* Recent Orders with Products */}
      <div className="bg-white border rounded p-4 mb-6">
        <h2 className="font-bold text-lg mb-3">Recent Orders - Price Check</h2>
        {diagnosticData.orders.map((order: any) => (
          <div key={order.id} className="mb-4 p-3 bg-gray-50 rounded">
            <div className="font-semibold mb-2">
              Order: {order.order_number} 
              {order.client?.name && ` - ${order.client.name}`}
            </div>
            {order.order_products?.length > 0 ? (
              <div className="space-y-2">
                {order.order_products.map((product: any) => {
                  const hasIssue = product.product_price && !product.client_product_price;
                  
                  return (
                    <div key={product.id} className={`text-sm p-2 rounded ${hasIssue ? 'bg-red-100' : 'bg-white'}`}>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <span className="text-gray-500">Product:</span> {product.product_order_number}
                        </div>
                        <div>
                          <span className="text-gray-500">Mfr Price:</span> 
                          <span className={product.product_price ? '' : 'text-gray-400'}>
                            {product.product_price ? ` $${product.product_price}` : ' Not set'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Client Price:</span> 
                          <span className={product.client_product_price ? '' : 'text-red-600 font-bold'}>
                            {product.client_product_price ? ` $${product.client_product_price}` : ' MISSING'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Margin:</span> 
                          {product.product_margin_override || product.margin_applied || '80'}%
                        </div>
                      </div>
                      {hasIssue && (
                        <div className="mt-1 text-red-600 text-xs">
                          ⚠️ Issue: Has manufacturer price but missing client price
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No products found</p>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded">
        <h2 className="font-bold text-lg mb-2">Summary</h2>
        <ul className="space-y-1">
          <li>System Config entries: {diagnosticData.systemConfig.length} {diagnosticData.systemConfig.length === 0 && '❌ MISSING'}</li>
          <li>Order margins found: {diagnosticData.orderMargins.length}</li>
          <li>Recent orders checked: {diagnosticData.orders.length}</li>
          <li>Products with manufacturer prices: {diagnosticData.orderProducts.filter((p: any) => p.product_price).length}</li>
          <li className={diagnosticData.orderProducts.some((p: any) => p.product_price && !p.client_product_price) ? 'text-red-600 font-bold' : ''}>
            Products missing client prices: {diagnosticData.orderProducts.filter((p: any) => p.product_price && !p.client_product_price).length}
            {diagnosticData.orderProducts.some((p: any) => p.product_price && !p.client_product_price) && ' ❌ NEEDS FIX'}
          </li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex gap-4">
        <button
          onClick={runDiagnostics}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Re-run Diagnostic
        </button>
        <button
          onClick={() => {
            const data = JSON.stringify(diagnosticData, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `margin-diagnostic-${Date.now()}.json`;
            a.click();
          }}
          className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
        >
          Download Report
        </button>
      </div>
    </div>
  );
}
