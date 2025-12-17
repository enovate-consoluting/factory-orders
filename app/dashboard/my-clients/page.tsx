/**
 * My Clients Page - /dashboard/my-clients
 * Allows Primary Clients to view, add, and remove sub-clients
 * Includes logo upload, per-field validation, auto-format phone
 * Roles: Client (with can_create_orders = true only)
 * Last Modified: December 2025
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Users,
  Plus,
  Building2,
  Mail,
  Phone,
  ShoppingCart,
  DollarSign,
  Loader2,
  X,
  AlertCircle,
  CheckCircle,
  Info,
  Trash2,
  Upload,
  Image as ImageIcon,
  PlusSquare
} from 'lucide-react';

interface SubClient {
  id: string;
  name: string;
  contact_person?: string;
  email: string;
  phone?: string;
  logo_url?: string;
  created_at: string;
  order_count?: number;
  total_amount?: number;
}

interface CurrentClient {
  id: string;
  name: string;
  email: string;
  can_create_orders: boolean;
}

export default function MyClientsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [currentClient, setCurrentClient] = useState<CurrentClient | null>(null);
  const [subClients, setSubClients] = useState<SubClient[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<SubClient | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: ''
  });

  // Field-level errors
  const [fieldErrors, setFieldErrors] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: ''
  });

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Auto-format phone number on blur
  const formatPhoneNumber = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return '';
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneBlur = () => {
    if (formData.phone.trim()) {
      const formatted = formatPhoneNumber(formData.phone);
      setFormData({ ...formData, phone: formatted });
      
      const digits = formData.phone.replace(/\D/g, '');
      if (digits.length > 0 && digits.length !== 10) {
        setFieldErrors(prev => ({ ...prev, phone: 'Please enter a valid 10-digit phone number' }));
      } else {
        setFieldErrors(prev => ({ ...prev, phone: '' }));
      }
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailBlur = () => {
    if (formData.email.trim() && !validateEmail(formData.email.trim())) {
      setFieldErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
    } else if (!formData.email.trim()) {
      setFieldErrors(prev => ({ ...prev, email: 'Email is required' }));
    } else {
      setFieldErrors(prev => ({ ...prev, email: '' }));
    }
  };

  // Logo upload handler
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setToast({ message: 'Please select an image file', type: 'error' });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setToast({ message: 'Image must be less than 2MB', type: 'error' });
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadLogo = async (clientId: string): Promise<string | null> => {
    if (!logoFile) return null;

    try {
      setUploadingLogo(true);
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `${clientId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('client-logos')
        .upload(filePath, logoFile);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('client-logos')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading logo:', error);
      return null;
    } finally {
      setUploadingLogo(false);
    }
  };

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      return;
    }

    const user = JSON.parse(userData);
    if (user.role !== 'client') {
      router.push('/dashboard');
      return;
    }

    loadClientData(user);
  }, [router]);

  const loadClientData = async (user: any) => {
    try {
      setLoading(true);

      const { data: client, error } = await supabase
        .from('clients')
        .select('id, name, email, can_create_orders')
        .eq('email', user.email)
        .single();

      if (error || !client) {
        console.error('Error loading client:', error);
        router.push('/dashboard');
        return;
      }

      if (!client.can_create_orders) {
        router.push('/dashboard');
        return;
      }

      setCurrentClient(client);
      await loadSubClients(client.id);
    } catch (error) {
      console.error('Error:', error);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadSubClients = async (parentId: string) => {
    try {
      const { data: clients, error } = await supabase
        .from('clients')
        .select('id, name, contact_person, email, phone, logo_url, created_at')
        .eq('parent_client_id', parentId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading sub-clients:', error);
        setToast({ message: 'Unable to load clients. Please refresh.', type: 'error' });
        return;
      }

      // Get order counts for each sub-client
      const clientsWithStats = await Promise.all(
        (clients || []).map(async (client) => {
          const { data: orders } = await supabase
            .from('orders')
            .select('id, order_products(client_product_price, order_items(quantity))')
            .eq('client_id', client.id);

          let orderCount = orders?.length || 0;
          let totalAmount = 0;

          orders?.forEach((order: any) => {
            order.order_products?.forEach((product: any) => {
              const price = parseFloat(product.client_product_price || 0);
              const qty = product.order_items?.reduce((sum: number, item: any) => 
                sum + (item.quantity || 0), 0) || 0;
              totalAmount += price * qty;
            });
          });

          return { ...client, order_count: orderCount, total_amount: totalAmount };
        })
      );

      setSubClients(clientsWithStats);
    } catch (error) {
      console.error('Error:', error);
      setToast({ message: 'Error loading clients.', type: 'error' });
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    try {
      const { companyName, contactName, email, phone } = formData;
      const newFieldErrors = { companyName: '', contactName: '', email: '', phone: '' };
      let hasErrors = false;

      // Validate Company Name
      if (!companyName.trim()) {
        newFieldErrors.companyName = 'Company Name is required';
        hasErrors = true;
      }

      // Validate Contact Name
      if (!contactName.trim()) {
        newFieldErrors.contactName = 'Contact Name is required';
        hasErrors = true;
      }

      // Validate Email
      if (!email.trim()) {
        newFieldErrors.email = 'Email is required';
        hasErrors = true;
      } else if (!validateEmail(email.trim())) {
        newFieldErrors.email = 'Please enter a valid email address';
        hasErrors = true;
      }

      // Validate Phone (optional but must be valid if provided)
      if (phone.trim()) {
        const digits = phone.replace(/\D/g, '');
        if (digits.length !== 10) {
          newFieldErrors.phone = 'Please enter a valid 10-digit phone number';
          hasErrors = true;
        }
      }

      setFieldErrors(newFieldErrors);

      if (hasErrors) {
        setFormError('Please fix the errors below.');
        setSubmitting(false);
        return;
      }

      setFormError('');

      // Check if client already exists
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .or(`email.ilike.${email},name.ilike.${companyName}`)
        .maybeSingle();

      if (existingClient) {
        setFormError('This client may already exist. Please contact sales@bybirdhaus.com for assistance.');
        setSubmitting(false);
        return;
      }

      // Create client first to get ID for logo upload
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
          name: companyName.trim(),
          contact_person: contactName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() ? formatPhoneNumber(phone) : null,
          parent_client_id: currentClient?.id,
          can_create_orders: false,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error || !newClient) {
        console.error('Error creating client:', error);
        setFormError('Failed to add client. Please try again.');
        setSubmitting(false);
        return;
      }

      // Upload logo if selected
      if (logoFile) {
        const logoUrl = await uploadLogo(newClient.id);
        if (logoUrl) {
          await supabase
            .from('clients')
            .update({ logo_url: logoUrl })
            .eq('id', newClient.id);
        }
      }

      setFormSuccess('Client added successfully!');
      setFormData({ companyName: '', contactName: '', email: '', phone: '' });
      setLogoFile(null);
      setLogoPreview(null);
      
      if (currentClient) {
        await loadSubClients(currentClient.id);
      }

      setTimeout(() => {
        setShowAddModal(false);
        setFormSuccess('');
        setToast({ message: `${companyName.trim()} has been added!`, type: 'success' });
      }, 1000);

    } catch (error) {
      console.error('Error:', error);
      setFormError('An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveClient = async (client: SubClient) => {
    setDeletingId(client.id);
    
    try {
      if (client.order_count && client.order_count > 0) {
        setToast({ 
          message: `Cannot remove ${client.name} - they have ${client.order_count} order(s). Contact support.`, 
          type: 'error' 
        });
        setShowDeleteConfirm(null);
        setDeletingId(null);
        return;
      }

      const { error } = await supabase
        .from('clients')
        .update({ parent_client_id: null })
        .eq('id', client.id);

      if (error) {
        console.error('Error removing client:', error);
        setToast({ message: 'Failed to remove client. Please try again.', type: 'error' });
        return;
      }

      if (currentClient) {
        await loadSubClients(currentClient.id);
      }

      setToast({ message: `${client.name} has been removed from your clients.`, type: 'success' });
      setShowDeleteConfirm(null);

    } catch (error) {
      console.error('Error:', error);
      setToast({ message: 'Something went wrong.', type: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const openModal = () => {
    setFormData({ companyName: '', contactName: '', email: '', phone: '' });
    setFieldErrors({ companyName: '', contactName: '', email: '', phone: '' });
    setFormError('');
    setFormSuccess('');
    setLogoFile(null);
    setLogoPreview(null);
    setShowAddModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
          <p className="mt-3 text-gray-500 text-sm">Loading your clients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Clients</h1>
              <p className="text-gray-500 mt-1">Manage clients under your account</p>
            </div>
            <button
              onClick={openModal}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Add Client
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Blue Info Banner */}
        <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">About My Clients</p>
            <p className="mt-1 text-blue-700">
              Add clients you work with. You can create orders on their behalf and view their order history. 
              Clients with orders cannot be removed.
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{subClients.length}</p>
              <p className="text-sm text-gray-500">Total Clients</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {subClients.reduce((sum, c) => sum + (c.order_count || 0), 0)}
              </p>
              <p className="text-sm text-gray-500">Total Orders</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                ${formatCurrency(subClients.reduce((sum, c) => sum + (c.total_amount || 0), 0))}
              </p>
              <p className="text-sm text-gray-500">Total Value</p>
            </div>
          </div>
        </div>

        {/* Client List - Tighter Cards */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {subClients.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-700 font-medium">No clients yet</p>
              <p className="text-gray-400 text-sm mt-1">Add your first client to get started</p>
              <button
                onClick={openModal}
                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Client
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {subClients.map((client) => (
                <div key={client.id} className="px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-4">
                  {/* Logo or Initial */}
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600">
                    {client.logo_url ? (
                      <img src={client.logo_url} alt={client.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-semibold text-sm">
                        {client.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Client Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 text-sm truncate">{client.name}</h3>
                      {client.contact_person && (
                        <span className="text-xs text-gray-400">• {client.contact_person}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {client.email}
                      </span>
                      {client.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {client.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats & Actions */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Orders - Clean clickable box */}
                    <a
                      href={`/dashboard/orders/client?viewAs=${client.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-center px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
                      title="View orders for this client"
                    >
                      <p className="font-semibold text-blue-700 text-sm">{client.order_count || 0}</p>
                      <p className="text-xs text-blue-500">Orders</p>
                    </a>
                    
                    <div className="text-center px-2">
                      <p className="font-semibold text-gray-900 text-sm">${formatCurrency(client.total_amount || 0)}</p>
                      <p className="text-xs text-gray-400">Total</p>
                    </div>
                    
                    {/* Create Order Button - Simple green + */}
                    <a
                      href={`/dashboard/orders/client/create?forClient=${client.id}`}
                      className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                      title="Create order for this client"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <PlusSquare className="w-5 h-5" />
                    </a>
                    
                    {/* Remove Button - Simple red trash */}
                    <button
                      onClick={() => setShowDeleteConfirm(client)}
                      disabled={deletingId === client.id}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Remove client"
                    >
                      {deletingId === client.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-400">
          Need help? Contact{' '}
          <a href="mailto:sales@bybirdhaus.com" className="text-blue-600 hover:text-blue-700 font-medium">
            sales@bybirdhaus.com
          </a>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 ${
          toast.type === 'success' ? 'bg-green-600 text-white' :
          toast.type === 'error' ? 'bg-red-600 text-white' :
          'bg-blue-600 text-white'
        }`}>
          {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5" />}
          {toast.type === 'info' && <Info className="w-5 h-5" />}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 p-1 hover:bg-white/20 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full shadow-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Remove Client?</h3>
                <p className="text-xs text-gray-500">This will disconnect them from your account</p>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-3">
              Remove <strong>{showDeleteConfirm.name}</strong> from your clients?
            </p>

            {showDeleteConfirm.order_count && showDeleteConfirm.order_count > 0 && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                <p className="text-xs text-amber-700">
                  This client has {showDeleteConfirm.order_count} order(s) and cannot be removed.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemoveClient(showDeleteConfirm)}
                disabled={deletingId === showDeleteConfirm.id || (showDeleteConfirm.order_count || 0) > 0}
                className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deletingId === showDeleteConfirm.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Remove'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white">
              <div>
                <h3 className="font-semibold text-gray-900">Add New Client</h3>
                <p className="text-xs text-gray-500">Enter client details</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleAddClient} className="p-5 space-y-4">
              {formError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{formError}</p>
                </div>
              )}

              {formSuccess && (
                <div className="p-2.5 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-green-700">{formSuccess}</p>
                </div>
              )}

              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Logo <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="flex items-center gap-3">
                  {logoPreview ? (
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                      <img src={logoPreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={removeLogo}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors"
                    >
                      <Upload className="w-5 h-5" />
                      <span className="text-[10px] mt-0.5">Upload</span>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoSelect}
                    className="hidden"
                  />
                  <p className="text-xs text-gray-400">PNG, JPG up to 2MB</p>
                </div>
              </div>

              {/* Company Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => {
                    setFormData({ ...formData, companyName: e.target.value });
                    if (fieldErrors.companyName) setFieldErrors(prev => ({ ...prev, companyName: '' }));
                  }}
                  onBlur={() => {
                    if (!formData.companyName.trim()) {
                      setFieldErrors(prev => ({ ...prev, companyName: 'Company Name is required' }));
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    fieldErrors.companyName ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Acme Corporation"
                  disabled={submitting}
                />
                {fieldErrors.companyName && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.companyName}
                  </p>
                )}
              </div>

              {/* Contact Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => {
                    setFormData({ ...formData, contactName: e.target.value });
                    if (fieldErrors.contactName) setFieldErrors(prev => ({ ...prev, contactName: '' }));
                  }}
                  onBlur={() => {
                    if (!formData.contactName.trim()) {
                      setFieldErrors(prev => ({ ...prev, contactName: 'Contact Name is required' }));
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    fieldErrors.contactName ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="John Smith"
                  disabled={submitting}
                />
                {fieldErrors.contactName && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.contactName}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
                  }}
                  onBlur={handleEmailBlur}
                  className={`w-full px-3 py-2 border rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    fieldErrors.email ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="john@acme.com"
                  disabled={submitting}
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData({ ...formData, phone: e.target.value });
                    if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: '' }));
                  }}
                  onBlur={handlePhoneBlur}
                  className={`w-full px-3 py-2 border rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    fieldErrors.phone ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="(555) 123-4567"
                  disabled={submitting}
                />
                {fieldErrors.phone && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.phone}
                  </p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingLogo}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting || uploadingLogo ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {submitting ? 'Adding...' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
