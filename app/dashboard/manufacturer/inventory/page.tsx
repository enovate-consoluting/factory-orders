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
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDynamicTranslation } from '@/hooks/useDynamicTranslation';
import { translateText } from '@/lib/translate';
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
  Trash2,
  Globe,
  Languages
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
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const { translate, translateBatch } = useDynamicTranslation();
  const [loading, setLoading] = useState(true);
  const [translatingInput, setTranslatingInput] = useState(false);
  const [translatedPreview, setTranslatedPreview] = useState<string>('');
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
  
  // Add type to existing client (inline in expanded view)
  const [addingTypeToClient, setAddingTypeToClient] = useState<string | null>(null);
  const [newTypeForClient, setNewTypeForClient] = useState<{ typeName: string; quantity: number; threshold: number; description: string }>({ typeName: '', quantity: 0, threshold: 10, description: '' });
  const [savingTypeForClient, setSavingTypeForClient] = useState(false);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);
  
  // Add Types modal (standalone)
  const [showAddTypesModal, setShowAddTypesModal] = useState(false);
  const [newTypeNameModal, setNewTypeNameModal] = useState('');
  const [savingTypeModal, setSavingTypeModal] = useState(false);
  const [deletingTypeId, setDeletingTypeId] = useState<string | null>(null);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeName, setEditingTypeName] = useState('');
  const [savingTypeEdit, setSavingTypeEdit] = useState(false);

  // Translate Chinese input to English before saving
  const translateToEnglish = async (text: string): Promise<string> => {
    if (!text || !text.trim()) return text;
    
    // Check if text contains Chinese characters
    const hasChinese = /[\u4e00-\u9fff]/.test(text);
    if (!hasChinese) return text;
    
    try {
      const translated = await translateText(text, 'en');
      return translated || text;
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    }
  };

  // Show preview of English translation when typing Chinese
  const handleDescriptionChange = async (text: string, callback: (val: string) => void) => {
    callback(text);
    
    // Check if text contains Chinese
    const hasChinese = /[\u4e00-\u9fff]/.test(text);
    if (hasChinese && text.length > 1) {
      setTranslatingInput(true);
      try {
        const preview = await translateText(text, 'en');
        setTranslatedPreview(preview || '');
      } catch {
        setTranslatedPreview('');
      } finally {
        setTranslatingInput(false);
      }
    } else {
      setTranslatedPreview('');
    }
  };

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
      alert(language === 'zh' ? '请输入类型名称' : 'Please enter a type name');
      return;
    }

    setSavingType(true);
    try {
      // Translate Chinese to English before saving
      const nameToSave = await translateToEnglish(newTypeName.trim());
      
      // Generate code from English name (lowercase, replace spaces with underscores)
      const code = nameToSave.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      
      // Get max display_order
      const maxOrder = accessoryTypes.reduce((max, t) => Math.max(max, t.display_order || 0), 0);

      const { data, error } = await supabase
        .from('accessory_types')
        .insert({
          name: nameToSave,
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
      alert(language === 'zh' ? '请输入类型名称' : 'Please enter a type name');
      return;
    }

    setSavingTypeModal(true);
    try {
      // Translate Chinese to English before saving
      const nameToSave = await translateToEnglish(newTypeNameModal.trim());
      const code = nameToSave.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const maxOrder = accessoryTypes.reduce((max, t) => Math.max(max, t.display_order || 0), 0);

      const { data, error } = await supabase
        .from('accessory_types')
        .insert({
          name: nameToSave,
          code: code,
          category: 'clothing',
          display_order: maxOrder + 1,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
          alert(language === 'zh' ? '此名称的配件类型已存在' : 'An accessory type with this name already exists');
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

  // Edit accessory type name
  const handleSaveTypeName = async (typeId: string) => {
    if (!editingTypeName.trim()) {
      alert(language === 'zh' ? '请输入类型名称' : 'Please enter a type name');
      return;
    }

    setSavingTypeEdit(true);
    try {
      // Translate to English before saving
      const nameToSave = await translateToEnglish(editingTypeName.trim());
      const code = nameToSave.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

      const { error } = await supabase
        .from('accessory_types')
        .update({ name: nameToSave, code: code })
        .eq('id', typeId);

      if (error) {
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
          alert(language === 'zh' ? '此名称已存在' : 'This name already exists');
        } else {
          throw error;
        }
        return;
      }

      // Update local state
      setAccessoryTypes(prev => prev.map(t => 
        t.id === typeId ? { ...t, name: nameToSave, code: code } : t
      ));
      
      setEditingTypeId(null);
      setEditingTypeName('');
    } catch (error) {
      console.error('Error updating type name:', error);
      alert(language === 'zh' ? '更新失败' : 'Error updating type name');
    } finally {
      setSavingTypeEdit(false);
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

  // Add a single accessory type to an existing client (auto-creates type if new)
  const handleAddTypeToExistingClient = async (clientId: string) => {
    if (!newTypeForClient.typeName.trim() || newTypeForClient.quantity <= 0) {
      alert(language === 'zh' ? '请输入类型名称和数量' : 'Please enter type name and quantity');
      return;
    }

    setSavingTypeForClient(true);
    try {
      // Translate type name and description to English before saving
      const typeNameToSave = await translateToEnglish(newTypeForClient.typeName.trim());
      const descriptionToSave = await translateToEnglish(newTypeForClient.description);
      
      // Check if type already exists (case-insensitive) - check both original input and translated
      let accessoryTypeId: string;
      const inputLower = newTypeForClient.typeName.trim().toLowerCase();
      const translatedLower = typeNameToSave.toLowerCase();
      
      // First check if input matches any existing type (including translated names)
      let existingType = accessoryTypes.find(
        t => t.name.toLowerCase() === translatedLower || t.name.toLowerCase() === inputLower
      );
      
      // Also check if Chinese input matches the Chinese translation of any type
      if (!existingType && language === 'zh') {
        existingType = accessoryTypes.find(t => {
          const translatedTypeName = translate(t.name);
          return translatedTypeName.toLowerCase() === inputLower;
        });
      }
      
      if (existingType) {
        // Use existing type
        accessoryTypeId = existingType.id;
        
        // Check if this client already has this type
        const clientHasType = inventory.some(
          inv => inv.client_id === clientId && inv.accessory_type_id === existingType.id
        );
        if (clientHasType) {
          alert(language === 'zh' ? '此客户已有此配件类型' : 'This client already has this accessory type');
          setSavingTypeForClient(false);
          return;
        }
      } else {
        // Create new type
        const code = typeNameToSave.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        const maxOrder = accessoryTypes.reduce((max, t) => Math.max(max, t.display_order || 0), 0);
        
        const { data: newType, error: typeError } = await supabase
          .from('accessory_types')
          .insert({
            name: typeNameToSave,
            code: code,
            category: 'clothing',
            display_order: maxOrder + 1,
            is_active: true
          })
          .select()
          .single();
        
        if (typeError) {
          throw typeError;
        }
        
        accessoryTypeId = newType.id;
        // Add to local state
        setAccessoryTypes(prev => [...prev, newType]);
      }
      
      // Now add inventory for this client
      const { error } = await supabase
        .from('manufacturer_accessories_inventory')
        .insert({
          manufacturer_id: manufacturerId,
          client_id: clientId,
          accessory_type_id: accessoryTypeId,
          quantity_on_hand: newTypeForClient.quantity,
          low_stock_threshold: newTypeForClient.threshold,
          description: descriptionToSave || null,
          last_restocked_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }

      // Reload inventory
      if (manufacturerId) {
        await loadInventory(manufacturerId, userRole);
      }

      // Reset form
      setAddingTypeToClient(null);
      setNewTypeForClient({ typeName: '', quantity: 0, threshold: 10, description: '' });
    } catch (error) {
      console.error('Error adding type to client:', error);
      alert(language === 'zh' ? '添加失败' : 'Error adding accessory type');
    } finally {
      setSavingTypeForClient(false);
    }
  };

  // Delete all accessories for a client
  const handleDeleteClientAccessories = async (clientId: string, clientName: string) => {
    const clientItems = inventory.filter(inv => inv.client_id === clientId);
    
    // Check if super admin or if allowed
    if (userRole !== 'super_admin') {
      // TODO: Check if any orders reference these accessories
      // For now, allow manufacturer to delete
    }

    const confirmMsg = language === 'zh' 
      ? `确定要删除 "${clientName}" 的所有 ${clientItems.length} 个配件吗？此操作无法撤销。`
      : `Are you sure you want to remove all ${clientItems.length} accessories for "${clientName}"? This cannot be undone.`;
    
    if (!confirm(confirmMsg)) {
      return;
    }

    setDeletingClientId(clientId);
    try {
      const { error } = await supabase
        .from('manufacturer_accessories_inventory')
        .delete()
        .eq('client_id', clientId)
        .eq('manufacturer_id', manufacturerId);

      if (error) throw error;

      if (manufacturerId) {
        await loadInventory(manufacturerId, userRole);
      }
    } catch (error) {
      console.error('Error deleting client accessories:', error);
      alert(language === 'zh' ? '删除失败' : 'Error deleting accessories');
    } finally {
      setDeletingClientId(null);
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
      // Translate description to English before saving
      const descriptionToSave = await translateToEnglish(editValues.description);
      
      const { error } = await supabase
        .from('manufacturer_accessories_inventory')
        .update({
          quantity_on_hand: parseInt(editValues.quantity),
          low_stock_threshold: parseInt(editValues.threshold),
          description: descriptionToSave || null,
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
                <h1 className="text-2xl font-bold text-gray-900">
                  {language === 'zh' ? '配件库存' : 'Accessories Inventory'}
                </h1>
                <p className="text-gray-500">
                  {language === 'zh' ? '按客户管理服装配件' : 'Manage clothing accessories per client'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Language Selector */}
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'en' | 'zh')}
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="en">🇺🇸 English</option>
                <option value="zh">🇨🇳 中文</option>
              </select>
              
              <button
                onClick={() => setShowAddTypesModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors font-medium"
              >
                <Tag className="w-5 h-5" />
                {language === 'zh' ? '添加类型' : 'Add Types'}
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
                {language === 'zh' ? '添加库存' : 'Add Inventory'}
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
                <p className="text-sm text-gray-500">{language === 'zh' ? '客户' : 'Clients'}</p>
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
                <p className="text-sm text-gray-500">{language === 'zh' ? '项目' : 'Items'}</p>
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
                <p className="text-sm text-gray-500">{language === 'zh' ? '类型' : 'Types'}</p>
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
                <p className={`text-sm ${lowStockCount > 0 ? 'text-amber-600' : 'text-gray-500'}`}>
                  {language === 'zh' ? '库存不足' : 'Low Stock'}
                </p>
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
              placeholder={language === 'zh' ? '搜索客户...' : 'Search clients...'}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Inventory List by Client */}
        {filteredClients.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Warehouse className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {language === 'zh' ? '暂无库存' : 'No Inventory Yet'}
            </h3>
            <p className="text-gray-500 mb-6">
              {language === 'zh' ? '为您的客户添加配件库存以开始使用。' : 'Add accessories inventory for your clients to get started.'}
            </p>
            <button
              onClick={() => {
                setShowAddModal(true);
                setNewInventory({ client_id: '' });
                setBulkInventory({});
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {language === 'zh' ? '添加首个库存' : 'Add First Inventory'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredClients.map(([clientId, data]) => (
              <div key={clientId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Client Header */}
                <div
                  onClick={() => toggleClientExpand(clientId)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer"
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
                      <p className="text-sm text-gray-500">
                        {data.items.length} {language === 'zh' ? '种配件' : `accessory type${data.items.length !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>
                  
                  {/* Action buttons + Low stock indicator */}
                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    {/* Low stock indicator */}
                    {data.items.some(item => item.quantity_on_hand <= item.low_stock_threshold) && (
                      <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {language === 'zh' ? '库存不足' : 'Low Stock'}
                      </span>
                    )}
                    
                    {/* Add Type Button - with border box */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAddingTypeToClient(addingTypeToClient === clientId ? null : clientId);
                        setNewTypeForClient({ typeName: '', quantity: 0, threshold: 10, description: '' });
                        // Make sure client is expanded
                        if (!expandedClients.has(clientId)) {
                          toggleClientExpand(clientId);
                        }
                      }}
                      className="p-2 text-indigo-600 border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                      title={language === 'zh' ? '添加配件类型' : 'Add accessory type'}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    
                    {/* Delete Client Button - Super Admin or Manufacturer */}
                    {(userRole === 'super_admin' || userRole === 'manufacturer') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClientAccessories(clientId, data.client?.name || 'Unknown');
                        }}
                        disabled={deletingClientId === clientId}
                        className="p-2 text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        title={language === 'zh' ? '删除此客户所有配件' : 'Remove all accessories for this client'}
                      >
                        {deletingClientId === clientId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Inventory Items */}
                {expandedClients.has(clientId) && (
                  <div className="border-t border-gray-100">
                    {/* Add Type to This Client - Inline Form */}
                    {addingTypeToClient === clientId && (
                      <div className="p-4 bg-indigo-50 border-b border-indigo-200">
                        <div className="flex flex-wrap gap-3 items-end">
                          {/* Accessory Type - Text Input (auto-creates if new) */}
                          <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs text-indigo-700 mb-1">
                              {language === 'zh' ? '配件类型' : 'Accessory Type'}
                            </label>
                            <input
                              type="text"
                              value={newTypeForClient.typeName}
                              onChange={(e) => setNewTypeForClient(prev => ({ ...prev, typeName: e.target.value }))}
                              placeholder={language === 'zh' ? '输入配件名称...' : 'Enter accessory name...'}
                              className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-indigo-500"
                              list={`accessory-types-${clientId}`}
                              autoFocus
                            />
                            {/* Datalist for autocomplete suggestions - show in current language */}
                            <datalist id={`accessory-types-${clientId}`}>
                              {accessoryTypes
                                .filter(type => !data.items.some(item => item.accessory_type_id === type.id))
                                .map(type => (
                                  <option key={type.id} value={language === 'zh' ? translate(type.name) : type.name}>
                                    {type.name}
                                  </option>
                                ))
                              }
                            </datalist>
                          </div>
                          
                          {/* Description */}
                          <div className="flex-1 min-w-[150px]">
                            <label className="block text-xs text-indigo-700 mb-1">
                              {language === 'zh' ? '描述（可选）' : 'Description (optional)'}
                            </label>
                            <input
                              type="text"
                              value={newTypeForClient.description}
                              onChange={(e) => setNewTypeForClient(prev => ({ ...prev, description: e.target.value }))}
                              placeholder={language === 'zh' ? '例如：金箔...' : 'e.g., Gold foil...'}
                              className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-gray-900 text-sm"
                            />
                          </div>
                          
                          {/* Quantity */}
                          <div className="w-24">
                            <label className="block text-xs text-indigo-700 mb-1">
                              {language === 'zh' ? '数量' : 'Qty'}
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={newTypeForClient.quantity || ''}
                              onChange={(e) => setNewTypeForClient(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                              className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-gray-900 text-sm"
                            />
                          </div>
                          
                          {/* Threshold */}
                          <div className="w-24">
                            <label className="block text-xs text-indigo-700 mb-1">
                              {language === 'zh' ? '低库存' : 'Low Alert'}
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={newTypeForClient.threshold}
                              onChange={(e) => setNewTypeForClient(prev => ({ ...prev, threshold: parseInt(e.target.value) || 10 }))}
                              className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-gray-900 text-sm"
                            />
                          </div>
                          
                          {/* Buttons */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAddTypeToExistingClient(clientId)}
                              disabled={savingTypeForClient || !newTypeForClient.typeName.trim() || newTypeForClient.quantity <= 0}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                            >
                              {savingTypeForClient ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Plus className="w-4 h-4" />
                              )}
                              {language === 'zh' ? '添加' : 'Add'}
                            </button>
                            <button
                              onClick={() => {
                                setAddingTypeToClient(null);
                                setNewTypeForClient({ typeName: '', quantity: 0, threshold: 10, description: '' });
                              }}
                              className="px-3 py-2 text-gray-600 hover:bg-white border border-gray-300 rounded-lg"
                            >
                              {language === 'zh' ? '取消' : 'Cancel'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                            {language === 'zh' ? '配件' : 'Accessory'}
                          </th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                            {language === 'zh' ? '描述' : 'Description'}
                          </th>
                          <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                            {language === 'zh' ? '库存' : 'On Hand'}
                          </th>
                          <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                            {language === 'zh' ? '低库存阈值' : 'Low Threshold'}
                          </th>
                          <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                            {language === 'zh' ? '状态' : 'Status'}
                          </th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                            {language === 'zh' ? '操作' : 'Actions'}
                          </th>
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
                                    {translate(item.accessory_type?.name) || (language === 'zh' ? '未知' : 'Unknown')}
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
                                    {item.description 
                                      ? translate(item.description)
                                      : <span className="text-gray-400 italic">{language === 'zh' ? '无描述' : 'No description'}</span>
                                    }
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
                                    {language === 'zh' ? '缺货' : 'Out of Stock'}
                                  </span>
                                ) : isLowStock ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                                    <AlertTriangle className="w-3 h-3" />
                                    {language === 'zh' ? '低' : 'Low'}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                    {language === 'zh' ? '有货' : 'In Stock'}
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
                <h3 className="text-lg font-bold text-gray-900">
                  {language === 'zh' ? '管理配件类型' : 'Manage Accessory Types'}
                </h3>
                <p className="text-sm text-gray-500">
                  {language === 'zh' ? '添加或删除所有客户可用的配件类型' : 'Add or remove accessory types available for all clients'}
                </p>
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
                    {language === 'zh' ? '新配件类型名称' : 'New Accessory Type Name'}
                  </label>
                  <input
                    type="text"
                    value={newTypeNameModal}
                    onChange={(e) => setNewTypeNameModal(e.target.value)}
                    placeholder={language === 'zh' ? '例如：二维码标签、护理标签...' : 'e.g., QR Code Tag, Care Label...'}
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
                  {language === 'zh' ? '添加' : 'Add'}
                </button>
              </div>

              {/* Existing Types List */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  {language === 'zh' ? `当前配件类型 (${accessoryTypes.length})` : `Current Accessory Types (${accessoryTypes.length})`}
                </h4>
                
                {accessoryTypes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Tag className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p>{language === 'zh' ? '暂无配件类型。请在上方添加第一个！' : 'No accessory types yet. Add your first one above!'}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {accessoryTypes.map((type, index) => {
                      const inUseCount = inventory.filter(inv => inv.accessory_type_id === type.id).length;
                      const isEditing = editingTypeId === type.id;
                      
                      return (
                        <div
                          key={type.id}
                          className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 font-bold text-sm flex-shrink-0">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editingTypeName}
                                    onChange={(e) => setEditingTypeName(e.target.value)}
                                    className="flex-1 px-2 py-1 border border-indigo-300 rounded text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveTypeName(type.id);
                                      if (e.key === 'Escape') {
                                        setEditingTypeId(null);
                                        setEditingTypeName('');
                                      }
                                    }}
                                  />
                                  <button
                                    onClick={() => handleSaveTypeName(type.id)}
                                    disabled={savingTypeEdit}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                  >
                                    {savingTypeEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingTypeId(null);
                                      setEditingTypeName('');
                                    }}
                                    className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <p className="font-medium text-gray-900">{translate(type.name)}</p>
                                  <p className="text-xs text-gray-500">
                                    {inUseCount > 0 ? (
                                      <span className="text-green-600">
                                        {language === 'zh' ? `${inUseCount} 个客户使用中` : `Used by ${inUseCount} client${inUseCount !== 1 ? 's' : ''}`}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">{language === 'zh' ? '未使用' : 'Not in use'}</span>
                                    )}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                          
                          {!isEditing && (
                            <div className="flex items-center gap-1">
                              {/* Edit Button */}
                              <button
                                onClick={() => {
                                  setEditingTypeId(type.id);
                                  setEditingTypeName(type.name);
                                }}
                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title={language === 'zh' ? '编辑名称' : 'Edit name'}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              
                              {/* Delete Button */}
                              <button
                                onClick={() => handleDeleteType(type.id, type.name)}
                                disabled={deletingTypeId === type.id}
                                className={`p-2 rounded-lg transition-colors ${
                                  inUseCount > 0
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                }`}
                                title={inUseCount > 0 ? (language === 'zh' ? '使用中，无法删除' : 'Cannot delete - in use') : (language === 'zh' ? '删除' : 'Delete type')}
                              >
                                {deletingTypeId === type.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          )}
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
                {language === 'zh' ? '完成' : 'Done'}
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
              <h3 className="text-lg font-bold text-gray-900">
                {language === 'zh' ? '为客户添加库存' : 'Add Inventory for Client'}
              </h3>
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
                  {language === 'zh' ? '选择客户' : 'Select Client'}
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
                  <option value="">{language === 'zh' ? '-- 选择客户 --' : '-- Select a client --'}</option>
                  {clients
                    .filter(client => !Object.keys(inventoryByClient).includes(client.id))
                    .map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))
                  }
                  {clients.filter(client => !Object.keys(inventoryByClient).includes(client.id)).length === 0 && (
                    <option value="" disabled>{language === 'zh' ? '所有客户已有库存' : 'All clients already have inventory'}</option>
                  )}
                </select>
              </div>

              {/* Step 2: Show all accessory types grid */}
              {newInventory.client_id && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    {language === 'zh' ? '输入每种配件类型的数量。留空为0则跳过。' : 'Enter quantities for each accessory type. Leave at 0 to skip.'}
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
                              <p className="font-medium text-gray-900">{translate(type.name)}</p>
                              {existingItem && (
                                <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded">
                                  {language === 'zh' ? `已添加 (库存 ${existingItem.quantity_on_hand})` : `Already Added (${existingItem.quantity_on_hand} on hand)`}
                                </span>
                              )}
                            </div>
                            
                            {!existingItem && (
                              <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1">
                                  <label className="block text-xs text-gray-500 mb-1">
                                    {language === 'zh' ? '描述（可选）' : 'Description (optional)'}
                                  </label>
                                  <input
                                    type="text"
                                    placeholder={language === 'zh' ? '例如：金箔、标准牛皮纸...' : 'e.g., Gold foil, Standard kraft...'}
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
                                  <label className="block text-xs text-gray-500 mb-1">{language === 'zh' ? '数量' : 'Qty'}</label>
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
                                  <label className="block text-xs text-gray-500 mb-1">{language === 'zh' ? '低库存警报' : 'Low Alert'}</label>
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
                        {language === 'zh' ? '添加新配件类型' : 'Add New Accessory Type'}
                      </button>
                    ) : (
                      <div className="flex items-end gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-indigo-700 mb-1">
                            {language === 'zh' ? '新配件类型名称' : 'New Accessory Type Name'}
                          </label>
                          <input
                            type="text"
                            value={newTypeName}
                            onChange={(e) => setNewTypeName(e.target.value)}
                            placeholder={language === 'zh' ? '例如：二维码标签、护理标签...' : 'e.g., QR Code Tag, Care Label...'}
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
                          {language === 'zh' ? '添加' : 'Add'}
                        </button>
                        <button
                          onClick={() => {
                            setShowAddType(false);
                            setNewTypeName('');
                          }}
                          className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          {language === 'zh' ? '取消' : 'Cancel'}
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
                {language === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button
                onClick={handleBulkAddInventory}
                disabled={!newInventory.client_id || savingInventory}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {savingInventory ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {language === 'zh' ? '保存中...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    {language === 'zh' ? '添加库存' : 'Add Inventory'}
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
