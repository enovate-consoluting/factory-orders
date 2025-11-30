/**
 * useBulkRouting Hook - /dashboard/orders/[id]/hooks/useBulkRouting.ts
 * Handles bulk save and route operations for all user roles
 * FIXED: Now properly saves sample notes with audit log
 * FIXED: Uploads pending sample files
 * FIXED: Routes sample section when routing products
 * Last Modified: November 29, 2025
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

// Types for routing options per role
export type AdminRouteOption = 'approve_for_production' | 'request_sample' | 'send_for_approval' | 'send_to_manufacturer';
export type ManufacturerRouteOption = 'send_to_admin' | 'in_production' | 'shipped';
export type ClientRouteOption = 'approve' | 'request_changes';

export interface BulkRoutingState {
  isSaving: boolean;
  currentStep: number;
  steps: string[];
  error: string | null;
}

export interface UseBulkRoutingOptions {
  orderId: string;
  order: any;
  products: any[];
  userRole: string;
  manufacturerCardRefs?: React.MutableRefObject<Map<string, any>>;
  adminCardRefs?: React.MutableRefObject<Map<string, any>>;
  sampleRouting?: {
    routeToAdmin: (notes?: string) => Promise<boolean>;
    routeToManufacturer: (notes?: string) => Promise<boolean>;
    routeToClient: (notes?: string) => Promise<boolean>;
  };
  orderSampleData?: {
    fee: string;
    eta: string;
    status: string;
  };
  // Pending sample files to upload
  pendingSampleFiles?: File[];
  // Sample notes to save
  sampleNotes?: string;
  onSuccess: () => void;
  onRedirect?: () => void;
}

export interface UseBulkRoutingReturn {
  state: BulkRoutingState;
  saveAllAndRoute: (routeOption: string, notes?: string) => Promise<boolean>;
  getRouteOptions: () => { value: string; label: string; description: string }[];
  resetState: () => void;
}

export function useBulkRouting({
  orderId,
  order,
  products,
  userRole,
  manufacturerCardRefs,
  adminCardRefs,
  sampleRouting,
  orderSampleData,
  pendingSampleFiles = [],
  sampleNotes = '',
  onSuccess,
  onRedirect
}: UseBulkRoutingOptions): UseBulkRoutingReturn {
  
  const [state, setState] = useState<BulkRoutingState>({
    isSaving: false,
    currentStep: 0,
    steps: [],
    error: null
  });

  const getCurrentUser = () => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      return {
        id: user.id || crypto.randomUUID(),
        name: user.name || user.email || 'Unknown User'
      };
    }
    return { id: crypto.randomUUID(), name: 'Unknown User' };
  };

  const isManufacturer = userRole === 'manufacturer';
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';
  const isClient = userRole === 'client';

  // Get route options based on user role
  const getRouteOptions = () => {
    if (isManufacturer) {
      return [
        { 
          value: 'send_to_admin', 
          label: 'Send to Admin', 
          description: 'Send all products back to admin for review' 
        },
        { 
          value: 'in_production', 
          label: 'Start Production', 
          description: 'Mark all products as in production' 
        },
        { 
          value: 'shipped', 
          label: 'Mark as Shipped', 
          description: 'Mark all products as shipped' 
        }
      ];
    }
    
    if (isAdmin) {
      return [
        { 
          value: 'send_to_manufacturer', 
          label: 'Send to Manufacturer', 
          description: 'Send all products to manufacturer for pricing/production' 
        },
        { 
          value: 'approve_for_production', 
          label: 'Approve for Production', 
          description: 'Approve all products and send to manufacturer for production' 
        },
        { 
          value: 'request_sample', 
          label: 'Request Samples', 
          description: 'Request samples for all products' 
        },
        { 
          value: 'send_for_approval', 
          label: 'Send to Client', 
          description: 'Send all products to client for approval' 
        }
      ];
    }
    
    if (isClient) {
      return [
        { 
          value: 'approve', 
          label: 'Approve All', 
          description: 'Approve all products in this order' 
        },
        { 
          value: 'request_changes', 
          label: 'Request Changes', 
          description: 'Send back to admin with change requests' 
        }
      ];
    }
    
    return [];
  };

  const resetState = () => {
    setState({
      isSaving: false,
      currentStep: 0,
      steps: [],
      error: null
    });
  };

  // COMPLETE sample data save function
  const saveSampleData = async (user: any, routeNotes?: string) => {
    console.log('=== SAVING SAMPLE DATA ===');
    console.log('orderSampleData:', orderSampleData);
    console.log('sampleNotes:', sampleNotes);
    console.log('pendingSampleFiles:', pendingSampleFiles?.length);
    
    // Check if there's anything to save
    const hasFee = orderSampleData?.fee && parseFloat(orderSampleData.fee) > 0;
    const hasETA = orderSampleData?.eta && orderSampleData.eta.trim() !== '';
    const hasNotes = sampleNotes && sampleNotes.trim() !== '';
    const hasFiles = pendingSampleFiles && pendingSampleFiles.length > 0;
    
    if (!hasFee && !hasETA && !hasNotes && !hasFiles) {
      console.log('No sample data to save, skipping...');
      return;
    }
    
    const roleName = isManufacturer ? 'Manufacturer' : 'Admin';
    const changes: string[] = [];
    
    // Track changes for audit log
    const oldFee = order?.sample_fee;
    const newFee = orderSampleData?.fee ? parseFloat(orderSampleData.fee) : null;
    if (newFee !== oldFee && newFee) {
      if (oldFee) {
        changes.push(`Fee: $${oldFee} → $${newFee}`);
      } else {
        changes.push(`Fee set to $${newFee}`);
      }
    }
    
    const oldEta = order?.sample_eta || '';
    const newEta = orderSampleData?.eta || '';
    if (newEta !== oldEta && newEta) {
      if (oldEta) {
        changes.push(`ETA: ${oldEta} → ${newEta}`);
      } else {
        changes.push(`ETA set to ${newEta}`);
      }
    }
    
    // Add notes to audit
    if (hasNotes) {
      changes.push(`Note from ${roleName}: "${sampleNotes.trim()}"`);
    }
    
    // Add route notes if provided
    if (routeNotes && routeNotes.trim()) {
      changes.push(`Route note: "${routeNotes.trim()}"`);
    }
    
    // Build update data - NOW INCLUDES sample_notes
    const updateData: any = {
      sample_required: true,
      sample_fee: newFee,
      sample_eta: newEta || null,
      sample_status: orderSampleData?.status || 'pending',
      sample_workflow_status: orderSampleData?.status || 'pending'
    };
    
    // APPEND notes to sample_notes column (don't overwrite existing)
    if (hasNotes) {
      const timestamp = new Date().toLocaleDateString();
      const roleName = isManufacturer ? 'Manufacturer' : 'Admin';
      const newNote = `[${timestamp} - ${roleName}] ${sampleNotes.trim()}`;
      
      // Get existing notes and append
      const existingNotes = order?.sample_notes || '';
      updateData.sample_notes = existingNotes 
        ? `${existingNotes}\n\n${newNote}`
        : newNote;
      
      console.log('Saving sample_notes:', updateData.sample_notes);
    }
    
    console.log('Updating order with sample data:', updateData);
    
    // Update order
    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);
    
    if (updateError) {
      console.error('Error saving sample data:', updateError);
      throw updateError;
    }
    
    console.log('Order sample data updated successfully');
    
    // Upload pending files
    if (hasFiles) {
      console.log(`Uploading ${pendingSampleFiles.length} sample file(s)...`);
      changes.push(`${pendingSampleFiles.length} file(s) uploaded`);
      
      for (const file of pendingSampleFiles) {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'file';
        const uniqueFileName = `${fileNameWithoutExt}_sample_${timestamp}_${randomStr}.${fileExt}`;
        const filePath = `${orderId}/${uniqueFileName}`;
        
        console.log(`Uploading file: ${file.name} to ${filePath}`);
        
        const { error: uploadError } = await supabase.storage
          .from('order-media')
          .upload(filePath, file);
        
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('order-media')
            .getPublicUrl(filePath);
          
          await supabase
            .from('order_media')
            .insert({
              order_id: orderId,
              order_product_id: null,
              file_url: publicUrl,
              file_type: 'order_sample',
              uploaded_by: user.id,
              original_filename: file.name,
              display_name: file.name,
              is_sample: true,
              created_at: new Date().toISOString()
            });
          
          console.log(`File uploaded successfully: ${file.name}`);
        } else {
          console.error(`Error uploading file ${file.name}:`, uploadError);
        }
      }
    }
    
    // Log to audit if there were any changes
    if (changes.length > 0) {
      console.log('Creating audit log entry:', changes.join(' | '));
      
      await supabase.from('audit_log').insert({
        user_id: user.id,
        user_name: user.name,
        action_type: 'order_sample_updated',
        target_type: 'order',
        target_id: orderId,
        new_value: changes.join(' | '),
        timestamp: new Date().toISOString()
      });
      
      console.log('Audit log entry created');
    }
    
    console.log('=== SAMPLE DATA SAVE COMPLETE ===');
  };

  const saveAllAndRoute = async (routeOption: string, notes?: string): Promise<boolean> => {
    const user = getCurrentUser();
    
    console.log('=== STARTING SAVE ALL & ROUTE ===');
    console.log('Route option:', routeOption);
    console.log('Products to process:', products.length);
    console.log('User role:', userRole);
    console.log('Sample data:', orderSampleData);
    console.log('Sample notes:', sampleNotes);
    console.log('Pending sample files:', pendingSampleFiles?.length);
    
    // Build steps for progress display
    const steps: string[] = [];
    
    // Check if sample has data to save
    const hasSampleData = 
      (orderSampleData?.fee && parseFloat(orderSampleData.fee) > 0) ||
      (orderSampleData?.eta && orderSampleData.eta.trim() !== '') ||
      (sampleNotes && sampleNotes.trim() !== '') ||
      (pendingSampleFiles && pendingSampleFiles.length > 0);
    
    if (hasSampleData) {
      steps.push('Saving sample data...');
    }
    
    if (isManufacturer && products.length > 0) {
      steps.push(`Saving ${products.length} product${products.length > 1 ? 's' : ''}...`);
    }
    
    // Admin also needs to save product data
    if (isAdmin && products.length > 0) {
      steps.push(`Saving ${products.length} product${products.length > 1 ? 's' : ''}...`);
    }
    
    steps.push('Applying routing...');
    
    // Check if sample should be routed
    const shouldRouteSample = sampleRouting && (
      // Manufacturer sending to admin - route sample if it's with manufacturer
      (isManufacturer && routeOption === 'send_to_admin' && order?.sample_routed_to === 'manufacturer') ||
      // Admin sending to manufacturer - route sample if it's with admin
      (isAdmin && routeOption === 'send_to_manufacturer' && order?.sample_routed_to === 'admin') ||
      // Admin sending to client - route sample if it's with admin
      (isAdmin && routeOption === 'send_for_approval' && order?.sample_routed_to === 'admin')
    );
    
    if (shouldRouteSample) {
      steps.push('Routing sample request...');
    }
    
    steps.push('Finalizing...');
    
    setState({
      isSaving: true,
      currentStep: 0,
      steps,
      error: null
    });

    try {
      let stepIndex = 0;

      // STEP 1: Save sample data if present
      if (hasSampleData) {
        console.log('Step 1: Saving sample data...');
        await saveSampleData(user, notes);
        stepIndex++;
        setState(prev => ({ ...prev, currentStep: stepIndex }));
      }

      // STEP 2: Save all product data (manufacturer cards have saveAll method)
      if (isManufacturer && manufacturerCardRefs && products.length > 0) {
        console.log(`Step 2: Processing ${products.length} products via manufacturer card refs...`);
        
        for (const product of products) {
          const cardRef = manufacturerCardRefs.current.get(product.id);
          
          if (cardRef && typeof cardRef.saveAll === 'function') {
            console.log(`Calling saveAll for product ${product.product_order_number}`);
            await cardRef.saveAll();
          } else {
            console.log(`No saveAll method found for product ${product.id}`);
          }
        }
        
        stepIndex++;
        setState(prev => ({ ...prev, currentStep: stepIndex }));
      }
      
      // STEP 2 (Admin): Save all product data via admin card refs
      if (isAdmin && adminCardRefs && products.length > 0) {
        console.log(`Step 2: Processing ${products.length} products via admin card refs...`);
        
        for (const product of products) {
          const cardRef = adminCardRefs.current.get(product.id);
          
          if (cardRef && typeof cardRef.saveAll === 'function') {
            console.log(`Calling saveAll for admin product ${product.product_order_number}`);
            await cardRef.saveAll();
          } else {
            console.log(`No saveAll method found for admin product ${product.id} - AdminProductCard may need saveAll function`);
          }
        }
        
        stepIndex++;
        setState(prev => ({ ...prev, currentStep: stepIndex }));
      }

      // STEP 3: Apply routing to all products
      console.log('Step 3: Applying routing to products...');
      
      for (const product of products) {
        let productUpdate: any = {};
        
        if (isManufacturer) {
          switch (routeOption) {
            case 'send_to_admin':
              productUpdate.product_status = 'pending_admin';
              productUpdate.routed_to = 'admin';
              productUpdate.routed_at = new Date().toISOString();
              productUpdate.routed_by = user.id;
              break;
            case 'in_production':
              productUpdate.product_status = 'in_production';
              productUpdate.routed_to = 'manufacturer';
              productUpdate.routed_at = new Date().toISOString();
              productUpdate.routed_by = user.id;
              productUpdate.is_locked = true;
              break;
            case 'shipped':
              productUpdate.product_status = 'shipped';
              productUpdate.routed_to = 'admin';
              productUpdate.routed_at = new Date().toISOString();
              productUpdate.routed_by = user.id;
              productUpdate.shipped_date = new Date().toISOString();
              break;
          }
        } else if (isAdmin) {
          switch (routeOption) {
            case 'send_to_manufacturer':
              productUpdate.product_status = 'sent_to_manufacturer';
              productUpdate.routed_to = 'manufacturer';
              productUpdate.routed_at = new Date().toISOString();
              productUpdate.routed_by = user.id;
              break;
            case 'approve_for_production':
              productUpdate.product_status = 'approved_for_production';
              productUpdate.routed_to = 'manufacturer';
              productUpdate.routed_at = new Date().toISOString();
              productUpdate.routed_by = user.id;
              productUpdate.is_locked = false;
              break;
            case 'request_sample':
              productUpdate.sample_required = true;
              productUpdate.product_status = 'sample_requested';
              productUpdate.routed_to = 'manufacturer';
              productUpdate.routed_at = new Date().toISOString();
              productUpdate.routed_by = user.id;
              break;
            case 'send_for_approval':
              productUpdate.requires_client_approval = true;
              productUpdate.product_status = 'pending_client_approval';
              productUpdate.routed_to = 'client';
              productUpdate.routed_at = new Date().toISOString();
              productUpdate.routed_by = user.id;
              break;
          }
        } else if (isClient) {
          switch (routeOption) {
            case 'approve':
              productUpdate.product_status = 'client_approved';
              productUpdate.client_approved = true;
              productUpdate.client_approved_at = new Date().toISOString();
              productUpdate.routed_to = 'admin';
              productUpdate.routed_at = new Date().toISOString();
              productUpdate.routed_by = user.id;
              break;
            case 'request_changes':
              productUpdate.product_status = 'revision_requested';
              productUpdate.routed_to = 'admin';
              productUpdate.routed_at = new Date().toISOString();
              productUpdate.routed_by = user.id;
              break;
          }
        }

        // Log routing action with notes
        if (notes && notes.trim()) {
          await supabase.from('audit_log').insert({
            user_id: user.id,
            user_name: user.name,
            action_type: 'product_routed_' + routeOption,
            target_type: 'order_product',
            target_id: product.id,
            new_value: `Route note: ${notes.trim()}`,
            timestamp: new Date().toISOString()
          });
        }

        if (Object.keys(productUpdate).length > 0) {
          console.log(`Updating product ${product.product_order_number}:`, productUpdate);
          
          await supabase
            .from('order_products')
            .update(productUpdate)
            .eq('id', product.id);
        }
      }
      
      stepIndex++;
      setState(prev => ({ ...prev, currentStep: stepIndex }));

      // STEP 4: Route sample section if applicable
      if (shouldRouteSample && sampleRouting) {
        console.log('Step 4: Routing sample request...');
        
        if (isManufacturer && routeOption === 'send_to_admin') {
          console.log('Manufacturer routing sample to admin');
          await sampleRouting.routeToAdmin(notes);
        } else if (isAdmin && routeOption === 'send_to_manufacturer') {
          console.log('Admin routing sample to manufacturer');
          await sampleRouting.routeToManufacturer(notes);
        } else if (isAdmin && routeOption === 'send_for_approval') {
          console.log('Admin routing sample to client');
          await sampleRouting.routeToClient(notes);
        }
        
        stepIndex++;
        setState(prev => ({ ...prev, currentStep: stepIndex }));
      }

      // STEP 5: Finalize
      console.log('Finalizing...');
      setState(prev => ({ ...prev, currentStep: prev.steps.length - 1 }));
      
      // Brief pause to show completion
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('=== SAVE ALL & ROUTE COMPLETED ===');

      // Determine if we should redirect or just refresh
      const shouldRedirect = 
        (isManufacturer && (routeOption === 'send_to_admin' || routeOption === 'shipped')) ||
        (isAdmin && (routeOption === 'send_to_manufacturer' || routeOption === 'approve_for_production' || routeOption === 'send_for_approval'));

      if (shouldRedirect && onRedirect) {
        console.log('Redirecting to orders list...');
        setTimeout(() => {
          onRedirect();
        }, 300);
      } else {
        console.log('Refreshing current page...');
        onSuccess();
      }

      resetState();
      return true;

    } catch (error: any) {
      console.error('ERROR IN SAVE ALL & ROUTE:', error);
      setState(prev => ({ 
        ...prev, 
        isSaving: false, 
        error: error.message || 'An error occurred while saving' 
      }));
      return false;
    }
  };

  return {
    state,
    saveAllAndRoute,
    getRouteOptions,
    resetState
  };
}