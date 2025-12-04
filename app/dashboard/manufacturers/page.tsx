'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Edit2, Trash2, X, Building2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'

interface Manufacturer {
  id: string
  name: string
  email: string
  user_id: string | null
  created_at: string
  phone_number?: string
}

interface Notification {
  id: string
  type: 'success' | 'error' | 'info'
  title: string
  message: string
}

// IMPORTANT: Dark text for all inputs
const inputClassName = "w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"

export default function ManufacturersPage() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [manufacturerToDelete, setManufacturerToDelete] = useState<Manufacturer | null>(null)
  const [createdCredentials, setCreatedCredentials] = useState({ email: '', password: '', name: '' })
  const [editingManufacturer, setEditingManufacturer] = useState<Manufacturer | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: 'password123',
    phone_number: ''
  })
  const [user, setUser] = useState<any>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [notification, setNotification] = useState<Notification | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      setUser(JSON.parse(userData))
    }
    fetchManufacturers()
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
      // Store original styles
      const originalStyle = window.getComputedStyle(document.body).overflow
      const originalPosition = window.getComputedStyle(document.body).position

      // Prevent scroll
      document.body.style.overflow = 'hidden'
      document.body.style.paddingRight = window.innerWidth - document.documentElement.clientWidth + 'px'

      return () => {
        // Restore original styles
        document.body.style.overflow = originalStyle
        document.body.style.paddingRight = ''
      }
    }
  }, [showModal, showDeleteModal, showSuccessModal])

  const showNotification = (type: 'success' | 'error' | 'info', title: string, message: string) => {
    const id = Date.now().toString()
    setNotification({ id, type, title, message })
  }

  const fetchManufacturers = async () => {
    try {
      const { data, error } = await supabase
        .from('manufacturers')
        .select('*')
        .order('name')

      if (error) {
        console.error('Error fetching manufacturers:', error)
      }
      setManufacturers(data || [])
    } catch (error) {
      console.error('Error fetching manufacturers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    
    try {
      if (editingManufacturer) {
        // If manufacturer has a user account, update via API
        if (editingManufacturer.user_id) {
          const response = await fetch('/api/users', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: editingManufacturer.user_id,
              updates: {
                name: formData.name,
                email: formData.email,
                phone_number: formData.phone_number
              },
              userType: 'manufacturer'
            })
          })

          const result = await response.json()
          if (!response.ok) throw new Error(result.error)
        } else {
          // Just update manufacturer record directly if no user account
          const { error } = await supabase
            .from('manufacturers')
            .update({
              name: formData.name,
              email: formData.email,
              phone_number: formData.phone_number
            })
            .eq('id', editingManufacturer.id)

          if (error) throw error
        }

        showNotification('success', 'Manufacturer Updated', `${formData.name} has been updated successfully.`)
        setShowModal(false)
      } else {
        // Create new manufacturer via API
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            name: formData.name,
            phone_number: formData.phone_number,
            role: 'manufacturer',
            userType: 'manufacturer'
          })
        })

        const result = await response.json()
        
        if (!response.ok) {
          // Handle specific error cases with inline error only
          if (result.error?.includes('already been registered') || result.error?.includes('already exists')) {
            setFormError(`The email ${formData.email} is already registered. Please use a different email address.`)
          } else if (result.error?.includes('password')) {
            setFormError('Password must be at least 6 characters long.')
          } else {
            setFormError(result.error || 'Failed to create manufacturer. Please try again.')
          }
          setCreating(false)
          return
        }

        // Show success modal with credentials
        setCreatedCredentials({ 
          email: formData.email, 
          password: formData.password,
          name: formData.name
        })
        setShowModal(false)
        setShowSuccessModal(true)
      }

      setEditingManufacturer(null)
      setFormData({
        name: '',
        email: '',
        password: 'password123',
        phone_number: ''
      })
      fetchManufacturers()
    } catch (error: any) {
      console.error('Error saving manufacturer:', error)
    } finally {
      setCreating(false)
    }
  }

  const checkManufacturerOrders = async (manufacturerId: string) => {
    const { data, error } = await supabase
      .from('orders')
      .select('id')
      .eq('manufacturer_id', manufacturerId)
      .limit(1)
    
    return (data && data.length > 0)
  }

  const confirmDelete = async (manufacturer: Manufacturer) => {
    // Check if manufacturer has orders
    const hasOrders = await checkManufacturerOrders(manufacturer.id)
    
    if (hasOrders) {
      showNotification('error', 'Cannot Delete', 
        `Cannot delete ${manufacturer.name} because they have existing orders. Please delete or reassign their orders first.`)
      return
    }
    
    setManufacturerToDelete(manufacturer)
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!manufacturerToDelete) return
    
    setDeleting(true)
    try {
      if (manufacturerToDelete.user_id) {
        // Delete via API if has user account
        const response = await fetch('/api/users', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId: manufacturerToDelete.user_id,
            userType: 'manufacturer'
          })
        })

        const result = await response.json()
        if (!response.ok) {
          // Handle foreign key constraint error
          if (result.error?.includes('foreign key') || result.error?.includes('violates')) {
            throw new Error(`Cannot delete ${manufacturerToDelete.name} because they have existing orders. Please delete or reassign their orders first.`)
          }
          throw new Error(result.error)
        }
      } else {
        // Just delete manufacturer record if no user account
        const { error } = await supabase
          .from('manufacturers')
          .delete()
          .eq('id', manufacturerToDelete.id)
        
        if (error) {
          // Handle foreign key constraint error
          if (error.message?.includes('foreign key') || error.message?.includes('violates')) {
            throw new Error(`Cannot delete ${manufacturerToDelete.name} because they have existing orders. Please delete or reassign their orders first.`)
          }
          throw error
        }
      }
      
      showNotification('success', 'Manufacturer Deleted', `${manufacturerToDelete.name} has been removed successfully.`)
      setShowDeleteModal(false)
      fetchManufacturers()
    } catch (error: any) {
      console.error('Error deleting manufacturer:', error)
      showNotification('error', 'Deletion Failed', error.message || 'Failed to delete manufacturer. Please try again.')
      setShowDeleteModal(false)
    } finally {
      setDeleting(false)
      setManufacturerToDelete(null)
    }
  }

  const openEditModal = (manufacturer: Manufacturer) => {
    setEditingManufacturer(manufacturer)
    setFormError(null)
    setFormData({
      name: manufacturer.name,
      email: manufacturer.email,
      password: 'password123',
      phone_number: manufacturer.phone_number || ''
    })
    setShowModal(true)
  }

  const openCreateModal = () => {
    setEditingManufacturer(null)
    setFormError(null)
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
        <div className="text-gray-500">Loading manufacturers...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Notification Toast - z-[60] to appear above modals */}
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

      <div className="mb-6">
        <div className="flex lg:justify-between lg:items-center lg:flex-row flex-col gap-4 items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manufacturers</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage manufacturer accounts with login access
            </p>
          </div>
          {(user?.role === 'super_admin' || user?.role === 'admin') && (
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Manufacturer
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {manufacturers.map((manufacturer) => (
          <div key={manufacturer.id} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{manufacturer.name}</h3>
                  <p className="text-sm text-gray-500">{manufacturer.email}</p>
                </div>
              </div>
              {(user?.role === 'super_admin') && (
                <button
                  onClick={() => window.location.href = `/dashboard/manufacturers/${manufacturer.id}`}
                  className="ml-2 p-2 bg-blue-50 hover:bg-blue-100 rounded-full"
                  title="View Users for Manufacturer"
                >
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                </button>
              )}
            </div>

            {(user?.role === 'super_admin' || user?.role === 'admin') && (
              <div className="flex gap-2 pt-3 border-t border-gray-200">
                <button
                  onClick={() => openEditModal(manufacturer)}
                  className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium flex items-center justify-center gap-1"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => confirmDelete(manufacturer)}
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

      {manufacturers.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No manufacturers yet</h3>
          <p className="text-gray-500 mb-4">Get started by adding your first manufacturer</p>
          {(user?.role === 'super_admin' || user?.role === 'admin') && (
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add First Manufacturer
            </button>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                {editingManufacturer ? 'Edit Manufacturer' : 'Add New Manufacturer'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingManufacturer(null)
                  setFormError(null)
                }}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0 ml-2"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Error Message Display */}
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
                      setFormError(null) // Clear error when user types
                    }}
                    className={inputClassName}
                    required
                    disabled={!!editingManufacturer}
                  />
                  {editingManufacturer && (
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

                {!editingManufacturer && (
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
                    setEditingManufacturer(null)
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
                  {creating ? 'Creating...' : (editingManufacturer ? 'Update' : 'Create')} Manufacturer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && manufacturerToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-4 sm:p-6 shadow-2xl">
            <div className="flex items-start mb-4 sm:mb-6">
              <div className="flex-shrink-0">
                <div className="mx-auto flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-red-100">
                  <Trash2 className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                </div>
              </div>
              <div className="ml-3 sm:ml-4">
                <h3 className="text-base sm:text-lg font-medium text-gray-900">Delete Manufacturer</h3>
                <div className="mt-1 sm:mt-2">
                  <p className="text-xs sm:text-sm text-gray-500">
                    Are you sure you want to delete <strong>{manufacturerToDelete.name}</strong>?
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
                  setManufacturerToDelete(null)
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
                {deleting ? 'Deleting...' : 'Delete Manufacturer'}
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
              <h2 className="text-base sm:text-xl font-semibold text-gray-900">Manufacturer Created Successfully!</h2>
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