/**
 * Client Create Order Request Page - /dashboard/orders/client/create
 * Simplified order request form for clients with can_create_orders = true
 * FIXED: Now creates ALL order_items (including qty=0) so admin can fill in quantities
 * Roles: Client (with can_create_orders permission)
 * Last Modified: December 2025
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, ArrowRight, Search, Package, Check, 
  Loader2, CheckCircle2, Plus, Minus, X, FileText,
  ShoppingCart, Send, ChevronDown, ChevronRight, ImageIcon
} from 'lucide-react';

interface Product {
  id: string;
  title: string;
  description: string;
  image_url?: string;
  variants?: {
    type: string;
    options: string[];
  }[];
}

interface VariantItem {
  variantCombo: string;
  quantity: number;
  notes: string;
}

interface ProductInstance {
  instanceId: string;
  product: Product;
  productDescription: string;
  items: VariantItem[];
  expanded: boolean;
}

// Image Modal Component
function ImageModal({ 
  isOpen, 
  imageUrl, 
  title, 
  onClose 
}: { 
  isOpen: boolean; 
  imageUrl: string; 
  title: string; 
  onClose: () => void;
}) {
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div 
        className="relative max-w-3xl max-h-[90vh] bg-white rounded-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900 truncate">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4">
          <img 
            src={imageUrl} 
            alt={title}
            className="max-w-full max-h-[70vh] object-contain mx-auto rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}

// Loading overlay component
function LoadingOverlay({
  isVisible,
  currentStep,
  steps,
  orderNumber
}: {
  isVisible: boolean;
  currentStep: number;
  steps: string[];
  orderNumber?: string;
}) {
  if (!isVisible) return null;

  const isComplete = currentStep >= steps.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-purple-900/30 to-indigo-900/40 backdrop-blur-md" />
      
      <div className="relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-3xl opacity-20 blur-xl animate-pulse" />
        
        <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl px-6 sm:px-8 py-6 min-w-[300px] sm:min-w-[340px]">
          <div className="flex items-center gap-4 mb-4">
            {isComplete ? (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-7 h-7 text-white" />
              </div>
            ) : (
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 animate-pulse" />
                <div className="absolute inset-1 rounded-full bg-white flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                </div>
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {isComplete ? 'Request Submitted!' : 'Submitting Request...'}
              </h3>
              {orderNumber && (
                <p className="text-sm font-mono text-blue-600">{orderNumber}</p>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            {steps.map((step, index) => {
              const isDone = index < currentStep;
              const isActive = index === currentStep;
              
              return (
                <div 
                  key={index}
                  className={`flex items-center gap-3 transition-all duration-300 ${
                    isDone ? 'text-emerald-600' : isActive ? 'text-blue-600' : 'text-gray-300'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  ) : isActive ? (
                    <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-current flex-shrink-0" />
                  )}
                  <span className={`text-sm ${isDone || isActive ? 'font-medium' : ''}`}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClientCreateOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forClientId = searchParams.get('forClient');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  // User & client data
  const [userId, setUserId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [canCreateOrders, setCanCreateOrders] = useState(false);
  const [forClientName, setForClientName] = useState<string | null>(null);
  
  // Products
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productInstances, setProductInstances] = useState<ProductInstance[]>([]);
  
  // Order details
  const [orderName, setOrderName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  
  // Image modal
  const [imageModal, setImageModal] = useState<{ isOpen: boolean; imageUrl: string; title: string }>({
    isOpen: false,
    imageUrl: '',
    title: ''
  });
  
  // Loading overlay
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingSteps] = useState(['Creating request...', 'Adding products...', 'Adding variants...', 'Finalizing...']);
  const [createdOrderNumber, setCreatedOrderNumber] = useState('');
  
  // Notification
  const [notification, setNotification] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'info';
    message: string;
  }>({ show: false, type: 'success', message: '' });

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ show: true, type, message });
    setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 5000);
  };

  useEffect(() => {
    checkPermissionsAndLoadData();
  }, []);

  const checkPermissionsAndLoadData = async () => {
    try {
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

      setUserId(user.id);

      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, name, can_create_orders, email')
        .eq('email', user.email)
        .single();

      if (clientError || !clientData) {
        console.error('Client error:', clientError);
        showNotification('error', 'Unable to verify client permissions');
        setLoading(false);
        return;
      }

      if (!clientData.can_create_orders) {
        showNotification('error', 'You do not have permission to create order requests');
        setCanCreateOrders(false);
        setLoading(false);
        return;
      }

      setCanCreateOrders(true);

      // Check if creating order for a sub-client
      if (forClientId) {
        // Verify this sub-client belongs to the current user
        const { data: subClient, error: subClientError } = await supabase
          .from('clients')
          .select('id, name, parent_client_id')
          .eq('id', forClientId)
          .eq('parent_client_id', clientData.id)
          .single();
        
        if (subClientError || !subClient) {
          showNotification('error', 'You do not have permission to create orders for this client');
          router.push('/dashboard/my-clients');
          return;
        }
        
        // Use sub-client's info for the order
        setClientId(subClient.id);
        setClientName(subClient.name);
        setForClientName(subClient.name);
      } else {
        // Use current user's client info
        setClientId(clientData.id);
        setClientName(clientData.name);
      }

      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          id,
          title,
          description,
          image_url,
          product_variants (
            variant_option_id,
            variant_options (
              id,
              value,
              variant_types (
                id,
                name
              )
            )
          )
        `)
        .order('title');
      
      if (productsError) {
        console.error('Products error:', productsError);
        showNotification('error', 'Failed to load products');
      }

      if (productsData) {
        const processedProducts = productsData.map(product => {
          const variantsByType: { [key: string]: string[] } = {};
          
          product.product_variants?.forEach((pv: any) => {
            const typeName = pv.variant_options?.variant_types?.name;
            const optionValue = pv.variant_options?.value;
            
            if (typeName && optionValue) {
              if (!variantsByType[typeName]) {
                variantsByType[typeName] = [];
              }
              if (!variantsByType[typeName].includes(optionValue)) {
                variantsByType[typeName].push(optionValue);
              }
            }
          });
          
          return {
            id: product.id,
            title: product.title,
            description: product.description,
            image_url: product.image_url,
            variants: Object.entries(variantsByType).map(([type, options]) => ({
              type,
              options
            }))
          };
        });
        
        setProducts(processedProducts);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      showNotification('error', 'Error loading page');
    } finally {
      setLoading(false);
    }
  };

  const generateVariantCombos = (product: Product): string[] => {
    if (!product.variants || product.variants.length === 0) {
      return ['Standard'];
    }
    
    const combos: string[] = [];
    
    const generate = (index: number, current: string[]) => {
      if (index === product.variants!.length) {
        combos.push(current.join(' / '));
        return;
      }
      
      product.variants![index].options.forEach((option) => {
        generate(index + 1, [...current, option]);
      });
    };
    
    generate(0, []);
    return combos;
  };

  const generateInstanceId = () => {
    return `inst-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const filteredProducts = products.filter(product =>
    product.title.toLowerCase().includes(productSearch.toLowerCase()) ||
    (product.description && product.description.toLowerCase().includes(productSearch.toLowerCase()))
  );

  const getProductInstanceCount = (productId: string) => {
    return productInstances.filter(pi => pi.product.id === productId).length;
  };

  const addProductInstance = (product: Product) => {
    const variantCombos = generateVariantCombos(product);
    const items: VariantItem[] = variantCombos.map(combo => ({
      variantCombo: combo,
      quantity: 0,
      notes: ''
    }));
    
    const newInstance: ProductInstance = {
      instanceId: generateInstanceId(),
      product,
      productDescription: '',
      items,
      expanded: false
    };
    
    setProductInstances(prev => [...prev, newInstance]);
  };

  const removeProductInstance = (productId: string) => {
    setProductInstances(prev => {
      const instances = prev.filter(pi => pi.product.id === productId);
      if (instances.length === 0) return prev;
      
      const lastInstance = instances[instances.length - 1];
      return prev.filter(pi => pi.instanceId !== lastInstance.instanceId);
    });
  };

  const handleProductClick = (product: Product) => {
    addProductInstance(product);
  };

  const removeInstance = (instanceId: string) => {
    setProductInstances(prev => prev.filter(pi => pi.instanceId !== instanceId));
  };

  const toggleInstanceExpanded = (instanceId: string) => {
    setProductInstances(prev => prev.map(pi => 
      pi.instanceId === instanceId ? { ...pi, expanded: !pi.expanded } : pi
    ));
  };

  const updateInstanceDescription = (instanceId: string, description: string) => {
    setProductInstances(prev => prev.map(pi => 
      pi.instanceId === instanceId ? { ...pi, productDescription: description } : pi
    ));
  };

  const updateVariantQuantity = (instanceId: string, variantCombo: string, quantity: number) => {
    setProductInstances(prev => prev.map(pi => {
      if (pi.instanceId === instanceId) {
        return {
          ...pi,
          items: pi.items.map(item => 
            item.variantCombo === variantCombo 
              ? { ...item, quantity: Math.max(0, quantity) }
              : item
          )
        };
      }
      return pi;
    }));
  };

  const updateVariantNotes = (instanceId: string, variantCombo: string, notes: string) => {
    setProductInstances(prev => prev.map(pi => {
      if (pi.instanceId === instanceId) {
        return {
          ...pi,
          items: pi.items.map(item => 
            item.variantCombo === variantCombo 
              ? { ...item, notes }
              : item
          )
        };
      }
      return pi;
    }));
  };

  const getInstanceTotalQty = (instance: ProductInstance) => {
    return instance.items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getTotalItems = () => {
    return productInstances.reduce((sum, pi) => sum + getInstanceTotalQty(pi), 0);
  };

  const openImageModal = (imageUrl: string, title: string) => {
    setImageModal({ isOpen: true, imageUrl, title });
  };

  const handleSubmit = async () => {
    if (productInstances.length === 0) {
      showNotification('error', 'Please select at least one product');
      return;
    }

    console.log('=== STARTING ORDER SUBMISSION ===');
    console.log('userId:', userId);
    console.log('clientId:', clientId);
    console.log('clientName:', clientName);
    console.log('productInstances:', productInstances.length);

    setSaving(true);
    setShowLoadingOverlay(true);
    setLoadingStep(0);

    try {
      // Get last order number
      const { data: lastOrder, error: lastOrderError } = await supabase
        .from('orders')
        .select('order_number')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastOrderError && lastOrderError.code !== 'PGRST116') {
        console.error('Error getting last order:', lastOrderError);
      }

      let nextNumber = 1200;
      if (lastOrder?.order_number) {
        const match = lastOrder.order_number.match(/(\d{6})/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
      console.log('Next order number:', nextNumber);

      const clientPrefix = clientName?.substring(0, 3).toUpperCase() || 'REQ';
      const orderNumber = `${clientPrefix}-${nextNumber.toString().padStart(6, '0')}`;
      setCreatedOrderNumber(orderNumber);
      console.log('Order number:', orderNumber);

      // Step 1: Create order
      const orderPayload = {
        order_number: orderNumber,
        order_name: orderName || `Order Request - ${new Date().toLocaleDateString()}`,
        client_id: clientId,
        manufacturer_id: null,
        status: 'client_request',
        workflow_status: 'client_request',
        origin: 'client',
        created_by: userId,
        client_notes: orderNotes || null
      };
      console.log('Order payload:', orderPayload);

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert(orderPayload)
        .select()
        .single();

      if (orderError) {
        console.error('ORDER INSERT ERROR:', orderError);
        console.error('Error code:', orderError.code);
        console.error('Error message:', orderError.message);
        console.error('Error details:', orderError.details);
        console.error('Error hint:', orderError.hint);
        throw new Error(`Order insert failed: ${orderError.message}`);
      }

      console.log('Order created:', orderData);
      setLoadingStep(1);

      // Step 2: Add products
      const productsToInsert = productInstances.map((instance, index) => {
        const productCode = instance.product.title?.substring(0, 3).toUpperCase() || 'PRD';
        const productOrderNumber = `${nextNumber.toString().padStart(6, '0')}-${productCode}-${String(index + 1).padStart(2, '0')}`;
        
        return {
          order_id: orderData.id,
          product_id: instance.product.id,
          product_order_number: productOrderNumber,
          description: instance.productDescription || instance.product.title,
          product_status: 'pending',
          routed_to: 'admin'
        };
      });
      console.log('Products to insert:', productsToInsert);

      const { data: insertedProducts, error: productsError } = await supabase
        .from('order_products')
        .insert(productsToInsert)
        .select();

      if (productsError) {
        console.error('PRODUCTS INSERT ERROR:', productsError);
        console.error('Error code:', productsError.code);
        console.error('Error message:', productsError.message);
        throw new Error(`Products insert failed: ${productsError.message}`);
      }

      console.log('Products inserted:', insertedProducts);
      setLoadingStep(2);

      // Step 3: Add order items (ALL variants so admin can fill in quantities)
      // FIXED: Now inserts ALL variants, not just ones with qty > 0
      const itemsToInsert: any[] = [];
      
      productInstances.forEach((instance, instanceIndex) => {
        const productData = insertedProducts?.[instanceIndex];
        if (!productData) return;
        
        // Insert ALL variants, not just ones with qty > 0
        // This allows admin to see and fill in quantities later
        instance.items.forEach(item => {
          itemsToInsert.push({
            order_product_id: productData.id,
            variant_combo: item.variantCombo,
            quantity: item.quantity || 0,
            notes: item.notes || '',
            admin_status: 'pending',
            manufacturer_status: 'pending'
          });
        });
      });

      console.log('Items to insert:', itemsToInsert.length);

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
        if (itemsError) {
          console.error('ITEMS INSERT ERROR:', itemsError);
          // Don't throw - continue even if items fail
        } else {
          console.log('Items inserted successfully');
        }
      }

      setLoadingStep(3);

      // Create notification for admins
      try {
        await supabase.from('notifications').insert({
          user_id: null,
          order_id: orderData.id,
          type: 'client_request',
          message: `New order request from ${clientName}: ${orderNumber}`,
          is_read: false
        });
        console.log('Notification created');
      } catch (e) {
        console.warn('Could not create admin notification:', e);
      }

      setLoadingStep(4);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('=== ORDER SUBMISSION COMPLETE ===');
      showNotification('success', 'Order request submitted successfully!');
      
      setTimeout(() => {
        router.push('/dashboard/orders/client');
      }, 1500);

    } catch (error: any) {
      console.error('=== ORDER SUBMISSION FAILED ===');
      console.error('Error type:', typeof error);
      console.error('Error:', error);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      
      const errorMessage = error?.message || 'Unknown error occurred';
      showNotification('error', `Failed: ${errorMessage}`);
      setShowLoadingOverlay(false);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
          <p className="mt-3 text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!canCreateOrders) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <X className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900">Access Denied</h2>
          <p className="text-gray-500 mt-2">You don't have permission to create order requests.</p>
          <button
            onClick={() => router.push('/dashboard/orders/client')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  const uniqueProductsWithInstances = [...new Set(productInstances.map(pi => pi.product.id))];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Image Modal */}
      <ImageModal
        isOpen={imageModal.isOpen}
        imageUrl={imageModal.imageUrl}
        title={imageModal.title}
        onClose={() => setImageModal({ isOpen: false, imageUrl: '', title: '' })}
      />
      
      {/* Loading Overlay */}
      <LoadingOverlay
        isVisible={showLoadingOverlay}
        currentStep={loadingStep}
        steps={loadingSteps}
        orderNumber={createdOrderNumber}
      />

      {/* Notification Toast */}
      {notification.show && (
        <div className={`
          fixed top-4 right-4 z-50 min-w-[280px] max-w-[90vw] transform transition-all duration-500
          ${notification.show ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        `}>
          <div className={`
            p-4 rounded-xl shadow-2xl backdrop-blur-lg border
            ${notification.type === 'success'
              ? 'bg-gradient-to-r from-emerald-500/90 to-green-600/90 border-emerald-400/50 text-white'
              : notification.type === 'error'
              ? 'bg-gradient-to-r from-red-500/90 to-rose-600/90 border-red-400/50 text-white'
              : 'bg-gradient-to-r from-blue-500/90 to-indigo-600/90 border-blue-400/50 text-white'
            }
          `}>
            <div className="flex items-center gap-3">
              {notification.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
              {notification.type === 'error' && <X className="w-5 h-5" />}
              <p className="font-medium">{notification.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <button
            onClick={() => forClientId ? router.push('/dashboard/my-clients') : router.push('/dashboard/orders/client')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {forClientId ? 'Back to My Clients' : 'Back to Orders'}
          </button>
          <h1 className="text-xl font-bold text-gray-900">Create Order Request</h1>
          {forClientName && (
            <p className="text-sm text-blue-600 mt-1">
              Creating order for: <span className="font-semibold">{forClientName}</span>
            </p>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        {/* Step Indicators */}
        <div className="flex items-center justify-center mb-4">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${
              currentStep === 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
                currentStep === 1 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
              }`}>1</span>
              <span className="font-medium">Select</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${
              currentStep === 2 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
                currentStep === 2 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
              }`}>2</span>
              <span className="font-medium">Review</span>
            </div>
          </div>
        </div>

        {/* Step 1: Product Selection */}
        {currentStep === 1 && (
          <div>
            {/* Floating Selection Bar - TOP */}
            {productInstances.length > 0 && (
              <div className="sticky top-0 z-40 mb-4">
                <div className="bg-white border border-blue-200 rounded-xl shadow-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
                        <ShoppingCart className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">
                          {productInstances.length} product{productInstances.length !== 1 ? 's' : ''} selected
                        </p>
                        <p className="text-xs text-gray-500">
                          {uniqueProductsWithInstances.length} unique • Click to add more
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setCurrentStep(2)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 text-sm"
                    >
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Search */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
              {filteredProducts.map((product) => {
                const instanceCount = getProductInstanceCount(product.id);
                const variantCount = product.variants?.reduce((sum, v) => sum * v.options.length, 1) || 1;
                const hasImage = !!product.image_url;
                const isSelected = instanceCount > 0;
                
                return (
                  <div
                    key={product.id}
                    className={`relative bg-white rounded-lg border-2 transition-all overflow-hidden ${
                      isSelected 
                        ? 'border-blue-500 shadow-md ring-1 ring-blue-200' 
                        : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
                    }`}
                  >
                    <div 
                      onClick={() => handleProductClick(product)}
                      className="p-2 cursor-pointer"
                    >
                      <div 
                        className={`w-full aspect-square rounded-md mb-2 flex flex-col items-center justify-center overflow-hidden ${
                          isSelected ? 'bg-blue-50' : 'bg-gray-50'
                        } ${hasImage ? 'cursor-zoom-in' : ''}`}
                        onClick={(e) => {
                          if (hasImage) {
                            e.stopPropagation();
                            openImageModal(product.image_url!, product.title);
                          }
                        }}
                      >
                        {hasImage ? (
                          <img 
                            src={product.image_url} 
                            alt={product.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <>
                            <ImageIcon className={`w-6 h-6 ${isSelected ? 'text-blue-300' : 'text-gray-300'}`} />
                            <span className="text-[10px] text-gray-400 mt-1">No image</span>
                          </>
                        )}
                      </div>
                      
                      <h3 className="font-medium text-gray-900 text-xs leading-tight line-clamp-2">
                        {product.title}
                      </h3>
                      
                      {product.variants && product.variants.length > 0 && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {variantCount} variant{variantCount !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>

                    {isSelected && (
                      <div className="absolute top-1 right-1 flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeProductInstance(product.id);
                          }}
                          className="w-5 h-5 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-red-50 hover:border-red-300 transition-colors"
                        >
                          <Minus className="w-3 h-3 text-gray-600" />
                        </button>
                        
                        <div className="min-w-[20px] h-5 bg-blue-600 rounded-full flex items-center justify-center px-1">
                          <span className="text-white text-xs font-bold">{instanceCount}</span>
                        </div>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addProductInstance(product);
                          }}
                          className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors"
                        >
                          <Plus className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No products found</p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Review & Submit */}
        {currentStep === 2 && (
          <div className="space-y-4">
            {/* Order Details */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900 mb-3 text-sm">Order Details</h2>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Order Name (optional)
                  </label>
                  <input
                    type="text"
                    value={orderName}
                    onChange={(e) => setOrderName(e.target.value)}
                    placeholder="e.g., Spring 2025 Collection"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Special Instructions (optional)
                  </label>
                  <textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Any special requirements or notes..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Product Instances - DESCRIPTION ALWAYS VISIBLE */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900 text-sm">
                  Products ({productInstances.length})
                </h2>
                {getTotalItems() > 0 && (
                  <p className="text-xs text-gray-500">
                    Total: <span className="font-semibold text-gray-900">{getTotalItems()} items</span>
                  </p>
                )}
              </div>
              
              <div className="space-y-3">
                {productInstances.map((instance) => {
                  const totalQty = getInstanceTotalQty(instance);
                  const hasImage = !!instance.product.image_url;
                  
                  const sameProductInstances = productInstances.filter(pi => pi.product.id === instance.product.id);
                  const instanceNumber = sameProductInstances.findIndex(pi => pi.instanceId === instance.instanceId) + 1;
                  const showInstanceNumber = sameProductInstances.length > 1;
                  
                  return (
                    <div 
                      key={instance.instanceId}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      {/* Product Header with Description ALWAYS VISIBLE */}
                      <div className="p-3 bg-gray-50">
                        <div className="flex items-start gap-3">
                          {/* Product Image */}
                          <div 
                            className="w-12 h-12 bg-gray-200 rounded-md flex-shrink-0 flex items-center justify-center overflow-hidden"
                            onClick={() => {
                              if (hasImage) {
                                openImageModal(instance.product.image_url!, instance.product.title);
                              }
                            }}
                          >
                            {hasImage ? (
                              <img 
                                src={instance.product.image_url}
                                alt={instance.product.title}
                                className="w-full h-full object-cover cursor-zoom-in"
                              />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          
                          {/* Product Info + Description */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-medium text-gray-900 text-sm truncate">
                                {instance.product.title}
                              </h3>
                              {showInstanceNumber && (
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded flex-shrink-0">
                                  #{instanceNumber}
                                </span>
                              )}
                              {totalQty > 0 && (
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded flex-shrink-0">
                                  {totalQty} qty
                                </span>
                              )}
                            </div>
                            
                            {/* Description Input - ALWAYS VISIBLE */}
                            <input
                              type="text"
                              value={instance.productDescription}
                              onChange={(e) => updateInstanceDescription(instance.instanceId, e.target.value)}
                              placeholder={`Describe this product (e.g., "Black Hoodies", "Summer Edition")...`}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          
                          {/* Remove Button */}
                          <button
                            onClick={() => removeInstance(instance.instanceId)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {/* Expand for Variants - Optional */}
                        {instance.items.length > 0 && (
                          <button
                            onClick={() => toggleInstanceExpanded(instance.instanceId)}
                            className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            {instance.expanded ? (
                              <>
                                <ChevronDown className="w-3 h-3" />
                                Hide variant quantities
                              </>
                            ) : (
                              <>
                                <ChevronRight className="w-3 h-3" />
                                Add specific quantities ({instance.items.length} variants)
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      
                      {/* Expanded Variants - Only for specific quantities */}
                      {instance.expanded && (
                        <div className="border-t border-gray-200 p-3 space-y-2 bg-white">
                          <p className="text-xs text-gray-500 mb-2">
                            Optional: Specify quantities per variant, or leave at 0 if unsure
                          </p>
                          
                          {instance.items.map((item) => (
                            <div 
                              key={item.variantCombo}
                              className={`flex items-center gap-2 p-2 rounded-lg ${
                                item.quantity > 0 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`text-sm font-medium min-w-[80px] sm:min-w-[120px] ${item.quantity > 0 ? 'text-blue-900' : 'text-gray-700'}`}>
                                  {item.variantCombo}
                                </span>
                                
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => updateVariantQuantity(instance.instanceId, item.variantCombo, item.quantity - 1)}
                                    className="w-6 h-6 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                                  >
                                    <Minus className="w-3 h-3 text-gray-600" />
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    value={item.quantity}
                                    onChange={(e) => updateVariantQuantity(instance.instanceId, item.variantCombo, parseInt(e.target.value) || 0)}
                                    className="w-12 text-center py-1 border border-gray-300 rounded text-sm text-gray-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  />
                                  <button
                                    onClick={() => updateVariantQuantity(instance.instanceId, item.variantCombo, item.quantity + 1)}
                                    className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center hover:bg-blue-700"
                                  >
                                    <Plus className="w-3 h-3 text-white" />
                                  </button>
                                </div>
                              </div>
                              
                              <div className="flex-1">
                                <input
                                  type="text"
                                  value={item.notes}
                                  onChange={(e) => updateVariantNotes(instance.instanceId, item.variantCombo, e.target.value)}
                                  placeholder="Notes (optional)"
                                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {productInstances.length === 0 && (
                <div className="text-center py-8">
                  <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No products selected</p>
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="mt-2 text-blue-600 text-sm font-medium hover:text-blue-700"
                  >
                    Go back to select products
                  </button>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
              <div className="flex items-start gap-3">
                <FileText className="w-4 h-4 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 text-sm">What happens next?</h3>
                  <ul className="mt-1 text-xs text-blue-700 space-y-0.5">
                    <li>• Your request will be sent to our team for review</li>
                    <li>• We'll configure pricing and assign a manufacturer</li>
                    <li>• You'll be notified when ready for approval</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between gap-3 pt-2">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium flex items-center gap-2 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <button
                onClick={handleSubmit}
                disabled={saving || productInstances.length === 0}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Submit Request
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}