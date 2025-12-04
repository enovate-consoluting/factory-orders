/**
 * Client Settings Page - /dashboard/clients/[id]/settings
 * Configure client permissions and custom pricing margins
 * Roles: Admin (partial), Super Admin (full)
 * Last Modified: December 2024
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft, 
  Save, 
  Users, 
  ShoppingCart, 
  DollarSign, 
  Percent,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info
} from 'lucide-react'

interface Client {
  id: string
  name: string
  email: string
  logo_url?: string
  can_create_orders: boolean
  custom_margin_percentage: number | null
  custom_shipping_margin_percentage: number | null
}

interface FinanceSettings {
  default_product_margin_percentage: number
  default_shipping_margin_percentage: number
}

const inputClassName = "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"

export default function ClientSettingsPage() {
  const router = useRouter()
  const params = useParams()
  const clientId = params.id as string

  const [user, setUser] = useState<any>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [financeSettings, setFinanceSettings] = useState<FinanceSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  // Form state
  const [canCreateOrders, setCanCreateOrders] = useState(false)
  const [useCustomProductMargin, setUseCustomProductMargin] = useState(false)
  const [customProductMargin, setCustomProductMargin] = useState<string>('')
  const [useCustomShippingMargin, setUseCustomShippingMargin] = useState(false)
  const [customShippingMargin, setCustomShippingMargin] = useState<string>('')

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (!userData) {
      router.push('/')
      return
    }
    
    const parsedUser = JSON.parse(userData)
    if (!['super_admin', 'admin'].includes(parsedUser.role)) {
      router.push('/dashboard')
      return
    }
    
    setUser(parsedUser)
    loadData()
  }, [clientId])

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  const loadData = async () => {
    try {
      // Load client
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()

      if (clientError || !clientData) {
        console.error('Error loading client:', clientError)
        router.push('/dashboard/clients')
        return
      }

      setClient(clientData)
      setCanCreateOrders(clientData.can_create_orders || false)
      
      if (clientData.custom_margin_percentage !== null) {
        setUseCustomProductMargin(true)
        setCustomProductMargin(clientData.custom_margin_percentage.toString())
      }
      
      if (clientData.custom_shipping_margin_percentage !== null) {
        setUseCustomShippingMargin(true)
        setCustomShippingMargin(clientData.custom_shipping_margin_percentage.toString())
      }

      // Load finance settings for default values display
      const { data: financeData } = await supabase
        .from('finance_settings')
        .select('*')
        .single()

      if (financeData) {
        setFinanceSettings({
          default_product_margin_percentage: financeData.default_product_margin_percentage || 80,
          default_shipping_margin_percentage: financeData.default_shipping_margin_percentage || 5
        })
      } else {
        setFinanceSettings({
          default_product_margin_percentage: 80,
          default_shipping_margin_percentage: 5
        })
      }

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)

    try {
      const updates: any = {
        can_create_orders: canCreateOrders
      }

      // Only super_admin can set custom margins
      if (user?.role === 'super_admin') {
        updates.custom_margin_percentage = useCustomProductMargin && customProductMargin 
          ? parseFloat(customProductMargin) 
          : null
        
        updates.custom_shipping_margin_percentage = useCustomShippingMargin && customShippingMargin
          ? parseFloat(customShippingMargin)
          : null
      }

      const { error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', clientId)

      if (error) throw error

      setNotification({ type: 'success', message: 'Settings saved successfully!' })
      
      // Reload client data
      loadData()

    } catch (error: any) {
      console.error('Error saving settings:', error)
      setNotification({ type: 'error', message: error.message || 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading client settings...</div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Client not found</h3>
          <button
            onClick={() => router.push('/dashboard/clients')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Back to Clients
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 rounded-lg shadow-lg p-4 flex items-center gap-2 ${
          notification.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600" />
          )}
          <span className={notification.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {notification.message}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard/clients')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Clients
        </button>

        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center overflow-hidden">
            {client.logo_url ? (
              <img src={client.logo_url} alt={client.name} className="w-full h-full object-cover" />
            ) : (
              <Users className="w-6 h-6 text-green-600" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
            <p className="text-gray-500">{client.email}</p>
          </div>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        
        {/* Order Permissions */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Order Permissions</h2>
              <p className="text-sm text-gray-500">Control what this client can do in the system</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={canCreateOrders}
                onChange={(e) => setCanCreateOrders(e.target.checked)}
                className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="font-medium text-gray-900">Allow client to create order requests</span>
                <p className="text-sm text-gray-500 mt-0.5">
                  Client can submit order requests that you review and approve. They can select from existing products and enter quantities.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Custom Pricing - Super Admin Only */}
        {user?.role === 'super_admin' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Custom Pricing</h2>
                <p className="text-sm text-gray-500">Override default margins for this client</p>
              </div>
            </div>

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">How it works:</p>
                <p className="mt-1">
                  When manufacturer costs come in, the system adds your margin percentage to calculate client prices. 
                  Default is {financeSettings?.default_product_margin_percentage || 80}% for products and {financeSettings?.default_shipping_margin_percentage || 5}% for shipping.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Product Margin */}
              <div className="border border-gray-200 rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    checked={useCustomProductMargin}
                    onChange={(e) => {
                      setUseCustomProductMargin(e.target.checked)
                      if (!e.target.checked) setCustomProductMargin('')
                    }}
                    className="mt-1 w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <div>
                    <span className="font-medium text-gray-900">Custom Product Margin</span>
                    <p className="text-sm text-gray-500">
                      Override the default {financeSettings?.default_product_margin_percentage || 80}% product margin
                    </p>
                  </div>
                </label>

                {useCustomProductMargin && (
                  <div className="ml-8">
                    <div className="flex items-center gap-2 max-w-xs">
                      <input
                        type="number"
                        value={customProductMargin}
                        onChange={(e) => setCustomProductMargin(e.target.value)}
                        placeholder="e.g., 50"
                        min="0"
                        max="200"
                        step="1"
                        className={inputClassName}
                      />
                      <Percent className="w-5 h-5 text-gray-400" />
                    </div>
                    {customProductMargin && (
                      <p className="text-sm text-gray-500 mt-2">
                        Example: $100 cost → ${(100 * (1 + parseFloat(customProductMargin) / 100)).toFixed(2)} client price
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Shipping Margin */}
              <div className="border border-gray-200 rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    checked={useCustomShippingMargin}
                    onChange={(e) => {
                      setUseCustomShippingMargin(e.target.checked)
                      if (!e.target.checked) setCustomShippingMargin('')
                    }}
                    className="mt-1 w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <div>
                    <span className="font-medium text-gray-900">Custom Shipping Margin</span>
                    <p className="text-sm text-gray-500">
                      Override the default {financeSettings?.default_shipping_margin_percentage || 5}% shipping margin
                    </p>
                  </div>
                </label>

                {useCustomShippingMargin && (
                  <div className="ml-8">
                    <div className="flex items-center gap-2 max-w-xs">
                      <input
                        type="number"
                        value={customShippingMargin}
                        onChange={(e) => setCustomShippingMargin(e.target.value)}
                        placeholder="e.g., 3"
                        min="0"
                        max="100"
                        step="0.5"
                        className={inputClassName}
                      />
                      <Percent className="w-5 h-5 text-gray-400" />
                    </div>
                    {customShippingMargin && (
                      <p className="text-sm text-gray-500 mt-2">
                        Example: $500 shipping → ${(500 * (1 + parseFloat(customShippingMargin) / 100)).toFixed(2)} client price
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Current Values Summary */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">Current margins for {client.name}:</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Product: </span>
                  <span className="font-medium text-gray-900">
                    {useCustomProductMargin && customProductMargin 
                      ? `${customProductMargin}% (custom)` 
                      : `${financeSettings?.default_product_margin_percentage || 80}% (default)`
                    }
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Shipping: </span>
                  <span className="font-medium text-gray-900">
                    {useCustomShippingMargin && customShippingMargin 
                      ? `${customShippingMargin}% (custom)` 
                      : `${financeSettings?.default_shipping_margin_percentage || 5}% (default)`
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => router.push('/dashboard/clients')}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
