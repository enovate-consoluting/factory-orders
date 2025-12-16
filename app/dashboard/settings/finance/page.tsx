'use client';

import React, { useState, useEffect } from 'react';
import { Save, Percent, AlertCircle, CheckCircle, Package, Truck, FileBox, DollarSign, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function FinanceSettingsPage() {
  const router = useRouter();
  
  // Existing margin states
  const [productMargin, setProductMargin] = useState('80');
  const [shippingMargin, setShippingMargin] = useState('5');
  const [sampleMargin, setSampleMargin] = useState('80');
  
  // NEW: Clothing fee states
  const [clothingProductFee, setClothingProductFee] = useState('0');
  const [clothingSampleFee, setClothingSampleFee] = useState('0');
  const [accessoryMargin, setAccessoryMargin] = useState('100');
  
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUserRole();
    loadSettings();
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

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('config_key, config_value')
        .in('config_key', [
          'default_margin_percentage', 
          'default_shipping_margin_percentage',
          'default_sample_margin_percentage',
          'clothing_product_fee',
          'clothing_sample_fee',
          'accessory_margin_percentage'
        ]);

      if (data) {
        data.forEach(config => {
          if (config.config_key === 'default_margin_percentage') {
            setProductMargin(config.config_value);
          } else if (config.config_key === 'default_shipping_margin_percentage') {
            setShippingMargin(config.config_value);
          } else if (config.config_key === 'default_sample_margin_percentage') {
            setSampleMargin(config.config_value);
          } else if (config.config_key === 'clothing_product_fee') {
            setClothingProductFee(config.config_value);
          } else if (config.config_key === 'clothing_sample_fee') {
            setClothingSampleFee(config.config_value);
          } else if (config.config_key === 'accessory_margin_percentage') {
            setAccessoryMargin(config.config_value);
          }
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setMessage('');
    
    try {
      // Validate margins
      const productMarginValue = parseFloat(productMargin);
      const shippingMarginValue = parseFloat(shippingMargin);
      const sampleMarginValue = parseFloat(sampleMargin);
      const clothingProductFeeValue = parseFloat(clothingProductFee);
      const clothingSampleFeeValue = parseFloat(clothingSampleFee);
      
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

      if (isNaN(sampleMarginValue) || sampleMarginValue < 0 || sampleMarginValue > 500) {
        setMessage('Please enter a valid sample margin between 0 and 500');
        setSaving(false);
        return;
      }

      if (isNaN(clothingProductFeeValue) || clothingProductFeeValue < 0) {
        setMessage('Please enter a valid clothing product fee (0 or higher)');
        setSaving(false);
        return;
      }

      if (isNaN(clothingSampleFeeValue) || clothingSampleFeeValue < 0) {
        setMessage('Please enter a valid clothing sample fee (0 or higher)');
        setSaving(false);
        return;
      }

      const accessoryMarginValue = parseFloat(accessoryMargin);
      if (isNaN(accessoryMarginValue) || accessoryMarginValue < 0 || accessoryMarginValue > 500) {
        setMessage('Please enter a valid accessory margin between 0 and 500');
        setSaving(false);
        return;
      }

      // Save all settings
      const settings = [
        { key: 'default_margin_percentage', value: productMargin, desc: 'Default margin percentage for products' },
        { key: 'default_shipping_margin_percentage', value: shippingMargin, desc: 'Default margin percentage for shipping fees' },
        { key: 'default_sample_margin_percentage', value: sampleMargin, desc: 'Default margin percentage for sample fees and tech packs' },
        { key: 'clothing_product_fee', value: clothingProductFee, desc: 'Flat fee per unit for clothing products (bypasses percentage margin)' },
        { key: 'clothing_sample_fee', value: clothingSampleFee, desc: 'Flat fee for clothing samples (placeholder - not applied yet)' },
        { key: 'accessory_margin_percentage', value: accessoryMargin, desc: 'Default margin percentage for accessories' },
      ];

      for (const setting of settings) {
        const { error } = await supabase
          .from('system_config')
          .upsert({
            config_key: setting.key,
            config_value: setting.value,
            description: setting.desc,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'config_key'
          });

        if (error) throw error;
      }

      setMessage('Settings updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage('Failed to save settings. Please try again.');
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
    <div className="p-3 sm:p-4 md:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Finance Settings</h1>
        <p className="text-sm sm:text-base text-gray-600">Configure margins and fees for all new orders</p>
      </div>

      <div className="bg-white rounded-lg shadow-md">
        <div className="p-4 sm:p-6 space-y-6">
          
          {/* SECTION: Product Pricing */}
          <div className="pb-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Product Pricing
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mb-4">
              Regular products use margin %. Products marked as "Clothing" use the flat fee instead.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product Margin */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm font-semibold text-gray-900">
                    Product Margin
                  </label>
                  <span className="px-2 py-0.5 bg-blue-200 text-blue-800 text-xs rounded-full">Regular</span>
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  Manufacturer Price × (1 + Margin %)
                </p>
                <div className="flex items-center gap-2">
                  <div className="relative w-28">
                    <input
                      type="number"
                      value={productMargin}
                      onChange={(e) => setProductMargin(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 text-lg font-semibold text-gray-900 bg-white border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="80"
                      min="0"
                      max="500"
                      step="1"
                    />
                    <Percent className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  80% on $100 = $180
                </p>
              </div>

              {/* Clothing Product Fee */}
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm font-semibold text-gray-900">
                    Clothing Fee
                  </label>
                  <span className="px-2 py-0.5 bg-purple-200 text-purple-800 text-xs rounded-full">Per Unit</span>
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  (Manufacturer Price + Fee) × Quantity
                </p>
                <div className="flex items-center gap-2">
                  <div className="relative w-28">
                    <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="number"
                      value={clothingProductFee}
                      onChange={(e) => setClothingProductFee(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 text-lg font-semibold text-gray-900 bg-white border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="0"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  $6 on $4 × 1000 = $10,000
                </p>
              </div>
            </div>
          </div>

          {/* SECTION: Sample & Tech Pack Pricing */}
          <div className="pb-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
              <FileBox className="w-5 h-5 text-amber-600" />
              Sample & Tech Pack Pricing
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mb-4">
              Currently all samples use margin %. Clothing fee is a placeholder for future use with sample quantities.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sample Margin */}
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm font-semibold text-gray-900">
                    Sample Margin
                  </label>
                  <span className="px-2 py-0.5 bg-amber-200 text-amber-800 text-xs rounded-full">Active</span>
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  Manufacturer Fee × (1 + Margin %)
                </p>
                <div className="flex items-center gap-2">
                  <div className="relative w-28">
                    <input
                      type="number"
                      value={sampleMargin}
                      onChange={(e) => setSampleMargin(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 text-lg font-semibold text-gray-900 bg-white border-2 border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      placeholder="80"
                      min="0"
                      max="500"
                      step="1"
                    />
                    <Percent className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  80% on $50 = $90
                </p>
              </div>

              {/* Clothing Sample Fee - Grayed Out */}
              <div className="p-4 bg-gray-100 rounded-lg border border-gray-300">
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm font-semibold text-gray-500">
                    Clothing Sample Fee
                  </label>
                  <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">Not Applied</span>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  For future use when sample quantities are added
                </p>
                <div className="flex items-center gap-2">
                  <div className="relative w-28">
                    <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      value={clothingSampleFee}
                      onChange={(e) => setClothingSampleFee(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 text-lg font-semibold text-gray-400 bg-gray-50 border-2 border-gray-300 rounded-lg"
                      placeholder="0"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Placeholder - not currently used
                </p>
              </div>
            </div>
          </div>

          {/* SECTION: Shipping */}
          <div className="pb-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Truck className="w-5 h-5 text-green-600" />
              Shipping Pricing
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mb-4">
              Applied to air and boat shipping fees from manufacturers
            </p>
            
            <div className="p-4 bg-green-50 rounded-lg border border-green-200 max-w-md">
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-semibold text-gray-900">
                  Shipping Fee Margin
                </label>
              </div>
              <p className="text-xs text-gray-600 mb-3">
                Manufacturer Shipping × (1 + Margin %)
              </p>
              <div className="flex items-center gap-2">
                <div className="relative w-28">
                  <input
                    type="number"
                    value={shippingMargin}
                    onChange={(e) => setShippingMargin(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 text-lg font-semibold text-gray-900 bg-white border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="5"
                    min="0"
                    max="500"
                    step="1"
                  />
                  <Percent className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                5% on $500 = $525
              </p>
            </div>
          </div>

          {/* SECTION: Accessories */}
          <div className="pb-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Tag className="w-5 h-5 text-indigo-600" />
              Accessory Pricing
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mb-4">
              Applied to all accessory items when manufacturer sets their cost
            </p>
            
            <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200 max-w-md">
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-semibold text-gray-900">
                  Accessory Margin
                </label>
              </div>
              <p className="text-xs text-gray-600 mb-3">
                Manufacturer Cost × (1 + Margin %)
              </p>
              <div className="flex items-center gap-2">
                <div className="relative w-28">
                  <input
                    type="number"
                    value={accessoryMargin}
                    onChange={(e) => setAccessoryMargin(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 text-lg font-semibold text-gray-900 bg-white border-2 border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="100"
                    min="0"
                    max="500"
                    step="1"
                  />
                  <Percent className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                100% on $0.10 = $0.20 (doubles the cost)
              </p>
            </div>
          </div>

          {/* Save Button and Messages */}
          <div className="pt-2">
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full w-3 h-3 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                  ) : (
                    <Save className="w-3 h-3 sm:w-4 sm:h-4" />
                  )}
                  Save Settings
                </button>

                <Link
                  href="/dashboard/settings/finance/orders"
                  className="bg-gray-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  View Order Margins
                </Link>
              </div>

              {message && (
                <div className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm ${
                  message.includes('success')
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {message.includes('success') ? (
                    <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                  )}
                  {message}
                </div>
              )}
            </div>
          </div>

          {/* Current Settings Summary */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Current Settings Summary:</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-600">Product:</span>
                <span className="text-sm font-bold text-gray-900">{productMargin}%</span>
                <span className="text-sm text-gray-400">/</span>
                <span className="text-sm font-bold text-purple-700">${clothingProductFee} clothing</span>
              </div>
              <div className="flex items-center gap-2">
                <FileBox className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-gray-600">Sample:</span>
                <span className="text-sm font-bold text-gray-900">{sampleMargin}%</span>
                <span className="text-sm text-gray-400">/</span>
                <span className="text-sm text-gray-400">${clothingSampleFee} clothing (N/A)</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-600">Shipping:</span>
                <span className="text-sm font-bold text-gray-900">{shippingMargin}%</span>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-600" />
                <span className="text-sm text-gray-600">Accessory:</span>
                <span className="text-sm font-bold text-gray-900">{accessoryMargin}%</span>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs sm:text-sm text-blue-900">
                <p className="font-semibold mb-1">How it works:</p>
                <ul className="list-disc ml-4 sm:ml-5 space-y-1">
                  <li>These settings apply to all NEW orders automatically</li>
                  <li>Existing orders keep their current pricing unless manually updated</li>
                  <li>Products marked as "Clothing" use the flat fee instead of margin %</li>
                  <li>Manufacturers only see their original prices, not the margins/fees</li>
                  <li>Regular admins see client prices but not the margin details</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
