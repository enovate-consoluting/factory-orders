/**
 * Manufacturer Inventory Page - /dashboard/manufacturer/inventory
 * Manage clothing accessories inventory per client
 * Roles: Manufacturer, Super Admin, Manufacturer Inventory Manager
 * Last Modified: December 2025
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Warehouse,
  Plus,
  Package,
  Users,
  AlertTriangle,
  Edit2,
  Save,
  X,
  Loader2,
  Search,
  Tag,
  ChevronDown,
  ChevronRight,
  Trash2
} from 'lucide-react';

interface AccessoryType {
  id: string;
  name: string;
  code: string;
  category: string;
  display_order: number;
}

interface InventoryItem {
  id: string;
  manufacturer_id: string;
  client_id: string;
  accessory_type_id: string;
  quantity_on_hand: number;
  low_stock_threshold: number;
  description: string | null;
  last_restocked_at: string | null;
  accessory_type?: AccessoryType;
  client?: {
    id: string;
    name: string;
  };
}

interface Client {
  id: string;
  name: string;
}

export default function ManufacturerInventoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [manufacturerId, setManufacturerId] = useState<string | null>(null);
  const [accessoryTypes, setAccessoryTypes] = useState<AccessoryType[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ quantity: string; threshold: string; description: string }>({ quantity: '', threshold: '', description: '' });
  
  // Add new inventory modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Bulk inventory state
  const [newInventory, setNewInventory] = useState<{ client_id: string }>({ client_id: '' });
  const [bulkInventory, setBulkInventory] = useState<Record<string, { quantity: number; threshold: number; description: string }>>({});
  const [savingInventory, setSavingInventory] = useState(false);
  
  // Add new type inline (in Add Inventory modal)
  const [showAddType, setShowAddType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [savingType, setSavingType] = useState(false);
  
  // Add Types modal (standalone)
  const [showAddTypesModal, setShowAddTypesModal] = useState(false);
  const [newTypeNameModal, setNewTypeNameModal] = useState('');
  const [savingTypeModal, setSavingTypeModal] = useState(false);
  const [deletingTypeId, setDeletingTypeId] = useState<string | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }

    const user = JSON.parse(userData);
    const allowedRoles = ['manufacturer', 'super_admin', 'manufacturer_inventory_manager'];
    if (!allowedRoles.includes(user.role)) {
      router.push('/dashboard');
      return;
    }

    setUserRole(user.role);
    loadManufacturerData(user.email, user.role);
  }, [router]);

  const loadManufacturerData = async (email: string, role: string) => {
    try {
      let mfrId: string | null = null;

      if (role === 'super_admin') {
        const { data: manufacturers } = await supabase
          .from('manufacturers')
          .select('id')
          .limit(1);
        
        mfrId = manufacturers?.[0]?.id || 'super_admin';
        setManufacturerId(mfrId);
      } else if (role === 'manufacturer') {
        const { data: manufacturer, error: mfrError } = await supabase
          .from('manufacturers')
          .select('id, name')
          .eq('email', email)
          .single();

        if (mfrError || !manufacturer) {
          console.error('Manufacturer not found:', mfrError);
          return;
        }

        mfrId = manufacturer.id;
        setManufacturerId(mfrId);
      } else {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('manufacturer_id')
          .eq('email', email)
          .single();

        console.log('Inventory manager - user data:', userData, 'Error:', userError);

        if (userError || !userData?.manufacturer_id) {
          console.error('No manufacturer_id found for inventory manager:', email);
          return;
        }

        mfrId = userData.manufacturer_id;
        setManufacturerId(mfrId);
      }

      // Load accessory types
      const { data: types, error: typesError } = await supabase
        .from('accessory_types')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (!typesError && types) {
        setAccessoryTypes(types);
      }

      // Load all clients (for dropdown)
      const { data: allClients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');

      if (!clientsError && allClients) {
        setClients(allClients);
      }

      // Load inventory
      if (mfrId) {
        await loadInventory(mfrId, role);
      }
    } catch (error) {
      console.error('Error loading manufacturer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInventory = async (mfrId: string, role?: string) => {
    try {
      let query = supabase
        .from('manufacturer_accessories_inventory')
        .select(`
          *,
          accessory_type:accessory_types(*),
          client:clients(id, name),
          manufacturer:manufacturers(id, name)
        `)
        .order('created_at', { ascending: false });

      // Super admin sees all, manufacturer sees only theirs
      if (role !== 'super_admin') {
        query = query.eq('manufacturer_id', mfrId);
      }

      const { data, error } = await query;

      if (!error && data) {
        setInventory(data);
        // Clients default to COLLAPSED - don't auto-expand
        setExpandedClients(new Set());
      }
    } catch (error) {
      console.error('Error loading inventory:', error);
    }
  };

  // Add new accessory type
  const handleAddType = async () => {
    if (!newTypeName.trim()) {
      alert('Please enter a type name');
      return;
    }

    setSavingType(true);
    try {
      // Generate code from name (lowercase, replace spaces with underscores)
      const code = newTypeName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      
      // Get max display_order
      const maxOrder = accessoryTypes.reduce((max, t) => Math.max(max, t.display_order || 0), 0);

      const { data, error } = await supabase
        .from('accessory_types')
        .insert({
          name: newTypeName.trim(),
          code: code,
          category: 'clothing',
          display_order: maxOrder + 1,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
          alert('An accessory type with this name already exists');
        } else {
          throw error;
        }
        return;
      }

      // Add to local state
      setAccessoryTypes(prev => [...prev, data]);
      
      // Initialize in bulk inventory
      setBulkInventory(prev => ({
        ...prev,
        [data.id]: { quantity: 0, threshold: 10, description: '' }
      }));

      // Reset form
      setNewTypeName('');
      setShowAddType(false);
    } catch (error) {
      console.error('Error adding accessory type:', error);
      alert('Error adding accessory type');
    } finally {
      setSavingType(false);
    }
  };

  // Add type from the standalone modal
  const handleAddTypeModal = async () => {
    if (!newTypeNameModal.trim()) {
      alert('Please enter a type name');
      return;
    }

    setSavingTypeModal(true);
    try {
      const code = newTypeNameModal.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const maxOrder = accessoryTypes.reduce((max, t) => Math.max(max, t.display_order || 0), 0);

      const { data, error } = await supabase
        .from('accessory_types')
        .insert({
          name: newTypeNameModal.trim(),
          code: code,
          category: 'clothing',
          display_order: maxOrder + 1,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
          alert('An accessory type with this name already exists');
        } else {
          throw error;
        }
        return;
      }

      setAccessoryTypes(prev => [...prev, data]);
      setNewTypeNameModal('');
    } catch (error) {
      console.error('Error adding accessory type:', error);
      alert('Error adding accessory type');
    } finally {
      setSavingTypeModal(false);
    }
  };

  // Delete accessory type
  const handleDeleteType = async (typeId: string, typeName: string) => {
    // Check if type is in use
    const inUseCount = inventory.filter(inv => inv.accessory_type_id === typeId).length;
    
    if (inUseCount > 0) {
      alert(`Cannot delete "${typeName}" - it is being used by ${inUseCount} inventory item(s). Remove the inventory items first.`);
      return;
    }

    if (!confirm(`Are you sure you want to delete "${typeName}"? This cannot be undone.`)) {
      return;
    }

    setDeletingTypeId(typeId);
    try {
      const { error } = await supabase
        .from('accessory_types')
        .delete()
        .eq('id', typeId);

      if (error) throw error;

      setAccessoryTypes(prev => prev.filter(t => t.id !== typeId));
    } catch (error) {
      console.error('Error deleting accessory type:', error);
      alert('Error deleting accessory type');
    } finally {
      setDeletingTypeId(null);
    }
  };

  // Bulk add inventory for all accessory types at once
  const handleBulkAddInventory = async () => {
    if (!newInventory.client_id) return;
    
    setSavingInventory(true);
    try {
      let addedCount = 0;
      
      for (const [accessoryTypeId, data] of Object.entries(bulkInventory)) {
        // Skip if quantity is 0
        if (data.quantity <= 0) continue;
        
        // Check if already exists
        const exists = inventory.find(
          inv => inv.client_id === newInventory.client_id && inv.accessory_type_id === accessoryTypeId
        );
        if (exists) continue;
        
        const { error } = await supabase
          .from('manufacturer_accessories_inventory')
          .insert({
            manufacturer_id: manufacturerId,
            client_id: newInventory.client_id,
            accessory_type_id: accessoryTypeId,
            quantity_on_hand: data.quantity,
            low_stock_threshold: data.threshold,
            description: data.description || null,
            last_restocked_at: new Date().toISOString()
          });
        
        if (!error) {
          addedCount++;
        }
      }
      
      if (addedCount > 0 && manufacturerId) {
        await loadInventory(manufacturerId, userRole);
      }
      
      setShowAddModal(false);
      setNewInventory({ client_id: '' });
      setBulkInventory({});
      setShowAddType(false);
      setNewTypeName('');
      
    } catch (error) {
      console.error('Error adding bulk inventory:', error);
      alert('Error adding inventory. Please try again.');
    } finally {
      setSavingInventory(false);
    }
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item.id);
    setEditValues({
      quantity: item.quantity_on_hand.toString(),
      threshold: item.low_stock_threshold.toString(),
      description: item.description || ''
    });
  };

  const handleSaveEdit = async (itemId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('manufacturer_accessories_inventory')
        .update({
          quantity_on_hand: parseInt(editValues.quantity),
          low_stock_threshold: parseInt(editValues.threshold),
          description: editValues.description || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId);

      if (error) throw error;

      setEditingItem(null);
      if (manufacturerId) {
        await loadInventory(manufacturerId, userRole);
      }
    } catch (error) {
      console.error('Error saving inventory:', error);
      alert('Error saving changes');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditValues({ quantity: '', threshold: '', description: '' });
  };

  const handleDeleteItem = async (itemId: string, itemName: string) => {
    if (!confirm(`Are you sure you want to delete "${itemName}" from inventory? This cannot be undone.`)) {
      return;
    }

    setDeletingId(itemId);
    try {
      const { error } = await supabase
        .from('manufacturer_accessories_inventory')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      if (manufacturerId) {
        await loadInventory(manufacturerId, userRole);
      }
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      alert('Error deleting inventory item');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleClientExpand = (clientId: string) => {
    setExpandedClients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  // Group inventory by client
  const inventoryByClient = inventory.reduce((acc, item) => {
    const clientId = item.client_id;
    if (!acc[clientId]) {
      acc[clientId] = {
        client: item.client,
        items: []
      };
    }
    acc[clientId].items.push(item);
    return acc;
  }, {} as Record<string, { client: any; items: InventoryItem[] }>);

  // Filter by search
  const filteredClients = Object.entries(inventoryByClient).filter(([_, data]) => {
    if (!searchQuery) return true;
    return data.client?.name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Count low stock items
  const lowStockCount = inventory.filter(item => 
    item.quantity_on_hand <= item.low_stock_threshold
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Warehouse className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Accessories Inventory</h1>
                <p className="text-gray-500">Manage clothing accessories per client</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAddTypesModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors font-medium"
              >
                <Tag className="w-5 h-5" />
                Add Types
              </button>
              <button
                onClick={() => {
                  setShowAddModal(true);
                  setNewInventory({ client_id: '' });
                  setBulkInventory({});
                  setShowAddType(false);
                  setNewTypeName('');
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
              >
                <Plus className="w-5 h-5" />
                Add Inventory
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{Object.keys(inventoryByClient).length}</p>
                <p className="text-sm text-gray-500">Clients</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{inventory.length}</p>
                <p className="text-sm text-gray-500">Items</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Tag className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{accessoryTypes.length}</p>
                <p className="text-sm text-gray-500">Types</p>
              </div>
            </div>
          </div>
          
          <div className={`rounded-xl border p-4 ${lowStockCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${lowStockCount > 0 ? 'bg-amber-100' : 'bg-gray-100'}`}>
                <AlertTriangle className={`w-5 h-5 ${lowStockCount > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-amber-700' : 'text-gray-900'}`}>{lowStockCount}</p>
                <p className={`text-sm ${lowStockCount > 0 ? 'text-amber-600' : 'text-gray-500'}`}>Low Stock</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clients..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Inventory List by Client */}
        {filteredClients.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Warehouse className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Inventory Yet</h3>
            <p className="text-gray-500 mb-6">Add accessories inventory for your clients to get started.</p>
            <button
              onClick={() => {
                setShowAddModal(true);
                setNewInventory({ client_id: '' });
                setBulkInventory({});
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add First Inventory
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredClients.map(([clientId, data]) => (
              <div key={clientId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Client Header */}
                <button
                  onClick={() => toggleClientExpand(clientId)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {expandedClients.has(clientId) ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-blue-600 font-bold">
                        {data.client?.name?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900">{data.client?.name || 'Unknown Client'}</p>
                      <p className="text-sm text-gray-500">{data.items.length} accessory type{data.items.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  
                  {/* Low stock indicator */}
                  {data.items.some(item => item.quantity_on_hand <= item.low_stock_threshold) && (
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Low Stock
                    </span>
                  )}
                </button>

                {/* Expanded Inventory Items */}
                {expandedClients.has(clientId) && (
                  <div className="border-t border-gray-100">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Accessory</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Description</th>
                          <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">On Hand</th>
                          <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Low Threshold</th>
                          <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.items.map((item) => {
                          const isLowStock = item.quantity_on_hand <= item.low_stock_threshold;
                          const isEditing = editingItem === item.id;
                          
                          return (
                            <tr key={item.id} className={isLowStock ? 'bg-amber-50' : ''}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Tag className="w-4 h-4 text-gray-400" />
                                  <span className="font-medium text-gray-900">
                                    {item.accessory_type?.name || 'Unknown'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editValues.description}
                                    onChange={(e) => setEditValues(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Add description..."
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 text-sm"
                                  />
                                ) : (
                                  <span className="text-sm text-gray-600">
                                    {item.description || <span className="text-gray-400 italic">No description</span>}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    value={editValues.quantity}
                                    onChange={(e) => setEditValues(prev => ({ ...prev, quantity: e.target.value }))}
                                    className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-gray-900"
                                    min="0"
                                  />
                                ) : (
                                  <span className={`font-bold ${isLowStock ? 'text-amber-700' : 'text-gray-900'}`}>
                                    {item.quantity_on_hand.toLocaleString()}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    value={editValues.threshold}
                                    onChange={(e) => setEditValues(prev => ({ ...prev, threshold: e.target.value }))}
                                    className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-gray-900"
                                    min="0"
                                  />
                                ) : (
                                  <span className="text-gray-500">{item.low_stock_threshold}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {item.quantity_on_hand === 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                                    Out of Stock
                                  </span>
                                ) : isLowStock ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                                    <AlertTriangle className="w-3 h-3" />
                                    Low
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                    In Stock
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {isEditing ? (
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => handleSaveEdit(item.id)}
                                      disabled={saving}
                                      className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors"
                                    >
                                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    </button>
                                    <button
                                      onClick={handleCancelEdit}
                                      className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => handleEditItem(item)}
                                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    {(userRole === 'super_admin' || userRole === 'manufacturer_inventory_manager' || userRole === 'manufacturer') && (
                                      <button
                                        onClick={() => handleDeleteItem(item.id, item.accessory_type?.name || 'item')}
                                        disabled={deletingId === item.id}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                      >
                                        {deletingId === item.id ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="w-4 h-4" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Types Modal */}
      {showAddTypesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Manage Accessory Types</h3>
                <p className="text-sm text-gray-500">Add or remove accessory types available for all clients</p>
              </div>
              <button
                onClick={() => {
                  setShowAddTypesModal(false);
                  setNewTypeNameModal('');
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {/* Add New Type Form */}
              <div className="flex items-end gap-3 mb-6 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-indigo-700 mb-1">
                    New Accessory Type Name
                  </label>
                  <input
                    type="text"
                    value={newTypeNameModal}
                    onChange={(e) => setNewTypeNameModal(e.target.value)}
                    placeholder="e.g., QR Code Tag, Care Label..."
                    className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-indigo-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTypeNameModal.trim()) {
                        handleAddTypeModal();
                      }
                    }}
                  />
                </div>
                <button
                  onClick={handleAddTypeModal}
                  disabled={savingTypeModal || !newTypeNameModal.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {savingTypeModal ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Add
                </button>
              </div>

              {/* Existing Types List */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Current Accessory Types ({accessoryTypes.length})
                </h4>
                
                {accessoryTypes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Tag className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p>No accessory types yet. Add your first one above!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {accessoryTypes.map((type, index) => {
                      const inUseCount = inventory.filter(inv => inv.accessory_type_id === type.id).length;
                      
                      return (
                        <div
                          key={type.id}
                          className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 font-bold text-sm">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{type.name}</p>
                              <p className="text-xs text-gray-500">
                                {inUseCount > 0 ? (
                                  <span className="text-green-600">Used by {inUseCount} client{inUseCount !== 1 ? 's' : ''}</span>
                                ) : (
                                  <span className="text-gray-400">Not in use</span>
                                )}
                              </p>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => handleDeleteType(type.id, type.name)}
                            disabled={deletingTypeId === type.id}
                            className={`p-2 rounded-lg transition-colors ${
                              inUseCount > 0
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title={inUseCount > 0 ? 'Cannot delete - in use' : 'Delete type'}
                          >
                            {deletingTypeId === type.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowAddTypesModal(false);
                  setNewTypeNameModal('');
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Inventory Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Add Inventory for Client</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewInventory({ client_id: '' });
                  setBulkInventory({});
                  setShowAddType(false);
                  setNewTypeName('');
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[70vh]">
              {/* Step 1: Select Client */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Client
                </label>
                <select
                  value={newInventory.client_id}
                  onChange={(e) => {
                    setNewInventory({ ...newInventory, client_id: e.target.value });
                    // Initialize bulk inventory for all accessory types
                    const initial: Record<string, { quantity: number; threshold: number; description: string }> = {};
                    accessoryTypes.forEach(type => {
                      initial[type.id] = { quantity: 0, threshold: 10, description: '' };
                    });
                    setBulkInventory(initial);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select a client --</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>

              {/* Step 2: Show all accessory types grid */}
              {newInventory.client_id && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    Enter quantities for each accessory type. Leave at 0 to skip.
                  </p>
                  
                  <div className="space-y-3">
                    {accessoryTypes.map(type => {
                      // Check if this combination already exists
                      const existingItem = inventory.find(
                        inv => inv.client_id === newInventory.client_id && inv.accessory_type_id === type.id
                      );
                      
                      return (
                        <div 
                          key={type.id} 
                          className={`p-3 rounded-lg border ${
                            existingItem 
                              ? 'bg-gray-100 border-gray-300' 
                              : 'bg-white border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-gray-900">{type.name}</p>
                              {existingItem && (
                                <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded">
                                  Already Added ({existingItem.quantity_on_hand} on hand)
                                </span>
                              )}
                            </div>
                            
                            {!existingItem && (
                              <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1">
                                  <label className="block text-xs text-gray-500 mb-1">Description (optional)</label>
                                  <input
                                    type="text"
                                    placeholder="e.g., Gold foil, Standard kraft..."
                                    value={bulkInventory[type.id]?.description || ''}
                                    onChange={(e) => setBulkInventory(prev => ({
                                      ...prev,
                                      [type.id]: { 
                                        ...prev[type.id], 
                                        description: e.target.value 
                                      }
                                    }))}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-gray-900 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Qty</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={bulkInventory[type.id]?.quantity || 0}
                                    onChange={(e) => setBulkInventory(prev => ({
                                      ...prev,
                                      [type.id]: { 
                                        ...prev[type.id], 
                                        quantity: parseInt(e.target.value) || 0 
                                      }
                                    }))}
                                    className="w-24 px-2 py-1.5 border border-gray-300 rounded text-gray-900 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Low Alert</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={bulkInventory[type.id]?.threshold || 10}
                                    onChange={(e) => setBulkInventory(prev => ({
                                      ...prev,
                                      [type.id]: { 
                                        ...prev[type.id], 
                                        threshold: parseInt(e.target.value) || 10 
                                      }
                                    }))}
                                    className="w-20 px-2 py-1.5 border border-gray-300 rounded text-gray-900 text-sm"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add New Type Inline */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    {!showAddType ? (
                      <button
                        onClick={() => setShowAddType(true)}
                        className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Add New Accessory Type
                      </button>
                    ) : (
                      <div className="flex items-end gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-indigo-700 mb-1">
                            New Accessory Type Name
                          </label>
                          <input
                            type="text"
                            value={newTypeName}
                            onChange={(e) => setNewTypeName(e.target.value)}
                            placeholder="e.g., QR Code Tag, Care Label..."
                            className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                          />
                        </div>
                        <button
                          onClick={handleAddType}
                          disabled={savingType || !newTypeName.trim()}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                        >
                          {savingType ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setShowAddType(false);
                            setNewTypeName('');
                          }}
                          className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewInventory({ client_id: '' });
                  setBulkInventory({});
                  setShowAddType(false);
                  setNewTypeName('');
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAddInventory}
                disabled={!newInventory.client_id || savingInventory}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {savingInventory ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add Inventory
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
