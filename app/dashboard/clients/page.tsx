'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { User, Plus, Trash2, Mail, Edit2, Check, X } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Client {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState({ name: '', email: '' });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      showNotification('error', 'Failed to fetch clients');
    }
  };

  const handleAddClient = async () => {
    if (!newClient.name.trim() || !newClient.email.trim()) {
      showNotification('error', 'Please enter both name and email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newClient.email)) {
      showNotification('error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert([{
          name: newClient.name.trim(),
          email: newClient.email.trim().toLowerCase()
        }])
        .select();

      if (error) throw error;

      showNotification('success', 'Client added successfully');
      setNewClient({ name: '', email: '' });
      setShowAddModal(false);
      fetchClients();
    } catch (error: any) {
      console.error('Error adding client:', error);
      if (error.message?.includes('duplicate')) {
        showNotification('error', 'A client with this email already exists');
      } else {
        showNotification('error', 'Failed to add client');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showNotification('success', 'Client deleted successfully');
      fetchClients();
    } catch (error) {
      console.error('Error deleting client:', error);
      showNotification('error', 'Failed to delete client. They may have associated orders.');
    }
  };

  const startEditing = (client: Client) => {
    setEditingId(client.id);
    setEditingClient({ name: client.name, email: client.email });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingClient({ name: '', email: '' });
  };

  const saveEdit = async (id: string) => {
    if (!editingClient.name.trim() || !editingClient.email.trim()) {
      showNotification('error', 'Please enter both name and email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editingClient.email)) {
      showNotification('error', 'Please enter a valid email address');
      return;
    }

    try {
      const { error } = await supabase
        .from('clients')
        .update({
          name: editingClient.name.trim(),
          email: editingClient.email.trim().toLowerCase()
        })
        .eq('id', id);

      if (error) throw error;

      showNotification('success', 'Client updated successfully');
      setEditingId(null);
      fetchClients();
    } catch (error) {
      console.error('Error updating client:', error);
      showNotification('error', 'Failed to update client');
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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Client Configuration</h1>
        <p className="text-gray-600 text-sm sm:text-base">Manage client information and notification emails</p>
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

      {/* Add Client Button */}
      <div className="mb-4 sm:mb-6">
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 shadow-sm text-sm sm:text-base"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          Add New Client
        </button>
      </div>

      {/* Clients Table - Mobile Card View */}
      <div className="block sm:hidden space-y-3">
        {clients.length === 0 ? (
          <div className="text-center p-8 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500">No clients found. Add your first client to get started.</p>
          </div>
        ) : (
          clients.map((client) => (
            <div key={client.id} className="bg-white rounded-lg border border-gray-200 p-4">
              {editingId === client.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editingClient.name}
                    onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                    className="w-full bg-gray-50 text-gray-800 px-3 py-2 rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
                    placeholder="Client name"
                  />
                  <input
                    type="email"
                    value={editingClient.email}
                    onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                    className="w-full bg-gray-50 text-gray-800 px-3 py-2 rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
                    placeholder="Email address"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => saveEdit(client.id)}
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
                      <p className="font-medium text-gray-800">{client.name}</p>
                      <p className="text-blue-600 text-sm">{client.email}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEditing(client)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClient(client.id, client.name)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Added {new Date(client.created_at).toLocaleDateString()}
                  </p>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Clients Table - Desktop View */}
      <div className="hidden sm:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-4 text-gray-700 font-medium">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Client Name
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
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center p-8 text-gray-500">
                    No clients found. Add your first client to get started.
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      {editingId === client.id ? (
                        <input
                          type="text"
                          value={editingClient.name}
                          onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                          className="bg-gray-50 text-gray-800 px-3 py-1 rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
                        />
                      ) : (
                        <span className="text-gray-800 font-medium">{client.name}</span>
                      )}
                    </td>
                    <td className="p-4">
                      {editingId === client.id ? (
                        <input
                          type="email"
                          value={editingClient.email}
                          onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                          className="bg-gray-50 text-gray-800 px-3 py-1 rounded border border-gray-300 focus:border-blue-500 focus:outline-none w-full max-w-xs"
                        />
                      ) : (
                        <span className="text-blue-600">{client.email}</span>
                      )}
                    </td>
                    <td className="p-4 text-gray-600">
                      {new Date(client.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        {editingId === client.id ? (
                          <>
                            <button
                              onClick={() => saveEdit(client.id)}
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
                              onClick={() => startEditing(client)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClient(client.id, client.name)}
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

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Add New Client</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">Client Name</label>
                <input
                  type="text"
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  className="w-full bg-white text-gray-800 px-3 sm:px-4 py-2 rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
                  placeholder="Enter client name"
                />
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">Email Address</label>
                <input
                  type="email"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  className="w-full bg-white text-gray-800 px-3 sm:px-4 py-2 rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
                  placeholder="client@example.com"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewClient({ name: '', email: '' });
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddClient}
                disabled={loading}
                className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}