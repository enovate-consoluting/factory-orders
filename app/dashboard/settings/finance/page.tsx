'use client';

import React, { useState, useEffect } from 'react';
import { Save, Percent, AlertCircle, CheckCircle, Package, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function FinanceSettingsPage() {
  const router = useRouter();
  const [productMargin, setProductMargin] = useState('80');
  const [shippingMargin, setShippingMargin] = useState('0');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // Check if user is super admin
  useEffect(() => {
    checkUserRole();
    loadMargins();
  }, []);

  const checkUserRole = () => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/dashboard');
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  };

  const loadMargins = async () => {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('config_key, config_value')
        .in('config_key', ['default_margin_percentage', 'default_shipping_margin_percentage']);

      if (data) {
        data.forEach(config => {
          if (config.config_key === 'default_margin_percentage') {
            setProductMargin(config.config_value);
          } else if (config.config_key === 'default_shipping_margin_percentage') {
            setShippingMargin(config.config_value);
          }
        });
      }
    } catch (error) {
      console.error('Error loading margins:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMargins = async () => {
    setSaving(true);
    setMessage('');
    
    try {
      const productMarginValue = parseFloat(productMargin);
      const shippingMarginValue = parseFloat(shippingMargin);
      
      if (isNaN(productMarginValue) || productMarginValue < 0 || productMarginValue > 500) {
        setMessage('Please enter a valid product margin between 0 and 500');
        setSaving(false);
        return;
      }
      
      if (isNaN(shippingMarginValue) || shippingMarginValue < 0 || shippingMarginValue > 500) {
        setMessage('Please enter a valid shipping margin between 0 and 500');
        setSaving(false);
        return;
      }

      // Save product margin
      const { error: productError } = await supabase
        .from('system_config')
        .upsert({
          config_key: 'default_margin_percentage',
          config_value: productMargin,
          description: 'Default margin percentage for products and sample fees',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'config_key'
        });

      if (productError) throw productError;

      // Save shipping margin
      const { error: shippingError } = await supabase
        .from('system_config')
        .upsert({
          config_key: 'default_shipping_margin_percentage',
          config_value: shippingMargin,
          description: 'Default margin percentage for shipping fees',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'config_key'
        });

      if (shippingError) throw shippingError;

      setMessage('Margins updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error saving margins:', error);
      setMessage('Failed to save margins. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Finance Settings</h1>
        <p className="text-gray-600">Configure default margin percentages for all new orders</p>
      </div>

      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 space-y-6">
          {/* Product & Sample Fee Margin */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-5 h-5 text-blue-600" />
              <label className="text-lg font-semibold text-gray-900">
                Product & Sample Fee Margin
              </label>
            </div>
            <div className="ml-7">
              <p className="text-sm text-gray-600 mb-3">
                This margin will be applied to all product prices and sample fees from manufacturers
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="relative w-32">
                  <input
                    type="number"
                    value={productMargin}
                    onChange={(e) => setProductMargin(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 text-lg font-semibold text-gray-900 bg-white border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="80"
                    min="0"
                    max="500"
                    step="1"
                  />
                  <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                </div>
                <div className="text-sm text-gray-600">
                  Example: 80% on $100 = $180 to client
                </div>
              </div>
            </div>
          </div>

          {/* Shipping Margin */}
          <div className="border-t pt-6">
            <div className="flex items-center gap-2 mb-3">
              <Truck className="w-5 h-5 text-green-600" />
              <label className="text-lg font-semibold text-gray-900">
                Shipping Fee Margin
              </label>
            </div>
            <div className="ml-7">
              <p className="text-sm text-gray-600 mb-3">
                This margin will be applied to air and boat shipping fees from manufacturers
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="relative w-32">
                  <input
                    type="number"
                    value={shippingMargin}
                    onChange={(e) => setShippingMargin(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 text-lg font-semibold text-gray-900 bg-white border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                    min="0"
                    max="500"
                    step="1"
                  />
                  <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                </div>
                <div className="text-sm text-gray-600">
                  Example: 0% on $50 = $50 to client (no markup)
                </div>
              </div>
            </div>
          </div>

          {/* Save Button and Messages */}
          <div className="border-t pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <button
                  onClick={handleSaveMargins}
                  disabled={saving}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Settings
                </button>
                
                <Link
                  href="/dashboard/settings/finance/orders"
                  className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2"
                >
                  View Order Margins
                </Link>
              </div>

              {message && (
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  message.includes('success') 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {message.includes('success') ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  {message}
                </div>
              )}
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">How it works:</p>
                <ul className="list-disc ml-5 space-y-1">
                  <li>These default margins apply to all NEW orders automatically</li>
                  <li>Existing orders keep their current margins unless manually updated</li>
                  <li>You can override margins for specific orders or products in the Order Margins page</li>
                  <li>Manufacturers only see their original prices, not the margins</li>
                  <li>Regular admins see client prices but not the margin percentages</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}