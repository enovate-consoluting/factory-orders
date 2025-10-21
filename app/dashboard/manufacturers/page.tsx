'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Factory, Plus, Trash2, Mail, Edit2, Check, X } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Manufacturer {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export default function ManufacturersPage() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newManufacturer, setNewManufacturer] = useState({ name: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingManufacturer, setEditingManufacturer] = useState({ name: '', email: '' });

  useEffect(() => {
    fetchManufacturers();
  }, []);

  const fetchManufacturers = async () => {
    try {
      const { data, error } = await supabase
        .from('manufacturers')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setManufacturers(data || []);
    } catch (error) {
      console.error('Error fetching manufacturers:', error);
      showNotification('error', 'Failed to fetch manufacturers');
    }
  };

  const handleAddManufacturer = async () => {
    if (!newManufacturer.name.trim() || !newManufacturer.email.trim()) {
      showNotification('error', 'Please enter both name and email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newManufacturer.email)) {
      showNotification('error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('manufacturers')
        .insert([{
          name: newManufacturer.name.trim(),
          email: newManufacturer.email.trim().toLowerCase()
        }])
        .select();

      if (error) throw error;

      showNotification('success', 'Manufacturer added successfully');
      setNewManufacturer({ name: '', email: '' });
      setShowAddModal(false);
      fetchManufacturers();
    } catch (error: any) {
      console.error('Error adding manufacturer:', error);
      if (error.message?.includes('duplicate')) {
        showNotification('error', 'A manufacturer with this email already exists');
      } else {
        showNotification('error', 'Failed to add manufacturer');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteManufacturer = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('manufacturers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showNotification('success', 'Manufacturer deleted successfully');
      fetchManufacturers();
    } catch (error) {
      console.error('Error deleting manufacturer:', error);
      showNotification('error', 'Failed to delete manufacturer. They may have associated orders.');
    }
  };

  const startEditing = (manufacturer: Manufacturer) => {
    setEditingId(manufacturer.id);
    setEditingManufacturer({ name: manufacturer.name, email: manufacturer.email });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingManufacturer({ name: '', email: '' });
  };

  const saveEdit = async (id: string) => {
    if (!editingManufacturer.name.trim() || !editingManufacturer.email.trim()) {
      showNotification('error', 'Please enter both name and email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editingManufacturer.email)) {
      showNotification('error', 'Please enter a valid email address');
      return;
    }

    try {
      const { error } = await supabase
        .from('manufacturers')
        .update({
          name: editingManufacturer.name.trim(),
          email: editingManufacturer.email.trim().toLowerCase()
        })
        .eq('id', id);

      if (error) throw error;

      showNotification('success', 'Manufacturer updated successfully');
      setEditingId(null);
      fetchManufacturers();
    } catch (error) {
      console.error('Error updating manufacturer:', error);
      showNotification('error', 'Failed to update manufacturer');
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Manufacturer Configuration</h1>
        <p className="text-gray-600 text-sm sm:text-base">Manage manufacturer information and notification emails</p>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg ${
          notification.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Add Manufacturer Button */}
      <div className="mb-4 sm:mb-6">
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 shadow-sm text-sm sm:text-base"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          Add New Manufacturer
        </button>
      </div>

      {/* Manufacturers Table - Mobile Card View */}
      <div className="block sm:hidden space-y-3">
        {manufacturers.length === 0 ? (
          <div className="text-center p-8 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500">No manufacturers found. Add your first manufacturer to get started.</p>
          </div>
        ) : (
          manufacturers.map((manufacturer) => (
            <div key={manufacturer.id} className="bg-white rounded-lg border border-gray-200 p-4">
              {editingId === manufacturer.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editingManufacturer.name}
                    onChange={(e) => setEditingManufacturer({ ...editingManufacturer, name: e.target.value })}
                    className="w-full bg-gray-50 text-gray-800 px-3 py-2 rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
                    placeholder="Manufacturer name"
                  />
                  <input
                    type="email"
                    value={editingManufacturer.email}
                    onChange={(e) => setEditingManufacturer({ ...editingManufacturer, email: e.target.value })}
                    className="w-full bg-gray-50 text-gray-800 px-3 py-2 rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
                    placeholder="Email address"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => saveEdit(manufacturer.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-gray-800">{manufacturer.name}</p>
                      <p className="text-blue-600 text-sm">{manufacturer.email}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEditing(manufacturer)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteManufacturer(manufacturer.id, manufacturer.name)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Added {new Date(manufacturer.created_at).toLocaleDateString()}
                  </p>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Manufacturers Table - Desktop View */}
      <div className="hidden sm:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-4 text-gray-700 font-medium">
                  <div className="flex items-center gap-2">
                    <Factory className="w-4 h-4" />
                    Manufacturer Name
                  </div>
                </th>
                <th className="text-left p-4 text-gray-700 font-medium">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email Address
                  </div>
                </th>
                <th className="text-left p-4 text-gray-700 font-medium">Created</th>
                <th className="text-right p-4 text-gray-700 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {manufacturers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center p-8 text-gray-500">
                    No manufacturers found. Add your first manufacturer to get started.
                  </td>
                </tr>
              ) : (
                manufacturers.map((manufacturer) => (
                  <tr key={manufacturer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      {editingId === manufacturer.id ? (
                        <input
                          type="text"
                          value={editingManufacturer.name}
                          onChange={(e) => setEditingManufacturer({ ...editingManufacturer, name: e.target.value })}
                          className="bg-gray-50 text-gray-800 px-3 py-1 rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
                        />
                      ) : (
                        <span className="text-gray-800 font-medium">{manufacturer.name}</span>
                      )}
                    </td>
                    <td className="p-4">
                      {editingId === manufacturer.id ? (
                        <input
                          type="email"
                          value={editingManufacturer.email}
                          onChange={(e) => setEditingManufacturer({ ...editingManufacturer, email: e.target.value })}
                          className="bg-gray-50 text-gray-800 px-3 py-1 rounded border border-gray-300 focus:border-blue-500 focus:outline-none w-full max-w-xs"
                        />
                      ) : (
                        <span className="text-blue-600">{manufacturer.email}</span>
                      )}
                    </td>
                    <td className="p-4 text-gray-600">
                      {new Date(manufacturer.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        {editingId === manufacturer.id ? (
                          <>
                            <button
                              onClick={() => saveEdit(manufacturer.id)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditing(manufacturer)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteManufacturer(manufacturer.id, manufacturer.name)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Manufacturer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Add New Manufacturer</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">Manufacturer Name</label>
                <input
                  type="text"
                  value={newManufacturer.name}
                  onChange={(e) => setNewManufacturer({ ...newManufacturer, name: e.target.value })}
                  className="w-full bg-white text-gray-800 px-3 sm:px-4 py-2 rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
                  placeholder="Enter manufacturer name"
                />
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">Email Address</label>
                <input
                  type="email"
                  value={newManufacturer.email}
                  onChange={(e) => setNewManufacturer({ ...newManufacturer, email: e.target.value })}
                  className="w-full bg-white text-gray-800 px-3 sm:px-4 py-2 rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
                  placeholder="manufacturer@example.com"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewManufacturer({ name: '', email: '' });
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddManufacturer}
                disabled={loading}
                className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Manufacturer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}