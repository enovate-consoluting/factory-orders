'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Edit2, Trash2, X, Users, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

interface Client {
  id: string
  name: string
  email: string
  user_id: string | null
  created_at: string
}

interface Notification {
  id: string
  type: 'success' | 'error' | 'info'
  title: string
  message: string
}

// IMPORTANT: Dark text for all inputs
const inputClassName = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"

export default function ClientsPage() {
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
    password: 'password123'
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    
    try {
      if (editingClient) {
        // If client has a user account, update via API
        if (editingClient.user_id) {
          const response = await fetch('/api/users', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: editingClient.user_id,
              updates: {
                name: formData.name,
                email: formData.email
              },
              userType: 'client'
            })
          })

          const result = await response.json()
          if (!response.ok) throw new Error(result.error)
        } else {
          // Just update client record directly if no user account
          const { error } = await supabase
            .from('clients')
            .update({
              name: formData.name,
              email: formData.email
            })
            .eq('id', editingClient.id)

          if (error) throw error
        }

        showNotification('success', 'Client Updated', `${formData.name} has been updated successfully.`)
        setShowModal(false)
      } else {
        // Create new client via API
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            name: formData.name,
            role: 'client',
            userType: 'client'
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
            setFormError(result.error || 'Failed to create client. Please try again.')
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

      setEditingClient(null)
      setFormData({
        name: '',
        email: '',
        password: 'password123'
      })
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
    // Check if client has orders
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
        // Delete via API if has user account
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
          // Handle foreign key constraint error
          if (result.error?.includes('foreign key') || result.error?.includes('violates')) {
            throw new Error(`Cannot delete ${clientToDelete.name} because they have existing orders. Please delete or reassign their orders first.`)
          }
          throw new Error(result.error)
        }
      } else {
        // Just delete client record if no user account
        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('id', clientToDelete.id)
        
        if (error) {
          // Handle foreign key constraint error
          if (error.message?.includes('foreign key') || error.message?.includes('violates')) {
            throw new Error(`Cannot delete ${clientToDelete.name} because they have existing orders. Please delete or reassign their orders first.`)
          }
          throw error
        }
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
      password: 'password123'
    })
    setShowModal(true)
  }

  const openCreateModal = () => {
    setEditingClient(null)
    setFormError(null)
    setFormData({ name: '', email: '', password: 'password123' })
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
        <div className="flex justify-between items-center">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((client) => (
          <div key={client.id} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{client.name}</h3>
                  <p className="text-sm text-gray-500">{client.email}</p>
                </div>
              </div>
            </div>

            {(user?.role === 'super_admin' || user?.role === 'admin') && (
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => openEditModal(client)}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => confirmDelete(client)}
                  className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingClient ? 'Edit Client' : 'Add New Client'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingClient(null)
                  setFormError(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Error Message Display */}
              {formError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
                  <XCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{formError}</p>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    disabled={!!editingClient}
                  />
                  {editingClient && (
                    <p className="text-xs text-gray-500 mt-1">
                      Email cannot be changed after creation
                    </p>
                  )}
                </div>

                {!editingClient && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingClient(null)
                    setFormError(null)
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Delete Client</h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Are you sure you want to delete <strong>{clientToDelete.name}</strong>? 
                    This action cannot be undone and will permanently remove their access to the system.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false)
                  setClientToDelete(null)
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
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
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-500 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Client Created Successfully!</h2>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700 mb-3">
                Please share these credentials with <strong>{createdCredentials.name}</strong>:
              </p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Email:</span>
                  <code className="bg-white px-2 py-1 rounded text-sm">{createdCredentials.email}</code>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Password:</span>
                  <code className="bg-white px-2 py-1 rounded text-sm">{createdCredentials.password}</code>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  copyToClipboard(`Email: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`)
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Copy Credentials
              </button>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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