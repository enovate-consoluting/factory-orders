/**
 * Manufacturer Settings Page - /dashboard/settings/manufacturer
 * Per-manufacturer configurable settings for workflow
 * Roles: Manufacturer (own settings), Super Admin (any manufacturer)
 * UPDATED: Added Shipping Days configuration for ETA calculation
 * Last Modified: December 4, 2025
 */

'use client';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../../../i18n';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Settings, 
  Save, 
  Clock, 
  Truck,
  AlertCircle,
  CheckCircle,
  Loader2,
  Building,
  ChevronDown,
  Globe,
  Plane,
  Ship,
  Calendar
} from 'lucide-react';

interface Manufacturer {
  id: string;
  name: string;
  email: string;
  ship_queue_name: string | null;
  ship_queue_name_zh: string | null;
  ship_queue_days: number | null;
  air_shipping_days: number | null;
  boat_shipping_days: number | null;
}

export default function ManufacturerSettingsPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // For super_admin: list of all manufacturers
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [selectedManufacturerId, setSelectedManufacturerId] = useState<string | null>(null);

  // Current manufacturer being edited
  const [currentManufacturer, setCurrentManufacturer] = useState<Manufacturer | null>(null);

  // Settings fields - Ship Queue
  const [shipQueueName, setShipQueueName] = useState('Ready to Ship');
  const [shipQueueNameZh, setShipQueueNameZh] = useState('准备发货');
  const [shipQueueDays, setShipQueueDays] = useState('3');

  // NEW: Settings fields - Shipping Days for ETA
  const [airShippingDays, setAirShippingDays] = useState('15');
  const [boatShippingDays, setBoatShippingDays] = useState('34');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }
    const user = JSON.parse(userData);
    setUserRole(user.role);
    setUserEmail(user.email);
    
    // Only manufacturers and super_admins can access
    if (!['manufacturer', 'super_admin'].includes(user.role)) {
      router.push('/dashboard');
      return;
    }
    
    if (user.role === 'super_admin') {
      fetchAllManufacturers();
    } else if (user.role === 'manufacturer') {
      fetchManufacturerByEmail(user.email);
    }
  }, [router]);

  // Super Admin: fetch all manufacturers
  const fetchAllManufacturers = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('manufacturers')
        .select('id, name, email, ship_queue_name, ship_queue_name_zh, ship_queue_days, air_shipping_days, boat_shipping_days')
        .order('name');
      
      if (error) throw error;
      
      setManufacturers(data || []);
      
      // Auto-select first manufacturer
      if (data && data.length > 0) {
        setSelectedManufacturerId(data[0].id);
        loadManufacturerSettings(data[0]);
      }
    } catch (error) {
      console.error('Error fetching manufacturers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Manufacturer: fetch their own record
  const fetchManufacturerByEmail = async (email: string) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('manufacturers')
        .select('id, name, email, ship_queue_name, ship_queue_name_zh, ship_queue_days, air_shipping_days, boat_shipping_days')
        .eq('email', email)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setCurrentManufacturer(data);
        setSelectedManufacturerId(data.id);
        loadManufacturerSettings(data);
      }
    } catch (error) {
      console.error('Error fetching manufacturer:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load settings into form fields
  const loadManufacturerSettings = (manufacturer: Manufacturer) => {
    setCurrentManufacturer(manufacturer);
    setShipQueueName(manufacturer.ship_queue_name || 'Ready to Ship');
    setShipQueueNameZh(manufacturer.ship_queue_name_zh || '准备发货');
    setShipQueueDays(String(manufacturer.ship_queue_days || 3));
    // NEW: Load shipping days
    setAirShippingDays(String(manufacturer.air_shipping_days || 15));
    setBoatShippingDays(String(manufacturer.boat_shipping_days || 34));
  };

  // When super_admin selects a different manufacturer
  const handleManufacturerChange = (manufacturerId: string) => {
    setSelectedManufacturerId(manufacturerId);
    setSaveMessage(null);
    
    const manufacturer = manufacturers.find(m => m.id === manufacturerId);
    if (manufacturer) {
      loadManufacturerSettings(manufacturer);
    }
  };

  const handleSave = async () => {
    if (!selectedManufacturerId) {
      setSaveMessage({ type: 'error', text: 'No manufacturer selected' });
      return;
    }

    try {
      setSaving(true);
      setSaveMessage(null);

      // Validate days is a positive number
      const daysNum = parseInt(shipQueueDays, 10);
      if (isNaN(daysNum) || daysNum < 1 || daysNum > 30) {
        setSaveMessage({ type: 'error', text: 'Ship queue days must be a number between 1 and 30' });
        return;
      }

      // Validate shipping days
      const airDaysNum = parseInt(airShippingDays, 10);
      const boatDaysNum = parseInt(boatShippingDays, 10);
      
      if (isNaN(airDaysNum) || airDaysNum < 1 || airDaysNum > 60) {
        setSaveMessage({ type: 'error', text: 'Air shipping days must be a number between 1 and 60' });
        return;
      }
      
      if (isNaN(boatDaysNum) || boatDaysNum < 1 || boatDaysNum > 90) {
        setSaveMessage({ type: 'error', text: 'Boat shipping days must be a number between 1 and 90' });
        return;
      }

      // Validate name is not empty
      if (!shipQueueName.trim()) {
        setSaveMessage({ type: 'error', text: 'Tab name (English) cannot be empty' });
        return;
      }

      // Update manufacturer settings
      const { error } = await supabase
        .from('manufacturers')
        .update({ 
          ship_queue_name: shipQueueName.trim(),
          ship_queue_name_zh: shipQueueNameZh.trim() || null,
          ship_queue_days: daysNum,
          air_shipping_days: airDaysNum,
          boat_shipping_days: boatDaysNum
        })
        .eq('id', selectedManufacturerId);

      if (error) throw error;

      // Update local state
      if (userRole === 'super_admin') {
        setManufacturers(prev => prev.map(m => 
          m.id === selectedManufacturerId 
            ? { 
                ...m, 
                ship_queue_name: shipQueueName.trim(), 
                ship_queue_name_zh: shipQueueNameZh.trim() || null, 
                ship_queue_days: daysNum,
                air_shipping_days: airDaysNum,
                boat_shipping_days: boatDaysNum
              }
            : m
        ));
      }

      setSaveMessage({ type: 'success', text: 'Settings saved successfully!' });
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
      
    } catch (error: any) {
      console.error('Error saving settings:', error);
      setSaveMessage({ type: 'error', text: error.message || 'Error saving settings' });
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
    <div className="p-3 sm:p-4 md:p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <Settings className="w-6 h-6 sm:w-8 sm:h-8 text-gray-700" />
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Manufacturer Settings</h1>
        </div>
        <p className="text-sm sm:text-base text-gray-600">
          {userRole === 'super_admin'
            ? 'Configure workflow settings for manufacturers'
            : 'Configure your workflow preferences'
          }
        </p>
      </div>

      {/* Super Admin: Manufacturer Selector */}
      {userRole === 'super_admin' && manufacturers.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 sm:mb-6 p-3 sm:p-4">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center gap-2">
              <Building className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
              <span>Select Manufacturer</span>
            </div>
          </label>
          <div className="relative">
            <select
              value={selectedManufacturerId || ''}
              onChange={(e) => handleManufacturerChange(e.target.value)}
              className="w-full sm:max-w-md px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 appearance-none bg-white pr-10"
            >
              {manufacturers.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 pointer-events-none" />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Editing settings for: <strong>{currentManufacturer?.name}</strong>
          </p>
        </div>
      )}

      {/* Manufacturer name display (for manufacturer role) */}
      {userRole === 'manufacturer' && currentManufacturer && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            <span className="text-sm sm:text-base font-medium text-blue-900">{currentManufacturer.name}</span>
          </div>
        </div>
      )}

      {/* Save Message */}
      {saveMessage && (
        <div className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg flex items-center gap-2 ${
          saveMessage.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {saveMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          )}
          <span className="text-xs sm:text-sm">{saveMessage.text}</span>
        </div>
      )}

      {/* Ship Queue Settings Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 sm:mb-6">
        <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Shipping Queue Settings</h2>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Configure the shipping queue tab that shows products approaching their ship date
          </p>
        </div>

        <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
          {/* Tab Name - English */}
          <div>
            <label htmlFor="shipQueueName" className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <span>{t('tabName')}</span>
              </div>
            </label>
            <input
              type="text"
              id="shipQueueName"
              value={shipQueueName}
              onChange={(e) => setShipQueueName(e.target.value)}
              placeholder={t('readyToShip')}
              maxLength={30}
              className="w-full sm:max-w-md px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('readyToShipChinese')} (max 30 characters)
            </p>
          </div>

          {/* Tab Name - Chinese */}
          <div>
            <label htmlFor="shipQueueNameZh" className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <Globe className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                <span>{t('tabNameChinese')}</span>
              </div>
            </label>
            <input
              type="text"
              id="shipQueueNameZh"
              value={shipQueueNameZh}
              onChange={(e) => setShipQueueNameZh(e.target.value)}
              placeholder={t('readyToShipChinese')}
              maxLength={30}
              className="w-full sm:max-w-md px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('readyToShip')} (max 30 characters)
            </p>
          </div>

          {/* Days Threshold */}
          <div>
            <label htmlFor="shipQueueDays" className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                <span>{t('daysBeforeShip')}</span>
              </div>
            </label>
            <div className="flex items-center gap-2 sm:gap-3">
              <input
                type="number"
                id="shipQueueDays"
                value={shipQueueDays}
                onChange={(e) => setShipQueueDays(e.target.value)}
                min="1"
                max="30"
                className="w-20 sm:w-24 px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
              <span className="text-sm sm:text-base text-gray-600">{i18n.language === 'zh' ? '天' : 'days'}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t('daysBeforeShipChinese')}
            </p>
            {/* Visual Example */}
            <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-xs sm:text-sm text-orange-800">
                <strong>Example:</strong> If set to {shipQueueDays} {i18n.language === 'zh' ? '天' : 'days'}, a product with ship date of{' '}
                <strong>
                  {new Date(Date.now() + parseInt(shipQueueDays || '3', 10) * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </strong>{' '}
                will appear in the "{i18n.language === 'zh' ? shipQueueNameZh : shipQueueName}" tab starting today.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Shipping Days for ETA Calculation Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 sm:mb-6">
        <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-t-lg">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Shipping Duration Settings</h2>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Configure shipping transit times for estimated delivery (ETA) calculations
          </p>
        </div>

        <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
          {/* Air Shipping Days */}
          <div>
            <label htmlFor="airShippingDays" className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <Plane className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" />
                <span>Air Shipping Duration</span>
              </div>
            </label>
            <div className="flex items-center gap-2 sm:gap-3">
              <input
                type="number"
                id="airShippingDays"
                value={airShippingDays}
                onChange={(e) => setAirShippingDays(e.target.value)}
                min="1"
                max="60"
                className="w-20 sm:w-24 px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
              <span className="text-sm sm:text-base text-gray-600">{i18n.language === 'zh' ? '天' : 'days'}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Average transit time for air freight shipments (typically 10-20 days)
            </p>
          </div>

          {/* Boat Shipping Days */}
          <div>
            <label htmlFor="boatShippingDays" className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <Ship className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-600" />
                <span>Boat/Sea Shipping Duration</span>
              </div>
            </label>
            <div className="flex items-center gap-2 sm:gap-3">
              <input
                type="number"
                id="boatShippingDays"
                value={boatShippingDays}
                onChange={(e) => setBoatShippingDays(e.target.value)}
                min="1"
                max="90"
                className="w-20 sm:w-24 px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
              <span className="text-sm sm:text-base text-gray-600">{i18n.language === 'zh' ? '天' : 'days'}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Average transit time for sea freight shipments (typically 30-45 days)
            </p>
          </div>

          {/* ETA Calculation Example */}
          <div className="mt-2 sm:mt-3 p-3 sm:p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <h4 className="text-sm font-medium text-indigo-900 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              How ETA is Calculated
            </h4>
            <p className="text-xs sm:text-sm text-indigo-800 mb-2">
              <strong>Estimated Delivery Date</strong> = Production Start Date + Production Days + Shipping Days
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div className="p-2 bg-white rounded border border-indigo-200">
                <div className="flex items-center gap-2 text-blue-700 font-medium text-sm">
                  <Plane className="w-4 h-4" />
                  Air Example
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  If production starts today with 25 production days:
                </p>
                <p className="text-xs font-medium text-gray-900 mt-1">
                  ETA: {new Date(Date.now() + (25 + parseInt(airShippingDays || '15')) * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </p>
              </div>
              <div className="p-2 bg-white rounded border border-indigo-200">
                <div className="flex items-center gap-2 text-cyan-700 font-medium text-sm">
                  <Ship className="w-4 h-4" />
                  Boat Example
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  If production starts today with 25 production days:
                </p>
                <p className="text-xs font-medium text-gray-900 mt-1">
                  ETA: {new Date(Date.now() + (25 + parseInt(boatShippingDays || '34')) * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Future Settings Placeholder */}
      <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-4 sm:p-6 text-center">
        <Settings className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-500 text-xs sm:text-sm">More settings coming soon...</p>
      </div>

      {/* Save Button */}
      <div className="mt-4 sm:mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto sm:ml-auto flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
              <span>{i18n.language === 'zh' ? '保存中...' : 'Saving...'}</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>{t('saveSettings')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}