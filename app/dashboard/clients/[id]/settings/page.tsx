/**
 * Client Settings Page - /dashboard/clients/[id]/settings
 * Configure per-client custom margin overrides
 * Includes: Product Margin, Sample Margin (NEW), Shipping Margin
 * Roles: Super Admin only
 * Last Modified: December 5, 2025
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Save, 
  ArrowLeft, 
  Percent, 
  AlertCircle, 
  CheckCircle, 
  Package, 
  Truck, 
  FileBox,
  Building2,
  Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function ClientSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  // Client info
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // System defaults (for display)
  const [systemProductMargin, setSystemProductMargin] = useState(80);
  const [systemSampleMargin, setSystemSampleMargin] = useState(80);
  const [systemShippingMargin, setSystemShippingMargin] = useState(5);

  // Client custom margins - null means use system default
  const [customProductMargin, setCustomProductMargin] = useState<string>('');
  const [customSampleMargin, setCustomSampleMargin] = useState<string>('');
  const [customShippingMargin, setCustomShippingMargin] = useState<string>('');

  // Toggle states for using custom vs system
  const [useCustomProduct, setUseCustomProduct] = useState(false);
  const [useCustomSample, setUseCustomSample] = useState(false);
  const [useCustomShipping, setUseCustomShipping] = useState(false);

  // Check if user is super admin
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/dashboard');
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [router]);

  // Load data
  useEffect(() => {
    loadData();
  }, [clientId]);

  const loadData = async () => {
    try {
      // Load system defaults
      const { data: systemConfig } = await supabase
        .from('system_config')
        .select('config_key, config_value')
        .in('config_key', [
          'default_margin_percentage',
          'default_sample_margin_percentage',
          'default_shipping_margin_percentage'
        ]);

      if (systemConfig) {
        systemConfig.forEach(config => {
          if (config.config_key === 'default_margin_percentage') {
            setSystemProductMargin(parseFloat(config.config_value) || 80);
          } else if (config.config_key === 'default_sample_margin_percentage') {
            setSystemSampleMargin(parseFloat(config.config_value) || 80);
          } else if (config.config_key === 'default_shipping_margin_percentage') {
            setSystemShippingMargin(parseFloat(config.config_value) || 5);
          }
        });
      }

      // Load client data
      const { data: client, error } = await supabase
        .from('clients')
        .select('name, custom_margin_percentage, custom_sample_margin_percentage, custom_shipping_margin_percentage')
        .eq('id', clientId)
        .single();

      if (error) {
        console.error('Error loading client:', error);
        setMessage('Failed to load client data');
        return;
      }

      if (client) {
        setClientName(client.name || 'Unknown Client');

        // Product margin
        if (client.custom_margin_percentage !== null && client.custom_margin_percentage !== undefined) {
          setUseCustomProduct(true);
          setCustomProductMargin(client.custom_margin_percentage.toString());
        }

        // Sample margin
        if (client.custom_sample_margin_percentage !== null && client.custom_sample_margin_percentage !== undefined) {
          setUseCustomSample(true);
          setCustomSampleMargin(client.custom_sample_margin_percentage.toString());
        }

        // Shipping margin
        if (client.custom_shipping_margin_percentage !== null && client.custom_shipping_margin_percentage !== undefined) {
          setUseCustomShipping(true);
          setCustomShippingMargin(client.custom_shipping_margin_percentage.toString());
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');

    try {
      // Validate margins if custom is enabled
      if (useCustomProduct) {
        const val = parseFloat(customProductMargin);
        if (isNaN(val) || val < 0 || val > 500) {
          setMessage('Product margin must be between 0 and 500');
          setSaving(false);
          return;
        }
      }

      if (useCustomSample) {
        const val = parseFloat(customSampleMargin);
        if (isNaN(val) || val < 0 || val > 500) {
          setMessage('Sample margin must be between 0 and 500');
          setSaving(false);
          return;
        }
      }

      if (useCustomShipping) {
        const val = parseFloat(customShippingMargin);
        if (isNaN(val) || val < 0 || val > 500) {
          setMessage('Shipping margin must be between 0 and 500');
          setSaving(false);
          return;
        }
      }

      // Prepare update data - null means use system default
      const updateData: any = {
        custom_margin_percentage: useCustomProduct ? parseFloat(customProductMargin) : null,
        custom_sample_margin_percentage: useCustomSample ? parseFloat(customSampleMargin) : null,
        custom_shipping_margin_percentage: useCustomShipping ? parseFloat(customShippingMargin) : null,
      };

      console.log('Saving client margins:', updateData);

      const { error } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', clientId);

      if (error) {
        console.error('Error saving:', error);
        setMessage('Failed to save settings');
        return;
      }

      setMessage('Settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error saving:', error);
      setMessage('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <Link 
          href="/dashboard/clients"
          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 mb-3"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Clients
        </Link>
        
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{clientName}</h1>
            <p className="text-sm text-gray-600">Custom Margin Settings</p>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-6">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">How Custom Margins Work:</p>
            <ul className="list-disc ml-5 space-y-1">
              <li><strong>Enabled:</strong> Uses the custom percentage you set below</li>
              <li><strong>Disabled:</strong> Falls back to the system default margin</li>
              <li>Changes apply to NEW orders only (existing orders keep their margins)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Settings Card */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-4 sm:p-6 space-y-6">
          
          {/* Product Margin */}
          <div className="border-b pb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                <label className="text-lg font-semibold text-gray-900">Product Margin</label>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-gray-600">Use Custom</span>
                <input
                  type="checkbox"
                  checked={useCustomProduct}
                  onChange={(e) => {
                    setUseCustomProduct(e.target.checked);
                    if (e.target.checked && !customProductMargin) {
                      setCustomProductMargin(systemProductMargin.toString());
                    }
                  }}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </label>
            </div>
            
            <div className="ml-7">
              {useCustomProduct ? (
                <div className="flex items-center gap-3">
                  <div className="relative w-32">
                    <input
                      type="number"
                      value={customProductMargin}
                      onChange={(e) => setCustomProductMargin(e.target.value)}
                      className="w-full pl-4 pr-10 py-3 text-lg font-semibold text-gray-900 bg-white border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="80"
                      min="0"
                      max="500"
                    />
                    <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                  </div>
                  <span className="text-sm text-green-600 font-medium">✓ Custom margin active</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="px-4 py-3 bg-gray-100 rounded-lg">
                    <span className="text-lg font-semibold text-gray-600">{systemProductMargin}%</span>
                  </div>
                  <span className="text-sm text-gray-500">Using system default</span>
                </div>
              )}
            </div>
          </div>

          {/* Sample Margin - NEW */}
          <div className="border-b pb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileBox className="w-5 h-5 text-amber-600" />
                <label className="text-lg font-semibold text-gray-900">Sample & Tech Pack Margin</label>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-gray-600">Use Custom</span>
                <input
                  type="checkbox"
                  checked={useCustomSample}
                  onChange={(e) => {
                    setUseCustomSample(e.target.checked);
                    if (e.target.checked && !customSampleMargin) {
                      setCustomSampleMargin(systemSampleMargin.toString());
                    }
                  }}
                  className="w-5 h-5 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                />
              </label>
            </div>
            
            <div className="ml-7">
              {useCustomSample ? (
                <div className="flex items-center gap-3">
                  <div className="relative w-32">
                    <input
                      type="number"
                      value={customSampleMargin}
                      onChange={(e) => setCustomSampleMargin(e.target.value)}
                      className="w-full pl-4 pr-10 py-3 text-lg font-semibold text-gray-900 bg-white border-2 border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      placeholder="80"
                      min="0"
                      max="500"
                    />
                    <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                  </div>
                  <span className="text-sm text-green-600 font-medium">✓ Custom margin active</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="px-4 py-3 bg-gray-100 rounded-lg">
                    <span className="text-lg font-semibold text-gray-600">{systemSampleMargin}%</span>
                  </div>
                  <span className="text-sm text-gray-500">Using system default</span>
                </div>
              )}
            </div>
          </div>

          {/* Shipping Margin */}
          <div className="pb-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-green-600" />
                <label className="text-lg font-semibold text-gray-900">Shipping Fee Margin</label>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-gray-600">Use Custom</span>
                <input
                  type="checkbox"
                  checked={useCustomShipping}
                  onChange={(e) => {
                    setUseCustomShipping(e.target.checked);
                    if (e.target.checked && !customShippingMargin) {
                      setCustomShippingMargin(systemShippingMargin.toString());
                    }
                  }}
                  className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
              </label>
            </div>
            
            <div className="ml-7">
              {useCustomShipping ? (
                <div className="flex items-center gap-3">
                  <div className="relative w-32">
                    <input
                      type="number"
                      value={customShippingMargin}
                      onChange={(e) => setCustomShippingMargin(e.target.value)}
                      className="w-full pl-4 pr-10 py-3 text-lg font-semibold text-gray-900 bg-white border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="5"
                      min="0"
                      max="500"
                    />
                    <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                  </div>
                  <span className="text-sm text-green-600 font-medium">✓ Custom margin active</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="px-4 py-3 bg-gray-100 rounded-lg">
                    <span className="text-lg font-semibold text-gray-600">{systemShippingMargin}%</span>
                  </div>
                  <span className="text-sm text-gray-500">Using system default</span>
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2 font-medium"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Settings
              </button>

              {message && (
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
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

          {/* Current Effective Margins Summary */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Effective Margins for {clientName}:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-600">Product:</span>
                <span className="text-sm font-bold text-gray-900">
                  {useCustomProduct ? customProductMargin : systemProductMargin}%
                </span>
                {useCustomProduct && (
                  <span className="text-xs text-blue-600">(custom)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <FileBox className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-gray-600">Sample:</span>
                <span className="text-sm font-bold text-gray-900">
                  {useCustomSample ? customSampleMargin : systemSampleMargin}%
                </span>
                {useCustomSample && (
                  <span className="text-xs text-amber-600">(custom)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-600">Shipping:</span>
                <span className="text-sm font-bold text-gray-900">
                  {useCustomShipping ? customShippingMargin : systemShippingMargin}%
                </span>
                {useCustomShipping && (
                  <span className="text-xs text-green-600">(custom)</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}