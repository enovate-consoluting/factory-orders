import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          role: 'super_admin' | 'order_creator' | 'order_approver' | 'manufacturer'
          created_at: string
        }
      }
      clients: {
        Row: {
          id: string
          name: string
          email: string
          created_at: string
        }
      }
      manufacturers: {
        Row: {
          id: string
          name: string
          email: string
          created_at: string
        }
      }
      variant_types: {
        Row: {
          id: string
          name: string
          created_at: string
        }
      }
      variant_options: {
        Row: {
          id: string
          type_id: string
          value: string
          created_at: string
        }
      }
      products: {
        Row: {
          id: string
          title: string
          description: string
          created_at: string
        }
      }
      product_variants: {
        Row: {
          id: string
          product_id: string
          variant_option_id: string
          created_at: string
        }
      }
      orders: {
        Row: {
          id: string
          order_number: string
          client_id: string
          manufacturer_id: string
          status: 'draft' | 'submitted' | 'in_progress' | 'completed' | 'rejected'
          created_by: string
          created_at: string
          updated_at: string
        }
      }
      order_products: {
        Row: {
          id: string
          order_id: string
          product_id: string
          product_order_number: string
          created_at: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_product_id: string
          variant_combo: string
          quantity: number
          notes: string | null
          admin_status: 'pending' | 'approved' | 'rejected'
          manufacturer_status: 'pending' | 'approved' | 'rejected'
          standard_price: number | null
          bulk_price: number | null
          created_at: string
        }
      }
      order_media: {
        Row: {
          id: string
          order_product_id: string
          file_url: string
          file_type: string
          uploaded_by: string
          created_at: string
        }
      }
      audit_log: {
        Row: {
          id: string
          user_id: string
          user_name: string
          action_type: string
          target_type: string
          target_id: string
          old_value: string | null
          new_value: string | null
          timestamp: string
        }
      }
    }
  }
}