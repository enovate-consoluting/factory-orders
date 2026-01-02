/**
 * Inventory Page - /dashboard/inventory
 * Warehouse management for tracking incoming shipments, current stock, and archived items
 * Features: Image carousel, PDF viewer, camera capture, ajax client search
 * Tabs: Incoming (shipped products), Inventory (in stock), Archive (picked up/gone)
 * Roles: Super Admin, Admin, Warehouse
 * Last Modified: December 2024
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Search, RefreshCw, Clock, Archive, MapPin, Truck,
  CheckSquare, Square, Save, X, Warehouse, Loader2, Trash2, Plus, AlertTriangle,
  ChevronLeft, ChevronRight, MessageSquare, Image as ImageIcon, Camera, FileText, ExternalLink, Edit2,
  History, Minus, ArrowDown, ArrowUp, Pencil
} from 'lucide-react';
import {
  logInventoryAction,
  logUploadMetrics,
  logInventoryFetch,
  createTimer,
  formatBytes,
  formatDuration,
} from '@/lib/inventoryLogger';
import { compressImages } from '@/lib/imageCompression';

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

interface InventoryMedia {
  id: string;
  inventory_id: string;
  file_url: string;
  file_name: string;
  file_type: string;
}

interface OrderMedia {
  id: string;
  order_product_id: string;
  file_url: string;
  file_type: string;
  original_filename: string;
}

interface MediaFile {
  url: string;
  name: string;
  type: 'image' | 'pdf' | 'other';
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
  order_media?: OrderMedia[];
  inventory_media?: InventoryMedia[];
}

interface InventoryTransaction {
  id: string;
  inventory_item_id: string;
  transaction_type: 'pickup' | 'restock' | 'adjustment' | 'manual';
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  picked_up_by: string | null;
  notes: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

type TabType = 'incoming' | 'inventory' | 'archive';
const ITEMS_PER_PAGE = 10;

// Helper to determine file type
const getFileType = (url: string, fileType?: string): 'image' | 'pdf' | 'other' => {
  if (fileType?.startsWith('image') || url?.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return 'image';
  if (fileType === 'document' || fileType?.includes('pdf') || url?.match(/\.pdf$/i)) return 'pdf';
  return 'other';
};

export default function InventoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('incoming');
  const [searchTerm, setSearchTerm] = useState('');
  const [isGlobalSearch, setIsGlobalSearch] = useState(false); // Track if searching across all tabs
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [inventoryRecords, setInventoryRecords] = useState<InventoryRecord[]>([]);
  const [stats, setStats] = useState({ incoming: 0, inStock: 0, archived: 0 });
  const [saving, setSaving] = useState(false);

  // Media Viewer Modal
  const [mediaModal, setMediaModal] = useState<{
    isOpen: boolean;
    files: MediaFile[];
    currentIndex: number;
    title: string;
  }>({ isOpen: false, files: [], currentIndex: 0, title: '' });

  // Receive Modal with camera
  const [receiveModal, setReceiveModal] = useState<{
    isOpen: boolean;
    record: InventoryRecord | null;
    rack_location: string;
    items: { id: string; verified: boolean; notes: string }[];
    capturedPhotos: { file: File; preview: string }[];
  }>({ isOpen: false, record: null, rack_location: '', items: [], capturedPhotos: [] });

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

  // Manual Entry Modal
  const [manualEntryModal, setManualEntryModal] = useState(false);
  const [editingInventoryId, setEditingInventoryId] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState<{
    product_order_number: string;
    product_name: string;
    order_number: string;
    client_id: string;
    rack_location: string;
    notes: string;
    variants: { id?: string; variant_combo: string; expected_quantity: number }[];
  }>({
    product_order_number: '', product_name: '', order_number: '', client_id: '',
    rack_location: '', notes: '', variants: [{ variant_combo: '', expected_quantity: 0 }]
  });
  const [editingRecord, setEditingRecord] = useState<InventoryRecord | null>(null);
  const [manualPhotos, setManualPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  // Pickup Modal (for recording quantity changes)
  const [pickupModal, setPickupModal] = useState<{
    isOpen: boolean;
    item: InventoryItem | null;
    record: InventoryRecord | null;
    quantity: number;
    pickedUpBy: string;
    notes: string;
    transactionType: 'pickup' | 'restock' | 'adjustment' | 'manual';
  }>({ isOpen: false, item: null, record: null, quantity: 0, pickedUpBy: '', notes: '', transactionType: 'pickup' });

  // History Modal
  const [historyModal, setHistoryModal] = useState<{
    isOpen: boolean;
    item: InventoryItem | null;
    record: InventoryRecord | null;
    transactions: InventoryTransaction[];
    loading: boolean;
  }>({ isOpen: false, item: null, record: null, transactions: [], loading: false });

  // Camera refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manualFileInputRef = useRef<HTMLInputElement>(null);

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) { router.push('/'); return; }
    const parsedUser = JSON.parse(userData);
    if (!['super_admin', 'admin', 'warehouse'].includes(parsedUser.role)) { router.push('/dashboard'); return; }
    setUser(parsedUser);
    fetchClients(); fetchStats(); fetchInventory();
  }, [router]);

  useEffect(() => { setCurrentPage(1); fetchInventory(isGlobalSearch); }, [activeTab, clientFilter, isGlobalSearch]);

  // Handle search with debounce - always search globally when typing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim().length >= 1) {
        // Any search triggers global search across all tabs
        if (!isGlobalSearch) setIsGlobalSearch(true);
        fetchInventory(true);
      } else if (searchTerm.trim().length === 0 && isGlobalSearch) {
        // When clearing search, go back to tab-filtered view
        setIsGlobalSearch(false);
        fetchInventory(false);
      }
    }, 300); // 300ms debounce
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const handleClickOutside = () => {
      if (showClientDropdown) setShowClientDropdown(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showClientDropdown]);

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

  const fetchInventory = async (globalSearch = false) => {
    setLoading(true);
    const timer = createTimer();
    try {
      let query = supabase.from('inventory').select('*, items:inventory_items(*)').order('created_at', { ascending: false });
      // Skip tab filter when doing global search
      if (!globalSearch) {
        if (activeTab === 'incoming') query = query.eq('status', 'incoming');
        else if (activeTab === 'inventory') query = query.eq('status', 'in_stock');
        else query = query.eq('status', 'archived');
      }
      if (clientFilter !== 'all') query = query.eq('client_id', clientFilter);
      const { data } = await query;

      const recordsWithMedia = await Promise.all((data || []).map(async (record) => {
        let orderMedia: OrderMedia[] = [];
        let inventoryMedia: InventoryMedia[] = [];

        if (record.order_product_id) {
          const { data: mediaData } = await supabase
            .from('order_media')
            .select('*')
            .eq('order_product_id', record.order_product_id);
          orderMedia = mediaData || [];
        }

        const { data: invMediaData } = await supabase
          .from('inventory_media')
          .select('*')
          .eq('inventory_id', record.id);
        inventoryMedia = invMediaData || [];

        return {
          ...record,
          total_quantity: record.items?.reduce((sum: number, item: InventoryItem) => sum + (item.expected_quantity || 0), 0) || 0,
          order_media: orderMedia,
          inventory_media: inventoryMedia
        };
      }));

      setInventoryRecords(recordsWithMedia);

      // Log fetch with timing
      await logInventoryFetch(recordsWithMedia.length, timer.elapsed(), {
        status: activeTab === 'incoming' ? 'incoming' : activeTab === 'inventory' ? 'in_stock' : 'archived',
        clientId: clientFilter !== 'all' ? clientFilter : undefined,
      });
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
    setLoading(false);
  };

  // Get all media files for a record
  const getMediaFiles = (record: InventoryRecord): MediaFile[] => {
    const files: MediaFile[] = [];

    record.order_media?.forEach(m => {
      const type = getFileType(m.file_url, m.file_type);
      if (type !== 'other') {
        files.push({ url: m.file_url, name: m.original_filename || 'File', type });
      }
    });

    record.inventory_media?.forEach(m => {
      const type = getFileType(m.file_url, m.file_type);
      if (type !== 'other') {
        files.push({ url: m.file_url, name: m.file_name || 'File', type });
      }
    });

    return files;
  };

  // Get thumbnail info
  const getThumbnailInfo = (record: InventoryRecord): { type: 'image' | 'pdf' | 'none'; url?: string; count: number } => {
    const files = getMediaFiles(record);
    if (files.length === 0) return { type: 'none', count: 0 };

    const firstImage = files.find(f => f.type === 'image');
    if (firstImage) return { type: 'image', url: firstImage.url, count: files.length };

    const firstPdf = files.find(f => f.type === 'pdf');
    if (firstPdf) return { type: 'pdf', url: firstPdf.url, count: files.length };

    return { type: 'none', count: files.length };
  };

  // Open media viewer
  const openMediaViewer = (record: InventoryRecord) => {
    const files = getMediaFiles(record);
    if (files.length > 0) {
      setMediaModal({
        isOpen: true,
        files,
        currentIndex: 0,
        title: `${record.product_order_number} - ${record.product_name}`
      });
    }
  };

  const nextFile = () => {
    setMediaModal(prev => ({
      ...prev,
      currentIndex: (prev.currentIndex + 1) % prev.files.length
    }));
  };

  const prevFile = () => {
    setMediaModal(prev => ({
      ...prev,
      currentIndex: prev.currentIndex === 0 ? prev.files.length - 1 : prev.currentIndex - 1
    }));
  };

  const openPdfInNewTab = (url: string) => {
    window.open(url, '_blank');
  };

  const openReceiveModal = (record: InventoryRecord) => {
    setReceiveModal({
      isOpen: true, record, rack_location: record.rack_location || '',
      items: record.items?.map(item => ({ id: item.id, verified: item.verified, notes: item.notes || '' })) || [],
      capturedPhotos: []
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

  const handleReceiveFileCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newPhotos = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setReceiveModal(prev => ({
      ...prev,
      capturedPhotos: [...prev.capturedPhotos, ...newPhotos]
    }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeReceivePhoto = (index: number) => {
    setReceiveModal(prev => ({
      ...prev,
      capturedPhotos: prev.capturedPhotos.filter((_, i) => i !== index)
    }));
  };

  const handleManualFileCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newPhotos = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setManualPhotos(prev => [...prev, ...newPhotos]);
    if (manualFileInputRef.current) manualFileInputRef.current.value = '';
  };

  const removeManualPhoto = (index: number) => {
    setManualPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // Upload photos to Supabase storage - with compression and logging
  const uploadPhotos = async (
    inventoryId: string,
    photos: { file: File; preview: string }[],
    uploadedBy: string | null = null
  ): Promise<{ success: boolean; failedCount: number; totalSavedBytes: number }> => {
    const overallTimer = createTimer();
    let failedCount = 0;
    let totalSavedBytes = 0;

    // Log upload start
    const originalTotalSize = photos.reduce((sum, p) => sum + p.file.size, 0);
    await logInventoryAction({
      action: 'photo_upload_start',
      userId: uploadedBy || undefined,
      userName: user?.name,
      inventoryId,
      details: {
        fileCount: photos.length,
        totalSize: formatBytes(originalTotalSize),
        fileNames: photos.map(p => p.file.name),
        fileSizes: photos.map(p => formatBytes(p.file.size)),
      },
    });

    // Step 1: Compress images
    const compressionTimer = createTimer();
    const filesToUpload = photos.map(p => p.file);
    const compressionResult = await compressImages(filesToUpload, {
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 0.8,
    });
    const compressionDuration = compressionTimer.elapsed();
    totalSavedBytes = compressionResult.totalSavedBytes;

    console.log(
      `[UPLOAD] Compression: ${formatDuration(compressionDuration)} | ` +
      `${formatBytes(compressionResult.totalOriginalSize)} -> ${formatBytes(compressionResult.totalCompressedSize)} ` +
      `(saved ${formatBytes(totalSavedBytes)})`
    );

    // Step 2: Upload compressed files in parallel
    const uploadTimer = createTimer();
    const uploadPromises = compressionResult.files.map(async (file, index) => {
      const singleFileTimer = createTimer();
      const fileExt = file.name.split('.').pop();
      const fileName = `${inventoryId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('inventory-media')
        .upload(fileName, file);

      if (uploadError) {
        console.error(`[UPLOAD] File ${index + 1}/${photos.length} FAILED:`, uploadError.message);
        failedCount++;
        return { success: false, duration: singleFileTimer.elapsed(), size: file.size };
      }

      const { data: { publicUrl } } = supabase.storage
        .from('inventory-media')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase.from('inventory_media').insert({
        inventory_id: inventoryId,
        file_url: publicUrl,
        file_name: photos[index].file.name, // Keep original name for display
        file_type: file.type,
        uploaded_by: uploadedBy
      });

      if (insertError) {
        console.error(`[UPLOAD] DB insert ${index + 1}/${photos.length} FAILED:`, insertError.message);
        failedCount++;
        return { success: false, duration: singleFileTimer.elapsed(), size: file.size };
      }

      const duration = singleFileTimer.elapsed();
      console.log(
        `[UPLOAD] File ${index + 1}/${photos.length}: ${formatBytes(file.size)} in ${formatDuration(duration)}`
      );
      return { success: true, duration, size: file.size };
    });

    await Promise.all(uploadPromises);
    const uploadDuration = uploadTimer.elapsed();
    const totalDuration = overallTimer.elapsed();

    // Log upload complete with metrics
    await logUploadMetrics(
      {
        inventoryId,
        fileCount: photos.length,
        totalSizeBytes: compressionResult.totalCompressedSize,
        successCount: photos.length - failedCount,
        failedCount,
        durationMs: totalDuration,
        compressionSavingsBytes: totalSavedBytes,
        averageFileSizeBytes: Math.round(compressionResult.totalCompressedSize / photos.length),
      },
      uploadedBy || undefined,
      user?.name
    );

    console.log(
      `[UPLOAD] Complete: ${photos.length - failedCount}/${photos.length} files | ` +
      `Total: ${formatDuration(totalDuration)} (compress: ${formatDuration(compressionDuration)}, upload: ${formatDuration(uploadDuration)})`
    );

    return { success: failedCount === 0, failedCount, totalSavedBytes };
  };

  const handleMarkReceived = async () => {
    if (!receiveModal.record) return;
    setSaving(true);
    const timer = createTimer();

    try {
      await supabase.from('inventory').update({
        status: 'in_stock', received_at: new Date().toISOString(), received_by: user?.id,
        rack_location: receiveModal.rack_location
      }).eq('id', receiveModal.record.id);

      const verifiedCount = receiveModal.items.filter(i => i.verified).length;
      for (const item of receiveModal.items) {
        await supabase.from('inventory_items').update({
          verified: item.verified, verified_at: item.verified ? new Date().toISOString() : null,
          verified_by: item.verified ? user?.id : null
        }).eq('id', item.id);
      }

      if (receiveModal.capturedPhotos.length > 0) {
        await uploadPhotos(receiveModal.record.id, receiveModal.capturedPhotos, user?.id);
      }

      // Log the received action
      await logInventoryAction({
        action: 'inventory_received',
        userId: user?.id,
        userName: user?.name,
        inventoryId: receiveModal.record.id,
        durationMs: timer.elapsed(),
        details: {
          productName: receiveModal.record.product_name,
          orderNumber: receiveModal.record.order_number,
          rackLocation: receiveModal.rack_location,
          itemsVerified: verifiedCount,
          totalItems: receiveModal.items.length,
          photosAdded: receiveModal.capturedPhotos.length,
        },
      });

      setReceiveModal({ isOpen: false, record: null, rack_location: '', items: [], capturedPhotos: [] });
      fetchInventory(); fetchStats();
    } catch (error) {
      console.error('Error marking received:', error);
    }
    setSaving(false);
  };

  const handleArchive = async () => {
    if (!archiveModal.record || !archiveModal.pickedUpBy.trim()) { alert('Please enter who picked up the items'); return; }
    setSaving(true);
    const timer = createTimer();

    await supabase.from('inventory').update({
      status: 'archived', archived_at: new Date().toISOString(), archived_by: user?.id,
      picked_up_by: archiveModal.pickedUpBy.trim()
    }).eq('id', archiveModal.record.id);

    // Log the archive action
    await logInventoryAction({
      action: 'inventory_archived',
      userId: user?.id,
      userName: user?.name,
      inventoryId: archiveModal.record.id,
      durationMs: timer.elapsed(),
      details: {
        productName: archiveModal.record.product_name,
        orderNumber: archiveModal.record.order_number,
        pickedUpBy: archiveModal.pickedUpBy.trim(),
        rackLocation: archiveModal.record.rack_location,
      },
    });

    setArchiveModal({ isOpen: false, record: null, pickedUpBy: '' });
    fetchInventory(); fetchStats(); setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteModal.record) return;
    setDeleting(true);
    const timer = createTimer();

    // Capture details before deletion
    const deletedRecord = {
      productName: deleteModal.record.product_name,
      orderNumber: deleteModal.record.order_number,
      productOrderNumber: deleteModal.record.product_order_number,
      clientName: deleteModal.record.client_name,
      status: deleteModal.record.status,
      itemCount: deleteModal.record.items?.length || 0,
      mediaCount: (deleteModal.record.order_media?.length || 0) + (deleteModal.record.inventory_media?.length || 0),
    };

    await supabase.from('inventory_items').delete().eq('inventory_id', deleteModal.record.id);
    await supabase.from('inventory_media').delete().eq('inventory_id', deleteModal.record.id);
    await supabase.from('inventory').delete().eq('id', deleteModal.record.id);

    // Log the delete action
    await logInventoryAction({
      action: 'inventory_delete',
      userId: user?.id,
      userName: user?.name,
      inventoryId: deleteModal.record.id,
      durationMs: timer.elapsed(),
      details: deletedRecord,
    });

    setDeleteModal({ isOpen: false, record: null });
    fetchInventory(); fetchStats(); setDeleting(false);
  };

  const addVariantRow = () => setManualForm(prev => ({ ...prev, variants: [...prev.variants, { variant_combo: '', expected_quantity: 0 }] }));
  const removeVariantRow = (index: number) => setManualForm(prev => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));
  const updateVariant = (index: number, field: string, value: any) => {
    setManualForm(prev => ({ ...prev, variants: prev.variants.map((v, i) => i === index ? { ...v, [field]: value } : v) }));
  };

  const selectClient = (client: { id: string; name: string }) => {
    setManualForm(prev => ({ ...prev, client_id: client.id }));
    setClientSearch(client.name);
    setShowClientDropdown(false);
  };

  // Open pickup modal for a specific inventory item
  const openPickupModal = (item: InventoryItem, record: InventoryRecord, type: 'pickup' | 'restock' | 'adjustment' | 'manual' = 'pickup') => {
    setPickupModal({
      isOpen: true,
      item,
      record,
      quantity: 0,
      pickedUpBy: '',
      notes: '',
      transactionType: type
    });
  };

  // Handle pickup/restock/adjustment transaction
  const handlePickupTransaction = async () => {
    if (!pickupModal.item || !pickupModal.record || pickupModal.quantity <= 0) return;

    setSaving(true);
    const timer = createTimer();

    try {
      const currentQty = pickupModal.item.expected_quantity;
      const changeAmount = pickupModal.transactionType === 'restock'
        ? pickupModal.quantity
        : -pickupModal.quantity;
      const newQty = currentQty + changeAmount;

      if (newQty < 0) {
        alert('Cannot reduce quantity below 0');
        setSaving(false);
        return;
      }

      // Insert transaction record
      const { error: txError } = await supabase.from('inventory_transactions').insert({
        inventory_item_id: pickupModal.item.id,
        transaction_type: pickupModal.transactionType,
        quantity_change: changeAmount,
        quantity_before: currentQty,
        quantity_after: newQty,
        picked_up_by: pickupModal.pickedUpBy || null,
        notes: pickupModal.notes || null,
        created_by: user?.id,
        created_by_name: user?.name
      });

      if (txError) throw txError;

      // Update the inventory item quantity
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({ expected_quantity: newQty })
        .eq('id', pickupModal.item.id);

      if (updateError) throw updateError;

      // Log the action
      await logInventoryAction({
        action: `inventory_${pickupModal.transactionType}`,
        userId: user?.id,
        userName: user?.name,
        inventoryId: pickupModal.record.id,
        durationMs: timer.elapsed(),
        details: {
          itemId: pickupModal.item.id,
          variantCombo: pickupModal.item.variant_combo,
          transactionType: pickupModal.transactionType,
          quantityBefore: currentQty,
          quantityChange: changeAmount,
          quantityAfter: newQty,
          pickedUpBy: pickupModal.pickedUpBy,
          notes: pickupModal.notes
        }
      });

      setPickupModal({ isOpen: false, item: null, record: null, quantity: 0, pickedUpBy: '', notes: '', transactionType: 'pickup' });
      fetchInventory();
    } catch (err) {
      console.error('Transaction error:', err);
      alert('Failed to record transaction');
    } finally {
      setSaving(false);
    }
  };

  // Open history modal for an inventory item
  const openHistoryModal = async (item: InventoryItem, record: InventoryRecord) => {
    setHistoryModal({ isOpen: true, item, record, transactions: [], loading: true });

    const { data, error } = await supabase
      .from('inventory_transactions')
      .select('*')
      .eq('inventory_item_id', item.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching history:', error);
      setHistoryModal(prev => ({ ...prev, loading: false }));
      return;
    }

    setHistoryModal(prev => ({ ...prev, transactions: data || [], loading: false }));
  };

  const openEditModal = (record: InventoryRecord) => {
    setEditingInventoryId(record.id);
    setEditingRecord(record);
    setManualForm({
      product_order_number: record.product_order_number || '',
      product_name: record.product_name || '',
      order_number: record.order_number || '',
      client_id: record.client_id || '',
      rack_location: record.rack_location || '',
      notes: record.notes || '',
      variants: record.items && record.items.length > 0
        ? record.items.map(item => ({ id: item.id, variant_combo: item.variant_combo, expected_quantity: item.expected_quantity }))
        : [{ variant_combo: '', expected_quantity: 0 }]
    });
    setClientSearch(record.client_name || '');
    setManualPhotos([]);
    setManualEntryModal(true);
  };

  const handleManualEntry = async () => {
    if (!manualForm.product_name.trim()) { alert('Product name is required'); return; }
    setSaving(true);
    const timer = createTimer();
    const isEditing = !!editingInventoryId;

    // Validate user ID exists in database before using as FK
    let validUserId: string | null = null;
    if (user?.id) {
      const { data: userExists } = await supabase.from('users').select('id').eq('id', user.id).single();
      if (userExists) {
        validUserId = user.id;
      }
    }

    try {
      let inventoryId: string | null = null;
      let photoUploadResult: { success: boolean; failedCount: number; totalSavedBytes: number } | null = null;

      if (editingInventoryId) {
        // UPDATE existing
        const { error: updateError } = await supabase.from('inventory').update({
          product_name: manualForm.product_name,
          order_number: manualForm.order_number || 'MANUAL',
          client_id: manualForm.client_id || null,
          client_name: clients.find(c => c.id === manualForm.client_id)?.name || 'Manual Entry',
          rack_location: manualForm.rack_location,
          notes: manualForm.notes
        }).eq('id', editingInventoryId);

        if (updateError) {
          throw new Error(`Failed to update inventory: ${updateError.message}`);
        }

        // Delete old items and insert new
        const { error: deleteError } = await supabase.from('inventory_items').delete().eq('inventory_id', editingInventoryId);
        if (deleteError) {
          console.error('Warning: Failed to delete old variants:', deleteError);
        }

        // Include variants with name OR quantity > 0, use "Default" if no name
        const validVariants = manualForm.variants.filter(v => v.variant_combo.trim() || v.expected_quantity > 0);
        if (validVariants.length > 0) {
          const { error: variantError } = await supabase.from('inventory_items').insert(validVariants.map(v => ({
            inventory_id: editingInventoryId,
            variant_combo: v.variant_combo.trim() || 'Default',
            expected_quantity: v.expected_quantity || 0,
            verified: true, verified_at: new Date().toISOString(), verified_by: validUserId
          })));
          if (variantError) {
            throw new Error(`Failed to save variants: ${variantError.message}`);
          }
        }

        inventoryId = editingInventoryId;
      } else {
        // CREATE new
        const productNum = manualForm.product_order_number || (() => {
          const now = new Date();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const hour = String(now.getHours()).padStart(2, '0');
          const min = String(now.getMinutes()).padStart(2, '0');
          const seq = String(Math.floor(Math.random() * 100)).padStart(2, '0');
          return `MAN-${month}${day}${hour}${min}-${seq}`;
        })();

        const { data: invData, error: insertError } = await supabase.from('inventory').insert({
          product_order_number: productNum,
          product_name: manualForm.product_name,
          order_number: manualForm.order_number || 'MANUAL',
          client_id: manualForm.client_id || null,
          client_name: clients.find(c => c.id === manualForm.client_id)?.name || 'Manual Entry',
          status: 'in_stock',
          rack_location: manualForm.rack_location,
          notes: manualForm.notes,
          received_at: new Date().toISOString(),
          received_by: validUserId
        }).select().single();

        if (insertError || !invData) {
          throw new Error(`Failed to create inventory: ${insertError?.message || 'No data returned'}`);
        }

        // Include variants with name OR quantity > 0, use "Default" if no name
        const validVariants = manualForm.variants.filter(v => v.variant_combo.trim() || v.expected_quantity > 0);
        if (validVariants.length > 0) {
          const { error: variantError } = await supabase.from('inventory_items').insert(validVariants.map(v => ({
            inventory_id: invData.id,
            variant_combo: v.variant_combo.trim() || 'Default',
            expected_quantity: v.expected_quantity || 0,
            verified: true, verified_at: new Date().toISOString(), verified_by: validUserId
          })));
          if (variantError) {
            throw new Error(`Failed to save variants: ${variantError.message}`);
          }
        }

        inventoryId = invData.id;
      }

      // Upload photos and wait for completion
      if (manualPhotos.length > 0 && inventoryId) {
        photoUploadResult = await uploadPhotos(inventoryId, manualPhotos, validUserId);
      }

      // Log the create/update action
      const validVariants = manualForm.variants.filter(v => v.variant_combo.trim() || v.expected_quantity > 0);
      await logInventoryAction({
        action: isEditing ? 'inventory_update' : 'inventory_create',
        userId: user?.id,
        userName: user?.name,
        inventoryId: inventoryId || undefined,
        durationMs: timer.elapsed(),
        details: {
          productName: manualForm.product_name,
          orderNumber: manualForm.order_number || 'MANUAL',
          clientName: clients.find(c => c.id === manualForm.client_id)?.name || 'Manual Entry',
          rackLocation: manualForm.rack_location,
          variantCount: validVariants.length,
          totalQuantity: validVariants.reduce((sum, v) => sum + (v.expected_quantity || 0), 0),
          photosUploaded: manualPhotos.length,
          photosSaved: photoUploadResult ? formatBytes(photoUploadResult.totalSavedBytes) : undefined,
        },
      });

      // Reset and close on success
      setManualForm({ product_order_number: '', product_name: '', order_number: '', client_id: '', rack_location: '', notes: '', variants: [{ variant_combo: '', expected_quantity: 0 }] });
      setManualPhotos([]);
      setClientSearch('');
      setEditingInventoryId(null);
      setManualEntryModal(false);
      fetchInventory(); fetchStats();

      // Notify user of partial photo upload failures
      if (photoUploadResult && !photoUploadResult.success) {
        alert(`Inventory saved, but ${photoUploadResult.failedCount} photo(s) failed to upload. Please try adding them again.`);
      }
    } catch (error) {
      console.error('Error saving manual entry:', error);
      alert(error instanceof Error ? error.message : 'Failed to save inventory. Please try again.');
    }
    setSaving(false);
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
      {/* Header */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Inventory</h1>
            <p className="text-gray-500 text-xs mt-0.5">Track incoming shipments and warehouse stock</p>
          </div>
          <div className="flex items-center gap-2">
            {(user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'warehouse') && (
              <button onClick={() => setManualEntryModal(true)} className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 text-sm font-medium">
                <Plus className="w-4 h-4" /><span className="hidden sm:inline">Add Manual</span>
              </button>
            )}
            <button onClick={() => { fetchInventory(); fetchStats(); }} className="p-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-3">
          <nav className="-mb-px flex gap-x-1 overflow-x-auto">
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

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-500" />
          </div>
          <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white min-w-[140px]">
            <option value="all">All Clients</option>
            {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </div>
      </div>

      {/* Content */}
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
          {/* Global Search Indicator */}
          {isGlobalSearch && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-blue-700">
                  Searching across <strong>all tabs</strong> — {filteredRecords.length} result{filteredRecords.length !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                onClick={() => { setSearchTerm(''); setIsGlobalSearch(false); }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear search
              </button>
            </div>
          )}

          {/* Records List */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {paginatedRecords.map((record) => {
                const thumbnail = getThumbnailInfo(record);

                return (
                  <div key={record.id} className="px-3 py-2 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2">
                      {/* Thumbnail */}
                      <button
                        onClick={() => thumbnail.count > 0 && openMediaViewer(record)}
                        disabled={thumbnail.count === 0}
                        className={`w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 relative ${
                          thumbnail.count > 0 ? 'cursor-pointer group' : 'cursor-default'
                        }`}
                      >
                        {thumbnail.type === 'image' && thumbnail.url ? (
                          <img src={thumbnail.url} alt="" className="w-full h-full object-cover bg-gray-100" />
                        ) : thumbnail.type === 'pdf' ? (
                          <div className="w-full h-full bg-red-50 flex flex-col items-center justify-center">
                            <FileText className="w-4 h-4 text-red-500" />
                          </div>
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-gray-300" />
                          </div>
                        )}
                        {thumbnail.count > 1 && (
                          <div className="absolute bottom-0 right-0 bg-black/70 text-white text-[8px] px-0.5 rounded-tl">
                            +{thumbnail.count - 1}
                          </div>
                        )}
                      </button>

                      {/* Product Name & Order Info */}
                      <div className="min-w-0 w-48 flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium text-gray-900 truncate">{record.product_name}</span>
                          {!record.order_product_id && (
                            <span className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-medium flex-shrink-0">M</span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500 truncate">
                          {record.order_number} • {record.product_order_number}
                        </div>
                      </div>

                      {/* Client */}
                      <div className="min-w-0 w-28 flex-shrink-0 hidden sm:block">
                        <span className="text-[9px] text-gray-400 uppercase">Client</span>
                        <span className="text-xs text-gray-700 truncate block font-medium">{record.client_name || '—'}</span>
                      </div>

                      {/* Status Column - shows during global search */}
                      {isGlobalSearch && (
                        <div className="w-20 flex-shrink-0">
                          <span className="text-[9px] text-gray-400 uppercase">Status</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSearchTerm('');
                              setIsGlobalSearch(false);
                              if (record.status === 'incoming') setActiveTab('incoming');
                              else if (record.status === 'in_stock') setActiveTab('inventory');
                              else setActiveTab('archive');
                            }}
                            className={`block px-2 py-0.5 rounded text-xs font-medium hover:opacity-80 ${
                              record.status === 'incoming' ? 'bg-amber-100 text-amber-700' :
                              record.status === 'in_stock' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-600'
                            }`}
                            title="Click to go to this tab"
                          >
                            {record.status === 'incoming' ? 'Incoming' :
                             record.status === 'in_stock' ? 'In Stock' : 'Archived'}
                          </button>
                        </div>
                      )}

                      {/* Qty */}
                      <div className="w-14 flex-shrink-0 hidden sm:block">
                        <span className="text-[9px] text-gray-400 uppercase">Qty</span>
                        <div>
                          <span className="text-xs font-bold text-gray-900">{record.total_quantity}</span>
                        </div>
                      </div>

                      {/* Rack */}
                      <div className="w-16 flex-shrink-0 hidden md:block">
                        <span className="text-[9px] text-gray-400 uppercase">Rack</span>
                        <div>
                          {record.rack_location ? (
                            <span className="text-xs font-semibold text-green-700">{record.rack_location}</span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                      </div>

                      {/* Variants */}
                      <div className="flex-1 min-w-0 hidden lg:block">
                        <span className="text-[9px] text-gray-400 uppercase">Variants</span>
                        <div className="flex items-center gap-1 overflow-hidden">
                          {record.items && record.items.length > 0 ? (
                            <>
                              {record.items.slice(0, 3).map((item: InventoryItem) => (
                                <span key={item.id} className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] whitespace-nowrap">
                                  {item.variant_combo}:<span className="font-semibold ml-0.5">{item.expected_quantity.toLocaleString()}</span>
                                </span>
                              ))}
                              {record.items.length > 3 && (
                                <span className="text-[10px] text-gray-400">+{record.items.length - 3}</span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="w-36 flex-shrink-0 hidden xl:block">
                        <span className="text-[9px] text-gray-400 uppercase">Notes</span>
                        <div>
                          {record.notes ? (
                            <span className="text-[11px] text-gray-600 truncate block" title={record.notes}>{record.notes}</span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                      </div>

                      {/* Status Badge (for incoming) */}
                      {activeTab === 'incoming' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium flex-shrink-0">
                          <Clock className="w-2.5 h-2.5" />Wait
                        </span>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => openNotesModal(record)}
                          className={record.notes ? 'p-1 rounded transition-colors text-blue-600 bg-blue-50 hover:bg-blue-100' : 'p-1 rounded transition-colors text-gray-400 hover:text-gray-600 hover:bg-gray-100'}
                          title={record.notes || 'Add notes'}>
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        {(user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'warehouse') && (
                          <button onClick={() => openEditModal(record)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(user?.role === 'super_admin' || user?.role === 'admin') && !record.order_product_id && (
                          <button onClick={() => setDeleteModal({ isOpen: true, record })} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {activeTab === 'incoming' && (
                          <button onClick={() => openReceiveModal(record)} className="px-2 py-1 bg-amber-500 text-white text-[10px] font-medium rounded hover:bg-amber-600 transition-colors whitespace-nowrap">
                            Received
                          </button>
                        )}
                        {activeTab === 'inventory' && (
                          <button onClick={() => setArchiveModal({ isOpen: true, record, pickedUpBy: '' })} className="px-2 py-1 bg-gray-500 text-white text-[10px] font-medium rounded hover:bg-gray-600 transition-colors whitespace-nowrap">
                            Picked Up
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pagination */}
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

      {/* ==================== MODALS ==================== */}

      {/* Media Viewer Modal */}
      {mediaModal.isOpen && mediaModal.files.length > 0 && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <button onClick={() => setMediaModal({ isOpen: false, files: [], currentIndex: 0, title: '' })}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-white/10 rounded-full z-10">
            <X className="w-6 h-6" />
          </button>

          <div className="absolute top-4 left-4 text-white z-10">
            <p className="font-medium text-sm truncate max-w-[200px] sm:max-w-none">{mediaModal.title}</p>
            <p className="text-white/60 text-xs">{mediaModal.currentIndex + 1} / {mediaModal.files.length}</p>
          </div>

          {mediaModal.files.length > 1 && (
            <>
              <button onClick={prevFile} className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 text-white/80 hover:text-white bg-white/10 rounded-full z-10">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button onClick={nextFile} className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 text-white/80 hover:text-white bg-white/10 rounded-full z-10">
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Current File Display */}
          <div className="max-w-4xl w-full max-h-[80vh] flex items-center justify-center">
            {mediaModal.files[mediaModal.currentIndex].type === 'image' ? (
              <img
                src={mediaModal.files[mediaModal.currentIndex].url}
                alt={mediaModal.files[mediaModal.currentIndex].name}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            ) : (
              <div className="bg-white rounded-xl p-8 text-center max-w-sm w-full">
                <div className="w-20 h-20 mx-auto bg-red-100 rounded-xl flex items-center justify-center mb-4">
                  <FileText className="w-10 h-10 text-red-500" />
                </div>
                <p className="font-medium text-gray-900 mb-1 truncate px-4">{mediaModal.files[mediaModal.currentIndex].name}</p>
                <p className="text-sm text-gray-500 mb-4">PDF Document</p>
                <button
                  onClick={() => openPdfInNewTab(mediaModal.files[mediaModal.currentIndex].url)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open PDF
                </button>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {mediaModal.files.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 p-2 rounded-lg max-w-[90vw] overflow-x-auto">
              {mediaModal.files.map((file, idx) => (
                <button
                  key={idx}
                  onClick={() => setMediaModal(prev => ({ ...prev, currentIndex: idx }))}
                  className={`w-12 h-12 rounded overflow-hidden border-2 transition-colors flex-shrink-0 ${
                    idx === mediaModal.currentIndex ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  {file.type === 'image' ? (
                    <img src={file.url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-red-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-red-500" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mark Received Modal */}
      {receiveModal.isOpen && receiveModal.record && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl my-4">
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Mark as Received</h3>
                <p className="text-xs text-gray-500">{receiveModal.record.order_number} • {receiveModal.record.product_order_number}</p>
              </div>
              <button onClick={() => setReceiveModal({ isOpen: false, record: null, rack_location: '', items: [], capturedPhotos: [] })} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto">
              {/* Product Info */}
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                {getThumbnailInfo(receiveModal.record).type !== 'none' && (
                  <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
                    {getThumbnailInfo(receiveModal.record).type === 'image' ? (
                      <img src={getThumbnailInfo(receiveModal.record).url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-red-50 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-red-500" />
                      </div>
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{receiveModal.record.product_name}</p>
                  <p className="text-xs text-gray-500">{receiveModal.record.client_name} • {receiveModal.record.total_quantity} units</p>
                </div>
              </div>

              {/* Rack Location */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Rack Location</label>
                <input type="text" value={receiveModal.rack_location} onChange={(e) => setReceiveModal(prev => ({ ...prev, rack_location: e.target.value }))}
                  placeholder="e.g., A-12-3" className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400" />
              </div>

              {/* Variants */}
              {receiveModal.items.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 text-xs">Verify Items ({receiveModal.items.length})</h4>
                    <button onClick={toggleAllVerified} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                      {receiveModal.items.every(item => item.verified) ? <><CheckSquare className="w-3.5 h-3.5" />Uncheck</> : <><Square className="w-3.5 h-3.5" />Check All</>}
                    </button>
                  </div>
                  <div className="space-y-1">
                    {receiveModal.record.items?.map((item) => {
                      const editItem = receiveModal.items.find(i => i.id === item.id);
                      return (
                        <div key={item.id} className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg">
                          <button onClick={() => toggleItemVerified(item.id)} className="flex-shrink-0">
                            {editItem?.verified ? <CheckSquare className="w-4 h-4 text-green-600" /> : <Square className="w-4 h-4 text-gray-400" />}
                          </button>
                          <span className="flex-1 text-sm text-gray-900 truncate">{item.variant_combo}</span>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded min-w-[60px] text-center">{item.expected_quantity.toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Camera Capture */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Photos (optional)</label>
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" multiple onChange={handleReceiveFileCapture} className="hidden" />
                <div className="flex flex-wrap gap-2">
                  {receiveModal.capturedPhotos.map((photo, idx) => (
                    <div key={idx} className="relative w-14 h-14">
                      <img src={photo.preview} alt="" className="w-full h-full object-cover rounded-lg" />
                      <button onClick={() => removeReceivePhoto(idx)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => fileInputRef.current?.click()}
                    className="w-14 h-14 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
                    <Camera className="w-4 h-4" />
                    <span className="text-[9px] mt-0.5">Add</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-gray-200 flex gap-2">
              <button onClick={() => setReceiveModal({ isOpen: false, record: null, rack_location: '', items: [], capturedPhotos: [] })} className="flex-1 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
              <button onClick={handleMarkReceived} disabled={saving} className="flex-1 px-3 py-1.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm flex items-center justify-center gap-1.5">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Save className="w-4 h-4" />Save</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
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

      {/* Archive Modal */}
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

      {/* Delete Modal */}
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

      {/* Manual Entry Modal */}
      {manualEntryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl my-4">
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{editingInventoryId ? 'Edit Inventory' : 'Add Manual Entry'}</h3>
              <button onClick={() => { setManualEntryModal(false); setManualPhotos([]); setClientSearch(''); setEditingInventoryId(null); setEditingRecord(null); }} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Product Name <span className="text-red-500">*</span></label>
                <input type="text" value={manualForm.product_name} onChange={(e) => setManualForm(prev => ({ ...prev, product_name: e.target.value }))}
                  placeholder="Enter product name" className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Product #</label>
                  <input type="text" value={manualForm.product_order_number} onChange={(e) => setManualForm(prev => ({ ...prev, product_order_number: e.target.value }))}
                    placeholder="Auto-generated" className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Order #</label>
                  <input type="text" value={manualForm.order_number} onChange={(e) => setManualForm(prev => ({ ...prev, order_number: e.target.value }))}
                    placeholder="Optional" className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400" />
                </div>
              </div>

              {/* Ajax Searchable Client */}
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Client</label>
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setShowClientDropdown(true);
                      if (!e.target.value) setManualForm(prev => ({ ...prev, client_id: '' }));
                    }}
                    onFocus={() => setShowClientDropdown(true)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Type to search..."
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400"
                  />
                  {showClientDropdown && clientSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-32 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                      {filteredClients.length > 0 ? (
                        filteredClients.slice(0, 5).map(client => (
                          <button key={client.id} onClick={() => selectClient(client)}
                            className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-100">
                            {client.name}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-gray-500">No clients found</div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rack Location</label>
                  <input type="text" value={manualForm.rack_location} onChange={(e) => setManualForm(prev => ({ ...prev, rack_location: e.target.value }))}
                    placeholder="A-12-3" className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400" />
                </div>
              </div>

              {/* Variants */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-700">Variants</label>
                  <button onClick={addVariantRow} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5"><Plus className="w-3 h-3" />Add</button>
                </div>
                <div className="space-y-1.5">
                  {manualForm.variants.map((variant, index) => (
                    <div key={variant.id || index} className="flex items-center gap-1.5">
                      <input type="text" value={variant.variant_combo} onChange={(e) => updateVariant(index, 'variant_combo', e.target.value)}
                        placeholder="M / Red" className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs text-gray-900 placeholder-gray-400" />
                      <input type="number" value={variant.expected_quantity || ''} onChange={(e) => updateVariant(index, 'expected_quantity', parseInt(e.target.value) || 0)}
                        placeholder="Qty" className="w-28 px-2 py-1 border border-gray-300 rounded text-xs text-gray-900 placeholder-gray-400" />
                      {/* Pickup & History buttons for existing items */}
                      {editingRecord && variant.id && (
                        <>
                          <button
                            onClick={() => {
                              const item = editingRecord.items?.find(i => i.id === variant.id);
                              if (item) openPickupModal(item, editingRecord, 'pickup');
                            }}
                            className="p-1 text-amber-600 hover:bg-amber-50 rounded transition-colors"
                            title="Record Pickup"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const item = editingRecord.items?.find(i => i.id === variant.id);
                              if (item) openHistoryModal(item, editingRecord);
                            }}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="View History"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {manualForm.variants.length > 1 && <button onClick={() => removeVariantRow(index)} className="p-0.5 text-red-500 hover:bg-red-50 rounded"><X className="w-3.5 h-3.5" /></button>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={manualForm.notes} onChange={(e) => setManualForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add notes..." rows={2} className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400" />
              </div>

              {/* Camera Capture */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Photos</label>
                <input ref={manualFileInputRef} type="file" accept="image/*" capture="environment" multiple onChange={handleManualFileCapture} className="hidden" />
                <div className="flex flex-wrap gap-2">
                  {manualPhotos.map((photo, idx) => (
                    <div key={idx} className="relative w-14 h-14">
                      <img src={photo.preview} alt="" className="w-full h-full object-cover rounded-lg" />
                      <button onClick={() => removeManualPhoto(idx)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => manualFileInputRef.current?.click()}
                    className="w-14 h-14 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
                    <Camera className="w-4 h-4" />
                    <span className="text-[9px] mt-0.5">Add</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="p-3 border-t border-gray-200 flex gap-2">
              <button onClick={() => { setManualEntryModal(false); setManualPhotos([]); setClientSearch(''); setEditingInventoryId(null); setEditingRecord(null); }} className="flex-1 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
              <button onClick={handleManualEntry} disabled={saving || !manualForm.product_name.trim()} className="flex-1 px-3 py-1.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center justify-center gap-1.5">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : editingInventoryId ? <><Save className="w-4 h-4" />Update</> : <><Plus className="w-4 h-4" />Add</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pickup/Transaction Modal */}
      {pickupModal.isOpen && pickupModal.item && pickupModal.record && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl max-w-sm w-full shadow-xl">
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {pickupModal.transactionType === 'pickup' ? 'Record Pickup' :
                 pickupModal.transactionType === 'restock' ? 'Add Stock' : 'Adjust Quantity'}
              </h3>
              <button onClick={() => setPickupModal({ isOpen: false, item: null, record: null, quantity: 0, pickedUpBy: '', notes: '', transactionType: 'pickup' })} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Item Info */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{pickupModal.item.variant_combo}</p>
                <p className="text-xs text-gray-500 mt-0.5">{pickupModal.record.product_name} • {pickupModal.record.order_number}</p>
                <p className="text-lg font-bold text-gray-900 mt-2">Current: {pickupModal.item.expected_quantity.toLocaleString()}</p>
              </div>

              {/* Transaction Type Selector */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Transaction Type</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPickupModal(prev => ({ ...prev, transactionType: 'pickup' }))}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      pickupModal.transactionType === 'pickup' ? 'bg-amber-100 text-amber-700 border-2 border-amber-500' : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                    }`}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />Pickup
                  </button>
                  <button
                    onClick={() => setPickupModal(prev => ({ ...prev, transactionType: 'restock' }))}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      pickupModal.transactionType === 'restock' ? 'bg-green-100 text-green-700 border-2 border-green-500' : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                    }`}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />Restock
                  </button>
                  <button
                    onClick={() => setPickupModal(prev => ({ ...prev, transactionType: 'adjustment' }))}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      pickupModal.transactionType === 'adjustment' ? 'bg-blue-100 text-blue-700 border-2 border-blue-500' : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                    }`}
                  >
                    <Pencil className="w-3.5 h-3.5" />Adjust
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {pickupModal.transactionType === 'pickup' ? 'Quantity Picked Up' :
                   pickupModal.transactionType === 'restock' ? 'Quantity Added' : 'Quantity to Remove'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={pickupModal.quantity || ''}
                  onChange={(e) => setPickupModal(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  placeholder="Enter quantity"
                />
                {pickupModal.quantity > 0 && (
                  <p className="text-xs mt-1 text-gray-500">
                    New quantity: <span className="font-semibold">{
                      (pickupModal.transactionType === 'restock'
                        ? pickupModal.item.expected_quantity + pickupModal.quantity
                        : pickupModal.item.expected_quantity - pickupModal.quantity
                      ).toLocaleString()
                    }</span>
                  </p>
                )}
              </div>

              {/* Picked Up By */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {pickupModal.transactionType === 'pickup' ? 'Picked Up By' : 'Processed By'}
                </label>
                <input
                  type="text"
                  value={pickupModal.pickedUpBy}
                  onChange={(e) => setPickupModal(prev => ({ ...prev, pickedUpBy: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  placeholder="Name of person/driver"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={pickupModal.notes}
                  onChange={(e) => setPickupModal(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            <div className="p-3 border-t border-gray-200 flex gap-2">
              <button
                onClick={() => setPickupModal({ isOpen: false, item: null, record: null, quantity: 0, pickedUpBy: '', notes: '', transactionType: 'pickup' })}
                className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handlePickupTransaction}
                disabled={saving || pickupModal.quantity <= 0}
                className={`flex-1 px-3 py-2 text-white font-medium rounded-lg disabled:opacity-50 text-sm flex items-center justify-center gap-1.5 ${
                  pickupModal.transactionType === 'pickup' ? 'bg-amber-600 hover:bg-amber-700' :
                  pickupModal.transactionType === 'restock' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Save className="w-4 h-4" />Confirm</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModal.isOpen && historyModal.item && historyModal.record && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl max-h-[80vh] flex flex-col">
            <div className="p-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-semibold text-gray-900">Transaction History</h3>
                <p className="text-xs text-gray-500">{historyModal.item.variant_combo} • {historyModal.record.product_name}</p>
              </div>
              <button onClick={() => setHistoryModal({ isOpen: false, item: null, record: null, transactions: [], loading: false })} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-3 flex-1 overflow-y-auto">
              {historyModal.loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : historyModal.transactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <History className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No transaction history yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {historyModal.transactions.map((tx) => (
                    <div key={tx.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          tx.transaction_type === 'pickup' ? 'bg-amber-100 text-amber-700' :
                          tx.transaction_type === 'restock' ? 'bg-green-100 text-green-700' :
                          tx.transaction_type === 'adjustment' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'
                        }`}>
                          {tx.transaction_type === 'pickup' && <ArrowDown className="w-3 h-3" />}
                          {tx.transaction_type === 'restock' && <ArrowUp className="w-3 h-3" />}
                          {tx.transaction_type === 'adjustment' && <Pencil className="w-3 h-3" />}
                          {tx.transaction_type.charAt(0).toUpperCase() + tx.transaction_type.slice(1)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(tx.created_at).toLocaleDateString()} {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500">{tx.quantity_before.toLocaleString()}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-semibold text-gray-900">{tx.quantity_after.toLocaleString()}</span>
                        <span className={`text-xs font-medium ${tx.quantity_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ({tx.quantity_change > 0 ? '+' : ''}{tx.quantity_change.toLocaleString()})
                        </span>
                      </div>
                      {tx.picked_up_by && (
                        <p className="text-xs text-gray-600 mt-1">By: {tx.picked_up_by}</p>
                      )}
                      {tx.notes && (
                        <p className="text-xs text-gray-500 mt-1 italic">{tx.notes}</p>
                      )}
                      {tx.created_by_name && (
                        <p className="text-xs text-gray-400 mt-1">Recorded by: {tx.created_by_name}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-3 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={() => setHistoryModal({ isOpen: false, item: null, record: null, transactions: [], loading: false })}
                className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}