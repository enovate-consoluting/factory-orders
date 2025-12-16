'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Edit2, Trash2, X, Shield, User as UserIcon, CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'

interface User {
  id: string
  email: string
  name: string
  role: string
  created_at: string
  phone_number?: string
}

interface Notification {
  id: string
  type: 'success' | 'error' | 'info'
  title: string
  message: string
}

// IMPORTANT: Dark text for all inputs and selects
const inputClassName = "w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
const selectClassName = "w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [createdCredentials, setCreatedCredentials] = useState({ email: '', password: '', name: '' })
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: '',
    password: 'password123',
    phone_number: ''
  })
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [notification, setNotification] = useState<Notification | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const user = JSON.parse(userData)
      // Redirect sub_manufacturer and manufacturer_team_member roles
      if (user.role === 'sub_manufacturer' || user.role === 'manufacturer_team_member') {
        window.location.href = '/dashboard/orders'
        return
      }
      setCurrentUser(user)
    }
  }, [])

  useEffect(() => {
    if (currentUser) {
      fetchUsers()
    }
  }, [currentUser])

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

  const showNotification = (type: 'success' | 'error' | 'info', title: string, message: string) => {
    const id = Date.now().toString()
    setNotification({ id, type, title, message })
  }

  const fetchUsers = async () => {
    try {
      let data, error;
      console.log("currentUser" + currentUser.manufacturer_id);
      if (currentUser?.role === 'manufacturer' || currentUser?.role === 'manufacturer_team_member') {
        // Always use manufacturer id for filtering
        const manufacturerId = currentUser.manufacturer_id || currentUser.id;
        const response = await supabase
          .from('users')
          .select('*')
          .eq('created_by', manufacturerId)
          .order('created_at', { ascending: false });
        // Only show users with created_by set (exclude nulls)
        data = (response.data || []).filter(u => u.created_by && u.created_by === manufacturerId);
        error = response.error;
      } else {
        const response = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });
        // Filter out manufacturer_team_member and sub_manufacturer for super admin
        data = (response.data || []).filter(u =>
          u.role !== 'manufacturer_team_member' && u.role !== 'sub_manufacturer'
        );
        error = response.error;
      }
      if (error) {
        console.error('Error fetching users:', error)
      }
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    
    try {
      if (editingUser) {
        // Update existing user via API
        const response = await fetch('/api/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: editingUser.id,
            updates: {
              name: formData.name,
              role: formData.role,
              phone_number: formData.phone_number
            },
            userType: 'admin'
          })
        })

        const result = await response.json()
        if (!response.ok) throw new Error(result.error)

        showNotification('success', 'User Updated', `${formData.name} has been updated successfully.`)
        setShowModal(false)
      } else {
            // Create new user via API
            const payload: any = {
              email: formData.email,
              password: formData.password,
              name: formData.name,
              role: formData.role,
              phone_number: formData.phone_number,
              userType: 'admin'
            };
            // If manufacturer, set createdBy to manufacturer id (not user id)
            if (currentUser?.role === 'manufacturer') {
              payload.createdBy = currentUser.manufacturer_id || currentUser.id;
            }
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        const result = await response.json()
        
        if (!response.ok) {
          // Handle specific error cases with inline error only
          if (result.error?.includes('already registered') || result.error?.includes('already exists')) {
            setFormError(`The email ${formData.email} is already registered. Please use a different email address.`)
          } else if (result.error?.includes('password')) {
            setFormError('Password must be at least 6 characters long.')
          } else {
            setFormError(result.error || 'Failed to create user. Please try again.')
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

      setEditingUser(null)
      setFormData({
        email: '',
        name: '',
        role: 'admin',
        password: 'password123',
        phone_number: ''
      })
      fetchUsers()
    } catch (error: any) {
      console.error('Error saving user:', error)
    } finally {
      setCreating(false)
    }
  }

  const confirmDelete = (user: User) => {
    if (user.id === currentUser?.id) {
      showNotification('error', 'Cannot Delete', "You cannot delete your own account.")
      return
    }
    setUserToDelete(user)
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!userToDelete) return
    setDeleting(true)
    try {
      const response = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: userToDelete.id,
          userType: 'admin'
        })
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      showNotification('success', 'User Deleted', `${userToDelete.name} has been removed successfully.`)
      setShowDeleteModal(false)
      fetchUsers()
    } catch (error: any) {
      console.error('Error deleting user:', error)
      showNotification('error', 'Deletion Failed', error.message || 'Failed to delete user. Please try again.')
    } finally {
      setDeleting(false)
      setUserToDelete(null)
    }
  }

  const openEditModal = (user: User) => {
    setEditingUser(user)
    setFormError(null)
    setFormData({
      email: user.email,
      name: user.name,
      role: user.role,
      password: 'password123',
      phone_number: user.phone_number || ''
    })
    setShowModal(true)
  }

  const openCreateModal = () => {
    setEditingUser(null)
    setFormError(null)
    setFormData({
      email: '',
      name: '',
      role: currentUser?.role === 'manufacturer' ? 'manufacturer_team_member' : 'admin',
      password: 'password123',
      phone_number: ''
    })
    setShowModal(true)
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-red-100 text-red-700'
      case 'admin':
        return 'bg-blue-100 text-blue-700'
      case 'order_creator':
        return 'bg-green-100 text-green-700'
      case 'order_approver':
        return 'bg-purple-100 text-purple-700'
      case 'warehouse':
        return 'bg-amber-100 text-amber-700'
      case 'manufacturer_inventory_manager':
        return 'bg-indigo-100 text-indigo-700'
      case 'manufacturer_team_member':
        return 'bg-cyan-100 text-cyan-700'
      case 'sub_manufacturer':
        return 'bg-teal-100 text-teal-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const formatRole = (role: string) => {
    return role.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showNotification('info', 'Copied!', 'Credentials copied to clipboard')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading users...</div>
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-6">
      {/* Notification Toast - Mobile Responsive - z-[60] to appear above modals */}
      {notification && (
        <div className={`fixed top-3 right-3 sm:top-4 sm:right-4 z-[60] animate-slide-in max-w-[calc(100vw-24px)] sm:max-w-md`}>
          <div className={`rounded-lg shadow-lg p-3 sm:p-4 flex items-start space-x-2 sm:space-x-3 ${
            notification.type === 'success' ? 'bg-green-50 border border-green-200' :
            notification.type === 'error' ? 'bg-red-50 border border-red-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex-shrink-0">
              {notification.type === 'success' && <CheckCircle className="h-5 w-5 text-green-600" />}
              {notification.type === 'error' && <XCircle className="h-5 w-5 text-red-600" />}
              {notification.type === 'info' && <AlertCircle className="h-5 w-5 text-blue-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm sm:text-base font-medium break-words ${
                notification.type === 'success' ? 'text-green-900' :
                notification.type === 'error' ? 'text-red-900' :
                'text-blue-900'
              }`}>
                {notification.title}
              </p>
              <p className={`text-xs sm:text-sm mt-1 break-words ${
                notification.type === 'success' ? 'text-green-700' :
                notification.type === 'error' ? 'text-red-700' :
                'text-blue-700'
              }`}>
                {notification.message}
              </p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="flex-shrink-0 ml-2"
            >
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
        </div>
      )}

      {/* Header - Mobile Responsive */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">System Users</h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              Manage admin and staff user accounts
            </p>
          </div>
          {(currentUser?.role === 'super_admin' || currentUser?.role === 'manufacturer') && (
            <button
              onClick={openCreateModal}
              className="w-full sm:w-auto px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add User
            </button>
          )}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              {(currentUser?.role === 'super_admin' || currentUser?.role === 'manufacturer') && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <UserIcon className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      {user.id === currentUser?.id && (
                        <span className="text-xs text-gray-500">(You)</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{user.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                    <Shield className="w-3 h-3 mr-1" />
                    {formatRole(user.role)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(user.created_at).toLocaleDateString()}</td>
                {(currentUser?.role === 'super_admin' || currentUser?.role === 'manufacturer') && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => openEditModal(user)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => confirmDelete(user)}
                      className="text-red-600 hover:text-red-900"
                      disabled={user.id === currentUser?.id}
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="text-center py-12">
            <UserIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No users yet</h3>
            <p className="text-gray-500">Get started by adding your first user</p>
          </div>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="block md:hidden space-y-3">
        {users.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 text-center py-12 px-4">
            <UserIcon className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-2">No users yet</h3>
            <p className="text-sm text-gray-500">Get started by adding your first user</p>
          </div>
        ) : (
          users.map((user) => (
            <div key={user.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900 break-words">{user.name}</div>
                    {user.id === currentUser?.id && (
                      <span className="text-xs text-gray-500">(You)</span>
                    )}
                  </div>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)} whitespace-nowrap ml-2`}>
                  <Shield className="w-3 h-3 mr-1" />
                  {formatRole(user.role)}
                </span>
              </div>

              <div className="space-y-2 mb-3">
                <div className="text-xs sm:text-sm text-gray-600 break-all">
                  <span className="font-medium text-gray-700">Email:</span> {user.email}
                </div>
                <div className="text-xs sm:text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Created:</span> {new Date(user.created_at).toLocaleDateString()}
                </div>
              </div>

              {(currentUser?.role === 'super_admin' || currentUser?.role === 'manufacturer') && (
                <div className="flex gap-2 pt-3 border-t border-gray-200">
                  <button
                    onClick={() => openEditModal(user)}
                    className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium flex items-center justify-center gap-1"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => confirmDelete(user)}
                    className="flex-1 px-3 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-1"
                    disabled={user.id === currentUser?.id}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Role Information - Mobile Responsive */}
      <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="text-xs sm:text-sm font-semibold text-blue-900 mb-2">User Role Information</h3>
        {currentUser?.role === 'manufacturer' ? (
          // Information for Manufacturers
          <>
            <ul className="space-y-1 text-xs sm:text-sm text-blue-800">
              <li>• <strong>Manufacturer Team Member:</strong> Can view and manage orders assigned to your manufacturing facility, handle product pricing, and communicate with admin</li>
              <li>• <strong>Sub-Manufacturer:</strong> Can view and process specific orders assigned to them by the manufacturer, with limited access to order details</li>
              <li>• <strong>Inventory Manager:</strong> Can manage accessories inventory only - add, edit, and track stock levels for client accessories</li>
            </ul>
            <p className="text-xs text-blue-700 mt-2 sm:mt-3">
              <strong>Note:</strong> Team members and sub-manufacturers will have access to orders and products relevant to your manufacturing operations. Inventory managers only see the Accessories inventory section.
            </p>
          </>
        ) : (
          // Information for Super Admin and others
          <>
            <ul className="space-y-1 text-xs sm:text-sm text-blue-800">
              <li>• <strong>Super Admin:</strong> Full system access, can manage all users and settings</li>
              <li>• <strong>Admin:</strong> Can manage orders, products, variants, and view reports</li>
              <li>• <strong>Order Creator:</strong> Can create and manage their own orders</li>
              <li>• <strong>Order Approver:</strong> Can approve and edit any order in the system</li>
              <li>• <strong>Warehouse:</strong> Can manage inventory - receive shipments, track stock, and archive picked up items</li>
            </ul>
            <p className="text-xs text-blue-700 mt-2 sm:mt-3">
              <strong>Note:</strong> Clients and Manufacturers are managed in their respective sections with their own login access.
            </p>
          </>
        )}
      </div>

      {/* Create/Edit Modal - Mobile Responsive */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingUser(null)
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
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={inputClassName}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value })
                      setFormError(null)
                    }}
                    className={inputClassName}
                    required
                    disabled={!!editingUser}
                  />
                  {editingUser && (
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed after creation</p>
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
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Role</label>
                  {currentUser?.role === 'manufacturer' ? (
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className={selectClassName}
                      required
                    >
                      <option value="manufacturer_team_member">Team Member</option>
                      <option value="sub_manufacturer">Sub-Manufacturer</option>
                      <option value="manufacturer_inventory_manager">Inventory Manager</option>
                    </select>
                  ) : (
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className={selectClassName}
                      required
                    >
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                      <option value="order_creator">Order Creator</option>
                      <option value="order_approver">Order Approver</option>
                      <option value="warehouse">Warehouse</option>
                    </select>
                  )}
                </div>
                {!editingUser && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Initial Password</label>
                    <input
                      type="text"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={inputClassName}
                      required
                      minLength={6}
                    />
                    <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
                  </div>
                )}
              </div>

              <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingUser(null)
                    setFormError(null)
                  }}
                  className="px-4 py-2 text-sm sm:text-base text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm sm:text-base bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg"
                  disabled={creating}
                >
                  {creating ? 'Creating...' : (editingUser ? 'Update' : 'Create')} User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-4 sm:p-6 shadow-2xl">
            <div className="flex items-start mb-4 sm:mb-6">
              <div className="flex-shrink-0">
                <div className="mx-auto flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-red-100">
                  <Trash2 className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                </div>
              </div>
              <div className="ml-3 sm:ml-4">
                <h3 className="text-base sm:text-lg font-medium text-gray-900">Delete User</h3>
                <div className="mt-1 sm:mt-2">
                  <p className="text-xs sm:text-sm text-gray-500">
                    Are you sure you want to delete <strong>{userToDelete.name}</strong>?
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
                  setUserToDelete(null)
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
                {deleting ? 'Deleting...' : 'Delete User'}
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
              <h2 className="text-base sm:text-xl font-semibold text-gray-900">User Created Successfully!</h2>
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