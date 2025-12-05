/**
 * Clients Management Page - /dashboard/clients
 * Manage client accounts with search, edit, delete, and settings
 * Roles: Admin, Super Admin
 * Last Modified: December 2024
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Edit2, Trash2, X, Users, CheckCircle, XCircle, AlertCircle, Upload, Settings, Search } from 'lucide-react'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'

interface Client {
  id: string
  name: string
  email: string
  user_id: string | null
  created_at: string
  phone_number?: string
  logo_url?: string
  can_create_orders?: boolean
  custom_margin_percentage?: number | null
}

interface Notification {
  id: string
  type: 'success' | 'error' | 'info'
  title: string
  message: string
}

// IMPORTANT: Dark text for all inputs
const inputClassName = "w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"

export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null)
  const [createdCredentials, setCreatedCredentials] = useState({ email: '', password: '', name: '' })
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: 'password123',
    phone_number: ''
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [notification, setNotification] = useState<Notification | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  
  // NEW: Search state
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      setUser(JSON.parse(userData))
    }
    fetchClients()
  }, [])

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  // Prevent background scroll when any modal is open
  useEffect(() => {
    if (showModal || showDeleteModal || showSuccessModal) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
      document.documentElement.style.overflow = 'auto'
    }

    return () => {
      document.body.style.overflow = 'auto'
      document.documentElement.style.overflow = 'auto'
    }
  }, [showModal, showDeleteModal, showSuccessModal])

  // NEW: Filtered clients based on search
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients
    
    const query = searchQuery.toLowerCase()
    return clients.filter(client => 
      client.name.toLowerCase().includes(query) ||
      client.email.toLowerCase().includes(query) ||
      (client.phone_number && client.phone_number.includes(query))
    )
  }, [clients, searchQuery])

  const showNotification = (type: 'success' | 'error' | 'info', title: string, message: string) => {
    const id = Date.now().toString()
    setNotification({ id, type, title, message })
  }

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name')

      if (error) {
        console.error('Error fetching clients:', error)
      }
      setClients(data || [])
    } catch (error) {
      console.error('Error fetching clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        setFormError('Please select an image file (PNG, JPG, etc.)')
        return
      }
      if (file.size > 2 * 1024 * 1024) {
        setFormError('Logo file size must be less than 2MB')
        return
      }
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      setFormError(null)
    }
  }

  const uploadLogo = async (clientId: string, clientName: string): Promise<string | null> => {
    if (!logoFile) return null

    try {
      setUploading(true)
      const fileExt = logoFile.name.split('.').pop()
      const fileName = `${clientId}-${Date.now()}.${fileExt}`
      const filePath = fileName

      const { error: uploadError } = await supabase.storage
        .from('client-logos')
        .upload(filePath, logoFile, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage
        .from('client-logos')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error: any) {
      console.error('Error uploading logo:', error)
      showNotification('error', 'Upload Failed', 'Failed to upload logo. Please try again.')
      return null
    } finally {
      setUploading(false)
    }
  }

  const deleteLogo = async (logoUrl: string) => {
    try {
      const fileName = logoUrl.split('/').pop()
      if (!fileName) return

      const { error } = await supabase.storage
        .from('client-logos')
        .remove([fileName])

      if (error) {
        console.error('Error deleting logo:', error)
      }
    } catch (error) {
      console.error('Error deleting logo:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)

    try {
      if (editingClient) {
        let logoUrl = editingClient.logo_url
        if (logoFile) {
          const uploadedUrl = await uploadLogo(editingClient.id, formData.name)
          if (uploadedUrl) {
            if (editingClient.logo_url) {
              await deleteLogo(editingClient.logo_url)
            }
            logoUrl = uploadedUrl
          }
        }

        if (editingClient.user_id) {
          const response = await fetch('/api/users', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: editingClient.user_id,
              updates: {
                name: formData.name,
                email: formData.email,
                phone_number: formData.phone_number,
                logo_url: logoUrl
              },
              userType: 'client'
            })
          })

          const result = await response.json()
          if (!response.ok) throw new Error(result.error)
        } else {
          const { error } = await supabase
            .from('clients')
            .update({
              name: formData.name,
              email: formData.email,
              phone_number: formData.phone_number,
              logo_url: logoUrl
            })
            .eq('id', editingClient.id)

          if (error) throw error
        }

        showNotification('success', 'Client Updated', `${formData.name} has been updated successfully.`)
        setShowModal(false)
      } else {
        let logoBase64: string | null = null
        if (logoFile) {
          logoBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(logoFile)
          })
        }

        const response = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            name: formData.name,
            phone_number: formData.phone_number,
            logo: logoBase64,
            role: 'client',
            userType: 'client'
          })
        })

        const result = await response.json()

        if (!response.ok) {
          if (result.error?.includes('already been registered') || result.error?.includes('already exists')) {
            setFormError(`The email ${formData.email} is already registered. Please use a different email address.`)
          } else if (result.error?.includes('password')) {
            setFormError('Password must be at least 6 characters long.')
          } else {
            setFormError(result.error || 'Failed to create client. Please try again.')
          }
          setCreating(false)
          return
        }

        if (logoFile && result.user) {
          const { data: clientData } = await supabase
            .from('clients')
            .select('id')
            .eq('email', formData.email)
            .single()

          if (clientData) {
            const uploadedLogoUrl = await uploadLogo(clientData.id, formData.name)
            if (uploadedLogoUrl) {
              await supabase
                .from('clients')
                .update({ logo_url: uploadedLogoUrl })
                .eq('id', clientData.id)
              await supabase
                .from('users')
                .update({ logo_url: uploadedLogoUrl })
                .eq('id', result.user.id)
            }
          }
        }

        setCreatedCredentials({
          email: formData.email,
          password: formData.password,
          name: formData.name
        })
        setShowModal(false)
        setShowSuccessModal(true)
      }

      setEditingClient(null)
      setFormData({
        name: '',
        email: '',
        password: 'password123',
        phone_number: ''
      })
      setLogoFile(null)
      setLogoPreview(null)
      fetchClients()
    } catch (error: any) {
      console.error('Error saving client:', error)
    } finally {
      setCreating(false)
    }
  }

  const checkClientOrders = async (clientId: string) => {
    const { data, error } = await supabase
      .from('orders')
      .select('id')
      .eq('client_id', clientId)
      .limit(1)
    
    return (data && data.length > 0)
  }

  const confirmDelete = async (client: Client) => {
    const hasOrders = await checkClientOrders(client.id)
    
    if (hasOrders) {
      showNotification('error', 'Cannot Delete', 
        `Cannot delete ${client.name} because they have existing orders. Please delete or reassign their orders first.`)
      return
    }
    
    setClientToDelete(client)
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!clientToDelete) return
    
    setDeleting(true)
    try {
      if (clientToDelete.user_id) {
        const response = await fetch('/api/users', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId: clientToDelete.user_id,
            userType: 'client'
          })
        })

        const result = await response.json()
        if (!response.ok) {
          if (result.error?.includes('foreign key') || result.error?.includes('violates')) {
            throw new Error(`Cannot delete ${clientToDelete.name} because they have existing orders. Please delete or reassign their orders first.`)
          }
          throw new Error(result.error)
        }
      } else {
        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('id', clientToDelete.id)
        
        if (error) {
          if (error.message?.includes('foreign key') || error.message?.includes('violates')) {
            throw new Error(`Cannot delete ${clientToDelete.name} because they have existing orders. Please delete or reassign their orders first.`)
          }
          throw error
        }
      }

      if (clientToDelete.logo_url) {
        await deleteLogo(clientToDelete.logo_url)
      }

      showNotification('success', 'Client Deleted', `${clientToDelete.name} has been removed successfully.`)
      setShowDeleteModal(false)
      fetchClients()
    } catch (error: any) {
      console.error('Error deleting client:', error)
      showNotification('error', 'Deletion Failed', error.message || 'Failed to delete client. Please try again.')
      setShowDeleteModal(false)
    } finally {
      setDeleting(false)
      setClientToDelete(null)
    }
  }

  const openEditModal = (client: Client) => {
    setEditingClient(client)
    setFormError(null)
    setFormData({
      name: client.name,
      email: client.email,
      password: 'password123',
      phone_number: client.phone_number || ''
    })
    setLogoFile(null)
    setLogoPreview(client.logo_url || null)
    setShowModal(true)
  }

  const openCreateModal = () => {
    setEditingClient(null)
    setFormError(null)
    setLogoFile(null)
    setLogoPreview(null)
    setFormData({ name: '', email: '', password: 'password123', phone_number: '' })
    setShowModal(true)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showNotification('info', 'Copied!', 'Credentials copied to clipboard')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading clients...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-[60] animate-slide-in`}>
          <div className={`rounded-lg shadow-lg p-4 max-w-md flex items-start space-x-3 ${
            notification.type === 'success' ? 'bg-green-50 border border-green-200' :
            notification.type === 'error' ? 'bg-red-50 border border-red-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex-shrink-0">
              {notification.type === 'success' && <CheckCircle className="h-5 w-5 text-green-600" />}
              {notification.type === 'error' && <XCircle className="h-5 w-5 text-red-600" />}
              {notification.type === 'info' && <AlertCircle className="h-5 w-5 text-blue-600" />}
            </div>
            <div className="flex-1">
              <p className={`font-medium ${
                notification.type === 'success' ? 'text-green-900' :
                notification.type === 'error' ? 'text-red-900' :
                'text-blue-900'
              }`}>
                {notification.title}
              </p>
              <p className={`text-sm mt-1 ${
                notification.type === 'success' ? 'text-green-700' :
                notification.type === 'error' ? 'text-red-700' :
                'text-blue-700'
              }`}>
                {notification.message}
              </p>
            </div>
            <button onClick={() => setNotification(null)} className="flex-shrink-0 ml-2">
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex lg:justify-between lg:items-center lg:flex-row flex-col gap-4 items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage client accounts with login access
            </p>
          </div>
          {(user?.role === 'super_admin' || user?.role === 'admin') && (
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Client
            </button>
          )}
        </div>
      </div>

      {/* NEW: Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="text-sm text-gray-500 mt-2">
            Found {filteredClients.length} of {clients.length} clients
          </p>
        )}
      </div>

      {/* Client Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((client) => (
          <div key={client.id} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center overflow-hidden">
                  {client.logo_url ? (
                    <img
                      src={client.logo_url}
                      alt={`${client.name} logo`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Users className="w-5 h-5 text-green-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{client.name}</h3>
                  <p className="text-sm text-gray-500">{client.email}</p>
                </div>
              </div>
              
              {/* NEW: Settings Gear Icon */}
              {(user?.role === 'super_admin' || user?.role === 'admin') && (
                <button
                  onClick={() => router.push(`/dashboard/clients/${client.id}/settings`)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Client Settings"
                >
                  <Settings className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap gap-2 mb-3">
              {client.can_create_orders && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  Can Create Orders
                </span>
              )}
              {client.custom_margin_percentage !== null && client.custom_margin_percentage !== undefined && user?.role === 'super_admin' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                  {client.custom_margin_percentage}% Margin
                </span>
              )}
            </div>

            {(user?.role === 'super_admin' || user?.role === 'admin') && (
              <div className="flex gap-2 pt-3 border-t border-gray-200">
                <button
                  onClick={() => openEditModal(client)}
                  className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium flex items-center justify-center gap-1"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => confirmDelete(client)}
                  className="flex-1 px-3 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty States */}
      {clients.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No clients yet</h3>
          <p className="text-gray-500 mb-4">Get started by adding your first client</p>
          {(user?.role === 'super_admin' || user?.role === 'admin') && (
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add First Client
            </button>
          )}
        </div>
      )}

      {clients.length > 0 && filteredClients.length === 0 && searchQuery && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No clients found</h3>
          <p className="text-gray-500 mb-4">No clients match "{searchQuery}"</p>
          <button
            onClick={() => setSearchQuery('')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                {editingClient ? 'Edit Client' : 'Add New Client'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingClient(null)
                  setFormError(null)
                }}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0 ml-2"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {formError && (
                <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
                  <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-xs sm:text-sm text-red-700">{formError}</p>
                </div>
              )}

              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={inputClassName}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value })
                      setFormError(null)
                    }}
                    className={inputClassName}
                    required
                    disabled={!!editingClient}
                  />
                  {editingClient && (
                    <p className="text-xs text-gray-500 mt-1">
                      Email cannot be changed after creation
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Phone Number
                  </label>
                  <PhoneInput
                    country={'us'}
                    value={formData.phone_number}
                    onChange={(phone) => setFormData({ ...formData, phone_number: phone })}
                    inputStyle={{
                      width: '100%',
                      height: '42px',
                      fontSize: '14px',
                      paddingLeft: '48px',
                      borderRadius: '0.5rem',
                      border: '1px solid #d1d5db',
                      color: '#111827'
                    }}
                    buttonStyle={{
                      borderRadius: '0.5rem 0 0 0.5rem',
                      border: '1px solid #d1d5db',
                      borderRight: 'none'
                    }}
                    containerStyle={{
                      width: '100%'
                    }}
                    dropdownStyle={{
                      color: '#111827',
                      backgroundColor: '#ffffff'
                    }}
                    searchStyle={{
                      width: '100%',
                      padding: '8px',
                      color: '#111827',
                      backgroundColor: '#ffffff'
                    }}
                    enableSearch={true}
                    searchPlaceholder="Search countries..."
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Company Logo (Optional)
                  </label>
                  <div className="flex items-center gap-3 sm:gap-4">
                    {logoPreview && (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 border-2 border-gray-200 rounded-lg overflow-hidden flex items-center justify-center bg-gray-50 flex-shrink-0">
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <label className="cursor-pointer">
                        <div className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors">
                          <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 flex-shrink-0" />
                          <span className="text-xs sm:text-sm text-gray-600 truncate">
                            {logoFile ? logoFile.name : 'Choose logo image'}
                          </span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoChange}
                          className="hidden"
                        />
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        PNG, JPG up to 2MB
                      </p>
                    </div>
                  </div>
                </div>

                {!editingClient && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Initial Password
                    </label>
                    <input
                      type="text"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={inputClassName}
                      required
                      minLength={6}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Minimum 6 characters
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingClient(null)
                    setFormError(null)
                  }}
                  className="px-4 py-2 text-sm sm:text-base bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm sm:text-base bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg"
                  disabled={creating}
                >
                  {creating ? 'Creating...' : (editingClient ? 'Update' : 'Create')} Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && clientToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-4 sm:p-6 shadow-2xl">
            <div className="flex items-start mb-4 sm:mb-6">
              <div className="flex-shrink-0">
                <div className="mx-auto flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-red-100">
                  <Trash2 className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                </div>
              </div>
              <div className="ml-3 sm:ml-4">
                <h3 className="text-base sm:text-lg font-medium text-gray-900">Delete Client</h3>
                <div className="mt-1 sm:mt-2">
                  <p className="text-xs sm:text-sm text-gray-500">
                    Are you sure you want to delete <strong>{clientToDelete.name}</strong>?
                    This action cannot be undone and will permanently remove their access to the system.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 sm:mt-5 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false)
                  setClientToDelete(null)
                }}
                className="px-4 py-2 text-sm sm:text-base text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm sm:text-base bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal with Credentials */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center mb-4 sm:mb-6">
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-500 mr-2 sm:mr-3 flex-shrink-0" />
              <h2 className="text-base sm:text-xl font-semibold text-gray-900">Client Created Successfully!</h2>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
              <p className="text-xs sm:text-sm text-gray-700 mb-2 sm:mb-3">
                Please share these credentials with <strong>{createdCredentials.name}</strong>:
              </p>
              <div className="space-y-2">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs sm:text-sm text-gray-600">Email:</span>
                  <code className="bg-white px-2 py-1 rounded text-xs sm:text-sm truncate max-w-[60%]">{createdCredentials.email}</code>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs sm:text-sm text-gray-600">Password:</span>
                  <code className="bg-white px-2 py-1 rounded text-xs sm:text-sm">{createdCredentials.password}</code>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <button
                onClick={() => {
                  copyToClipboard(`Email: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`)
                }}
                className="px-4 py-2 text-sm sm:text-base bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Copy Credentials
              </button>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}