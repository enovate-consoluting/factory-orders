/**
 * Inventory Page - /dashboard/inventory
 * Warehouse management for tracking incoming shipments, current stock, and archived items
 * Tabs: Incoming (shipped products), Inventory (in stock), Archive (picked up/gone)
 * Roles: Super Admin, Admin, Warehouse
 * Last Modified: December 2024
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Search, RefreshCw, Clock, Archive, MapPin, Truck,
  CheckSquare, Square, Save, X, Warehouse, Loader2, Trash2, Plus, AlertTriangle,
  ChevronLeft, ChevronRight, MessageSquare
} from 'lucide-react';

interface InventoryItem {
  id: string;
  inventory_id: string;
  order_item_id: string;
  variant_combo: string;
  expected_quantity: number;
  verified: boolean;
  verified_at: string | null;
  notes: string | null;
}

interface InventoryRecord {
  id: string;
  order_product_id: string;
  order_id: string;
  client_id: string;
  product_order_number: string;
  product_name: string;
  order_number: string;
  client_name: string;
  status: 'incoming' | 'in_stock' | 'archived';
  received_at: string | null;
  received_by: string | null;
  rack_location: string | null;
  archived_at: string | null;
  archived_by: string | null;
  picked_up_by: string | null;
  notes: string | null;
  created_at: string;
  items?: InventoryItem[];
  total_quantity?: number;
}

type TabType = 'incoming' | 'inventory' | 'archive';
const ITEMS_PER_PAGE = 10;

export default function InventoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('incoming');
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [inventoryRecords, setInventoryRecords] = useState<InventoryRecord[]>([]);
  const [stats, setStats] = useState({ incoming: 0, inStock: 0, archived: 0 });
  const [saving, setSaving] = useState(false);

  const [receiveModal, setReceiveModal] = useState<{
    isOpen: boolean;
    record: InventoryRecord | null;
    rack_location: string;
    items: { id: string; verified: boolean; notes: string }[];
  }>({ isOpen: false, record: null, rack_location: '', items: [] });

  const [notesModal, setNotesModal] = useState<{
    isOpen: boolean;
    record: InventoryRecord | null;
    notes: string;
  }>({ isOpen: false, record: null, notes: '' });

  const [archiveModal, setArchiveModal] = useState<{
    isOpen: boolean;
    record: InventoryRecord | null;
    pickedUpBy: string;
  }>({ isOpen: false, record: null, pickedUpBy: '' });

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; record: InventoryRecord | null }>({ isOpen: false, record: null });
  const [deleting, setDeleting] = useState(false);

  const [manualEntryModal, setManualEntryModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    product_order_number: '', product_name: '', order_number: '', client_id: '',
    rack_location: '', notes: '', variants: [{ variant_combo: '', expected_quantity: 0 }]
  });

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) { router.push('/'); return; }
    const parsedUser = JSON.parse(userData);
    if (!['super_admin', 'admin', 'warehouse'].includes(parsedUser.role)) { router.push('/dashboard'); return; }
    setUser(parsedUser);
    fetchClients(); fetchStats(); fetchInventory();
  }, [router]);

  useEffect(() => { setCurrentPage(1); fetchInventory(); }, [activeTab, clientFilter]);

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name').order('name');
    setClients(data || []);
  };

  const fetchStats = async () => {
    const { data: incoming } = await supabase.from('inventory').select('id').eq('status', 'incoming');
    const { data: inStock } = await supabase.from('inventory').select('id').eq('status', 'in_stock');
    const { data: archived } = await supabase.from('inventory').select('id').eq('status', 'archived');
    setStats({ incoming: incoming?.length || 0, inStock: inStock?.length || 0, archived: archived?.length || 0 });
  };

  const fetchInventory = async () => {
    setLoading(true);
    let query = supabase.from('inventory').select('*, items:inventory_items(*)').order('created_at', { ascending: false });
    if (activeTab === 'incoming') query = query.eq('status', 'incoming');
    else if (activeTab === 'inventory') query = query.eq('status', 'in_stock');
    else query = query.eq('status', 'archived');
    if (clientFilter !== 'all') query = query.eq('client_id', clientFilter);
    const { data } = await query;
    const recordsWithTotals = (data || []).map(record => ({
      ...record,
      total_quantity: record.items?.reduce((sum: number, item: InventoryItem) => sum + (item.expected_quantity || 0), 0) || 0
    }));
    setInventoryRecords(recordsWithTotals);
    setLoading(false);
  };

  const openReceiveModal = (record: InventoryRecord) => {
    setReceiveModal({
      isOpen: true, record, rack_location: record.rack_location || '',
      items: record.items?.map(item => ({ id: item.id, verified: item.verified, notes: item.notes || '' })) || []
    });
  };

  const openNotesModal = (record: InventoryRecord) => {
    setNotesModal({ isOpen: true, record, notes: record.notes || '' });
  };

  const saveNotes = async () => {
    if (!notesModal.record) return;
    setSaving(true);
    await supabase.from('inventory').update({ notes: notesModal.notes }).eq('id', notesModal.record.id);
    setNotesModal({ isOpen: false, record: null, notes: '' });
    fetchInventory();
    setSaving(false);
  };

  const toggleItemVerified = (itemId: string) => {
    setReceiveModal(prev => ({ ...prev, items: prev.items.map(item => item.id === itemId ? { ...item, verified: !item.verified } : item) }));
  };

  const toggleAllVerified = () => {
    const allVerified = receiveModal.items.every(item => item.verified);
    setReceiveModal(prev => ({ ...prev, items: prev.items.map(item => ({ ...item, verified: !allVerified })) }));
  };

  const updateItemNotes = (itemId: string, notes: string) => {
    setReceiveModal(prev => ({ ...prev, items: prev.items.map(item => item.id === itemId ? { ...item, notes } : item) }));
  };

  const handleMarkReceived = async () => {
    if (!receiveModal.record) return;
    setSaving(true);
    await supabase.from('inventory').update({
      status: 'in_stock', received_at: new Date().toISOString(), received_by: user?.id,
      rack_location: receiveModal.rack_location
    }).eq('id', receiveModal.record.id);
    for (const item of receiveModal.items) {
      await supabase.from('inventory_items').update({
        verified: item.verified, verified_at: item.verified ? new Date().toISOString() : null,
        verified_by: item.verified ? user?.id : null, notes: item.notes
      }).eq('id', item.id);
    }
    setReceiveModal({ isOpen: false, record: null, rack_location: '', items: [] });
    fetchInventory(); fetchStats(); setSaving(false);
  };

  const handleArchive = async () => {
    if (!archiveModal.record || !archiveModal.pickedUpBy.trim()) { alert('Please enter who picked up the items'); return; }
    setSaving(true);
    await supabase.from('inventory').update({
      status: 'archived', archived_at: new Date().toISOString(), archived_by: user?.id,
      picked_up_by: archiveModal.pickedUpBy.trim()
    }).eq('id', archiveModal.record.id);
    setArchiveModal({ isOpen: false, record: null, pickedUpBy: '' });
    fetchInventory(); fetchStats(); setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteModal.record) return;
    setDeleting(true);
    await supabase.from('inventory_items').delete().eq('inventory_id', deleteModal.record.id);
    await supabase.from('inventory').delete().eq('id', deleteModal.record.id);
    setDeleteModal({ isOpen: false, record: null });
    fetchInventory(); fetchStats(); setDeleting(false);
  };

  const addVariantRow = () => setManualForm(prev => ({ ...prev, variants: [...prev.variants, { variant_combo: '', expected_quantity: 0 }] }));
  const removeVariantRow = (index: number) => setManualForm(prev => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));
  const updateVariant = (index: number, field: string, value: any) => {
    setManualForm(prev => ({ ...prev, variants: prev.variants.map((v, i) => i === index ? { ...v, [field]: value } : v) }));
  };

  const handleManualEntry = async () => {
    if (!manualForm.product_name.trim()) { alert('Product name is required'); return; }
    setSaving(true);
    const productNum = manualForm.product_order_number || 'MAN-' + Date.now();
    const { data: invData } = await supabase.from('inventory').insert({
      product_order_number: productNum,
      product_name: manualForm.product_name, 
      order_number: manualForm.order_number || 'MANUAL',
      client_id: manualForm.client_id || null, 
      client_name: clients.find(c => c.id === manualForm.client_id)?.name || 'Manual Entry',
      status: 'in_stock', 
      rack_location: manualForm.rack_location, 
      notes: manualForm.notes,
      received_at: new Date().toISOString(), 
      received_by: user?.id
    }).select().single();
    if (invData) {
      const validVariants = manualForm.variants.filter(v => v.variant_combo.trim());
      if (validVariants.length > 0) {
        await supabase.from('inventory_items').insert(validVariants.map(v => ({
          inventory_id: invData.id, variant_combo: v.variant_combo, expected_quantity: v.expected_quantity || 0,
          verified: true, verified_at: new Date().toISOString(), verified_by: user?.id
        })));
      }
    }
    setManualForm({ product_order_number: '', product_name: '', order_number: '', client_id: '', rack_location: '', notes: '', variants: [{ variant_combo: '', expected_quantity: 0 }] });
    setManualEntryModal(false); fetchInventory(); fetchStats(); setSaving(false);
  };

  const filteredRecords = inventoryRecords.filter(record => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return record.product_name?.toLowerCase().includes(search) || record.product_order_number?.toLowerCase().includes(search) ||
      record.order_number?.toLowerCase().includes(search) || record.client_name?.toLowerCase().includes(search) || record.rack_location?.toLowerCase().includes(search);
  });

  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const getTabIcon = (tab: TabType) => tab === 'incoming' ? Truck : tab === 'inventory' ? Warehouse : Archive;

  const getTabStyles = (tab: TabType, isActive: boolean) => {
    if (!isActive) return 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300';
    if (tab === 'incoming') return 'border-amber-500 text-amber-600';
    if (tab === 'inventory') return 'border-green-500 text-green-600';
    return 'border-gray-500 text-gray-600';
  };

  const getTabBadgeStyles = (tab: TabType, isActive: boolean) => {
    if (!isActive) return 'bg-gray-100 text-gray-600';
    if (tab === 'incoming') return 'bg-amber-100 text-amber-600';
    if (tab === 'inventory') return 'bg-green-100 text-green-600';
    return 'bg-gray-100 text-gray-600';
  };

  const getEmptyBgStyle = () => {
    if (activeTab === 'incoming') return 'bg-amber-100';
    if (activeTab === 'inventory') return 'bg-green-100';
    return 'bg-gray-100';
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Inventory</h1>
            <p className="text-gray-500 text-xs mt-0.5">Track incoming shipments and warehouse stock</p>
          </div>
          <div className="flex items-center gap-2">
            {user?.role === 'super_admin' && (
              <button onClick={() => setManualEntryModal(true)} className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 text-sm font-medium">
                <Plus className="w-4 h-4" /><span className="hidden sm:inline">Add Manual</span>
              </button>
            )}
            <button onClick={() => { fetchInventory(); fetchStats(); }} className="p-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="border-b border-gray-200 mb-3">
          <nav className="-mb-px flex gap-x-1">
            {(['incoming', 'inventory', 'archive'] as TabType[]).map((tab) => {
              const Icon = getTabIcon(tab);
              const count = tab === 'incoming' ? stats.incoming : tab === 'inventory' ? stats.inStock : stats.archived;
              const label = tab === 'incoming' ? 'Incoming' : tab === 'inventory' ? 'Inventory' : 'Archive';
              const isActive = activeTab === tab;
              return (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={"py-2 px-3 border-b-2 font-medium text-sm flex items-center gap-1.5 whitespace-nowrap transition-colors " + getTabStyles(tab, isActive)}>
                  <Icon className="w-3.5 h-3.5" />{label}
                  {count > 0 && <span className={"px-1.5 py-0.5 rounded-full text-xs font-semibold " + getTabBadgeStyles(tab, isActive)}>{count}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-500" />
          </div>
          <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white">
            <option value="all">All Clients</option>
            {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className={"w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3 " + getEmptyBgStyle()}>
            {activeTab === 'incoming' ? <Truck className="w-6 h-6 text-amber-500" /> : activeTab === 'inventory' ? <Warehouse className="w-6 h-6 text-green-500" /> : <Archive className="w-6 h-6 text-gray-500" />}
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">{activeTab === 'incoming' ? 'No Incoming Shipments' : activeTab === 'inventory' ? 'No Items in Stock' : 'No Archived Items'}</h3>
          <p className="text-gray-500 text-xs">{activeTab === 'incoming' ? 'Products appear here when shipped' : activeTab === 'inventory' ? 'Mark shipments as received' : 'Archived items appear here'}</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {paginatedRecords.map((record) => (
                <div key={record.id} className="px-3 py-2 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-semibold text-gray-900">{record.order_number}</span>
                        <span className="text-gray-300">•</span>
                        <span className="font-medium text-gray-500">{record.product_order_number}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-sm text-gray-800 truncate">{record.product_name}</span>
                        {activeTab === 'incoming' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium flex-shrink-0">
                            <Clock className="w-2.5 h-2.5" />Awaiting
                          </span>
                        )}
                        {activeTab === 'inventory' && record.rack_location && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium flex-shrink-0">
                            <MapPin className="w-2.5 h-2.5" />{record.rack_location}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-500">
                        <span>{record.client_name}</span>
                        <span className="text-gray-300">•</span>
                        <span>{record.total_quantity} units</span>
                        {activeTab === 'archive' && record.picked_up_by && (
                          <><span className="text-gray-300">•</span><span>Picked up: {record.picked_up_by}</span></>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => openNotesModal(record)} 
                        className={record.notes ? 'p-1.5 rounded-lg transition-colors text-blue-600 bg-blue-50 hover:bg-blue-100' : 'p-1.5 rounded-lg transition-colors text-gray-400 hover:text-gray-600 hover:bg-gray-100'} 
                        title={record.notes || 'Add notes'}>
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      {user?.role === 'super_admin' && (
                        <button onClick={() => setDeleteModal({ isOpen: true, record })} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {activeTab === 'incoming' && (
                        <button onClick={() => openReceiveModal(record)} className="px-2.5 py-1 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 transition-colors">
                          Mark Received
                        </button>
                      )}
                      {activeTab === 'inventory' && (
                        <button onClick={() => setArchiveModal({ isOpen: true, record, pickedUpBy: '' })} className="px-2.5 py-1 bg-gray-500 text-white text-xs font-medium rounded-lg hover:bg-gray-600 transition-colors">
                          Picked Up
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 text-xs">
              <span className="text-gray-500">Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredRecords.length)} of {filteredRecords.length}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 text-gray-700">Page {currentPage}/{totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {receiveModal.isOpen && receiveModal.record && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl my-4">
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Mark as Received</h3>
                <p className="text-xs text-gray-500">{receiveModal.record.order_number} • {receiveModal.record.product_order_number}</p>
              </div>
              <button onClick={() => setReceiveModal({ isOpen: false, record: null, rack_location: '', items: [] })} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto">
              <div className="p-2 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-900 text-sm">{receiveModal.record.product_name}</p>
                <p className="text-xs text-gray-500">{receiveModal.record.client_name}</p>
              </div>
              {receiveModal.items.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 text-sm">Variants</h4>
                    <button onClick={toggleAllVerified} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                      {receiveModal.items.every(item => item.verified) ? <><CheckSquare className="w-3.5 h-3.5" />Uncheck All</> : <><Square className="w-3.5 h-3.5" />Check All</>}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {receiveModal.record.items?.map((item) => {
                      const editItem = receiveModal.items.find(i => i.id === item.id);
                      return (
                        <div key={item.id} className="flex items-start gap-2 p-2 bg-white border border-gray-200 rounded-lg">
                          <button onClick={() => toggleItemVerified(item.id)} className="mt-0.5 flex-shrink-0">
                            {editItem?.verified ? <CheckSquare className="w-4 h-4 text-green-600" /> : <Square className="w-4 h-4 text-gray-400" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-900 text-sm">{item.variant_combo}</span>
                              <span className="text-xs text-gray-500 ml-4">Qty: {item.expected_quantity}</span>
                            </div>
                            <input type="text" value={editItem?.notes || ''} onChange={(e) => updateItemNotes(item.id, e.target.value)}
                              placeholder="Notes (e.g., 2 damaged)..." className="w-full mt-1.5 px-2 py-1 border border-gray-200 rounded text-xs text-gray-900 placeholder-gray-400" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rack Location</label>
                <input type="text" value={receiveModal.rack_location} onChange={(e) => setReceiveModal(prev => ({ ...prev, rack_location: e.target.value }))}
                  placeholder="e.g., A-12-3" className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400" />
              </div>
            </div>
            <div className="p-3 border-t border-gray-200 flex gap-2">
              <button onClick={() => setReceiveModal({ isOpen: false, record: null, rack_location: '', items: [] })} className="flex-1 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
              <button onClick={handleMarkReceived} disabled={saving} className="flex-1 px-3 py-1.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm flex items-center justify-center gap-1.5">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Save className="w-4 h-4" />Save</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {notesModal.isOpen && notesModal.record && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full shadow-xl">
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Notes</h3>
              <button onClick={() => setNotesModal({ isOpen: false, record: null, notes: '' })} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-3">
              <p className="text-xs text-gray-500 mb-2">{notesModal.record.order_number} • {notesModal.record.product_order_number}</p>
              <textarea value={notesModal.notes} onChange={(e) => setNotesModal(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add notes about this item..." rows={4} className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400" />
            </div>
            <div className="p-3 border-t border-gray-200 flex gap-2">
              <button onClick={() => setNotesModal({ isOpen: false, record: null, notes: '' })} className="flex-1 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
              <button onClick={saveNotes} disabled={saving} className="flex-1 px-3 py-1.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center justify-center gap-1.5">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Save className="w-4 h-4" />Save</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {archiveModal.isOpen && archiveModal.record && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full shadow-xl">
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Mark Picked Up</h3>
              <button onClick={() => setArchiveModal({ isOpen: false, record: null, pickedUpBy: '' })} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-3">
              <div className="mb-3 p-2 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700"><span className="font-medium">{archiveModal.record.product_order_number}</span> - {archiveModal.record.product_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{archiveModal.record.order_number} • {archiveModal.record.client_name}</p>
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Who picked up? <span className="text-red-500">*</span></label>
              <input type="text" value={archiveModal.pickedUpBy} onChange={(e) => setArchiveModal(prev => ({ ...prev, pickedUpBy: e.target.value }))}
                placeholder="Name or company" className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400" autoFocus />
            </div>
            <div className="p-3 border-t border-gray-200 flex gap-2">
              <button onClick={() => setArchiveModal({ isOpen: false, record: null, pickedUpBy: '' })} className="flex-1 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
              <button onClick={handleArchive} disabled={saving || !archiveModal.pickedUpBy.trim()} className="flex-1 px-3 py-1.5 bg-gray-800 text-white font-medium rounded-lg hover:bg-gray-900 disabled:opacity-50 text-sm flex items-center justify-center gap-1.5">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Archive className="w-4 h-4" />Archive</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModal.isOpen && deleteModal.record && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full shadow-xl">
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-600"><AlertTriangle className="w-5 h-5" /><h3 className="font-semibold">Delete Record</h3></div>
              <button onClick={() => setDeleteModal({ isOpen: false, record: null })} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-3">
              <div className="mb-3 p-2 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-800 font-medium">Delete this inventory record?</p>
                <p className="text-xs text-red-600 mt-0.5">This cannot be undone.</p>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700"><span className="font-medium">{deleteModal.record.product_order_number}</span> - {deleteModal.record.product_name}</p>
              </div>
            </div>
            <div className="p-3 border-t border-gray-200 flex gap-2">
              <button onClick={() => setDeleteModal({ isOpen: false, record: null })} className="flex-1 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 px-3 py-1.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm flex items-center justify-center gap-1.5">
                {deleting ? <><Loader2 className="w-4 h-4 animate-spin" />Deleting...</> : <><Trash2 className="w-4 h-4" />Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {manualEntryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl my-4">
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Add Manual Entry</h3>
              <button onClick={() => setManualEntryModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Product #</label>
                  <input type="text" value={manualForm.product_order_number} onChange={(e) => setManualForm(prev => ({ ...prev, product_order_number: e.target.value }))}
                    placeholder="PRD-001" className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Order #</label>
                  <input type="text" value={manualForm.order_number} onChange={(e) => setManualForm(prev => ({ ...prev, order_number: e.target.value }))}
                    placeholder="ORD-001" className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Product Name <span className="text-red-500">*</span></label>
                <input type="text" value={manualForm.product_name} onChange={(e) => setManualForm(prev => ({ ...prev, product_name: e.target.value }))}
                  placeholder="Enter product name" className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Client</label>
                  <select value={manualForm.client_id} onChange={(e) => setManualForm(prev => ({ ...prev, client_id: e.target.value }))}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white">
                    <option value="">Select</option>
                    {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rack Location</label>
                  <input type="text" value={manualForm.rack_location} onChange={(e) => setManualForm(prev => ({ ...prev, rack_location: e.target.value }))}
                    placeholder="A-12-3" className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-700">Variants</label>
                  <button onClick={addVariantRow} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5"><Plus className="w-3 h-3" />Add</button>
                </div>
                <div className="space-y-1.5">
                  {manualForm.variants.map((variant, index) => (
                    <div key={index} className="flex items-center gap-1.5">
                      <input type="text" value={variant.variant_combo} onChange={(e) => updateVariant(index, 'variant_combo', e.target.value)}
                        placeholder="M / Red" className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs text-gray-900 placeholder-gray-400" />
                      <input type="number" value={variant.expected_quantity || ''} onChange={(e) => updateVariant(index, 'expected_quantity', parseInt(e.target.value) || 0)}
                        placeholder="Qty" className="w-16 px-2 py-1 border border-gray-300 rounded text-xs text-gray-900 placeholder-gray-400" />
                      {manualForm.variants.length > 1 && <button onClick={() => removeVariantRow(index)} className="p-0.5 text-red-500 hover:bg-red-50 rounded"><X className="w-3.5 h-3.5" /></button>}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={manualForm.notes} onChange={(e) => setManualForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add notes..." rows={2} className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400" />
              </div>
            </div>
            <div className="p-3 border-t border-gray-200 flex gap-2">
              <button onClick={() => setManualEntryModal(false)} className="flex-1 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
              <button onClick={handleManualEntry} disabled={saving || !manualForm.product_name.trim()} className="flex-1 px-3 py-1.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center justify-center gap-1.5">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Plus className="w-4 h-4" />Add</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
