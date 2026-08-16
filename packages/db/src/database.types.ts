export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: {
          description: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      appointments: {
        Row: {
          branch_id: string
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          reminder_1h_sent: boolean
          reminder_24h_sent: boolean
          scheduled_at: string
          status: Database["public"]["Enums"]["appt_status"]
          type: string
        }
        Insert: {
          branch_id: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          reminder_1h_sent?: boolean
          reminder_24h_sent?: boolean
          scheduled_at: string
          status?: Database["public"]["Enums"]["appt_status"]
          type: string
        }
        Update: {
          branch_id?: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          reminder_1h_sent?: boolean
          reminder_24h_sent?: boolean
          scheduled_at?: string
          status?: Database["public"]["Enums"]["appt_status"]
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_role: string
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          branch_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action: string
          actor_role: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          branch_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action?: string
          actor_role?: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          branch_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          breaks: Json | null
          capacity: number
          created_at: string
          hours: Json | null
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          name: string
          phone: string | null
          slug: string
        }
        Insert: {
          address?: string | null
          breaks?: Json | null
          capacity?: number
          created_at?: string
          hours?: Json | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          phone?: string | null
          slug: string
        }
        Update: {
          address?: string | null
          breaks?: Json | null
          capacity?: number
          created_at?: string
          hours?: Json | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          phone?: string | null
          slug?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          cart_id: string
          id: string
          lens_option: Json | null
          product_id: string
          quantity: number
        }
        Insert: {
          cart_id: string
          id?: string
          lens_option?: Json | null
          product_id: string
          quantity: number
        }
        Update: {
          cart_id?: string
          id?: string
          lens_option?: Json | null
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          customer_id: string | null
          id: string
          promo_code: string | null
          updated_at: string
        }
        Insert: {
          customer_id?: string | null
          id?: string
          promo_code?: string | null
          updated_at?: string
        }
        Update: {
          customer_id?: string | null
          id?: string
          promo_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          display_image: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          display_image?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          display_image?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      cron_runs: {
        Row: {
          claimed_at: string
          claimed_by: string | null
          job: string
        }
        Insert: {
          claimed_at?: string
          claimed_by?: string | null
          job: string
        }
        Update: {
          claimed_at?: string
          claimed_by?: string | null
          job?: string
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          address: string
          city: string
          county: string
          created_at: string
          customer_id: string
          id: string
          is_default: boolean
          label: string | null
          name: string
          phone: string
          postal: string | null
          updated_at: string
        }
        Insert: {
          address: string
          city: string
          county: string
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean
          label?: string | null
          name: string
          phone: string
          postal?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          county?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean
          label?: string | null
          name?: string
          phone?: string
          postal?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          auth_user_id: string | null
          created_at: string
          deactivated_at: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          deactivated_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          deactivated_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          branch_id: string
          product_id: string
          stock: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          product_id: string
          stock?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          product_id?: string
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      mpesa_transactions: {
        Row: {
          amount_kes: number
          customer_phone: string | null
          id: string
          mpesa_ref: string
          order_id: string | null
          raw: Json | null
          received_at: string
          status: string
        }
        Insert: {
          amount_kes: number
          customer_phone?: string | null
          id?: string
          mpesa_ref: string
          order_id?: string | null
          raw?: Json | null
          received_at?: string
          status?: string
        }
        Update: {
          amount_kes?: number
          customer_phone?: string | null
          id?: string
          mpesa_ref?: string
          order_id?: string | null
          raw?: Json | null
          received_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mpesa_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          attempts: number
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          dedupe_key: string | null
          id: string
          last_error: string | null
          next_retry_at: string | null
          recipient: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          subject: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          dedupe_key?: string | null
          id?: string
          last_error?: string | null
          next_retry_at?: string | null
          recipient: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          subject?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          body?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          dedupe_key?: string | null
          id?: string
          last_error?: string | null
          next_retry_at?: string | null
          recipient?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      order_cancellation_requests: {
        Row: {
          created_at: string
          customer_id: string
          decided_at: string | null
          decided_by: string | null
          decline_reason: string | null
          id: string
          order_id: string
          reason: string | null
          status: Database["public"]["Enums"]["cancellation_status"]
          status_at_request: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          decided_at?: string | null
          decided_by?: string | null
          decline_reason?: string | null
          id?: string
          order_id: string
          reason?: string | null
          status?: Database["public"]["Enums"]["cancellation_status"]
          status_at_request: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          decided_at?: string | null
          decided_by?: string | null
          decline_reason?: string | null
          id?: string
          order_id?: string
          reason?: string | null
          status?: Database["public"]["Enums"]["cancellation_status"]
          status_at_request?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_cancellation_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_cancellation_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          lens_option: Json | null
          order_id: string
          product_id: string
          quantity: number
          unit_price_kes: number
        }
        Insert: {
          id?: string
          lens_option?: Json | null
          order_id: string
          product_id: string
          quantity: number
          unit_price_kes: number
        }
        Update: {
          id?: string
          lens_option?: Json | null
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price_kes?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          branch_id: string | null
          created_at: string
          customer_id: string
          discount_kes: number
          id: string
          mpesa_ref: string | null
          notes: string | null
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pesapal_id: string | null
          promo_code: string | null
          shipping: Json | null
          shipping_kes: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal_kes: number
          total_kes: number
          updated_at: string
          vat_kes: number
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          customer_id: string
          discount_kes?: number
          id?: string
          mpesa_ref?: string | null
          notes?: string | null
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pesapal_id?: string | null
          promo_code?: string | null
          shipping?: Json | null
          shipping_kes?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_kes: number
          total_kes: number
          updated_at?: string
          vat_kes?: number
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          customer_id?: string
          discount_kes?: number
          id?: string
          mpesa_ref?: string | null
          notes?: string | null
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pesapal_id?: string | null
          promo_code?: string | null
          shipping?: Json | null
          shipping_kes?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_kes?: number
          total_kes?: number
          updated_at?: string
          vat_kes?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string
          description: string
          id: string
        }
        Insert: {
          created_at?: string
          description: string
          id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
        }
        Relationships: []
      }
      pesapal_transactions: {
        Row: {
          amount_kes: number | null
          id: string
          method: string | null
          order_id: string | null
          pesapal_order_id: string
          raw: Json | null
          received_at: string
          status: string
        }
        Insert: {
          amount_kes?: number | null
          id?: string
          method?: string | null
          order_id?: string | null
          pesapal_order_id: string
          raw?: Json | null
          received_at?: string
          status?: string
        }
        Update: {
          amount_kes?: number | null
          id?: string
          method?: string | null
          order_id?: string | null
          pesapal_order_id?: string
          raw?: Json | null
          received_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pesapal_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          axis_od: number | null
          axis_os: number | null
          created_at: string
          customer_id: string
          cyl_od: number | null
          cyl_os: number | null
          file_url: string | null
          id: string
          order_id: string | null
          pd: number | null
          processed_at: string | null
          sphere_od: number | null
          sphere_os: number | null
          status: Database["public"]["Enums"]["pres_status"]
        }
        Insert: {
          axis_od?: number | null
          axis_os?: number | null
          created_at?: string
          customer_id: string
          cyl_od?: number | null
          cyl_os?: number | null
          file_url?: string | null
          id?: string
          order_id?: string | null
          pd?: number | null
          processed_at?: string | null
          sphere_od?: number | null
          sphere_os?: number | null
          status?: Database["public"]["Enums"]["pres_status"]
        }
        Update: {
          axis_od?: number | null
          axis_os?: number | null
          created_at?: string
          customer_id?: string
          cyl_od?: number | null
          cyl_os?: number | null
          file_url?: string | null
          id?: string
          order_id?: string | null
          pd?: number | null
          processed_at?: string | null
          sphere_od?: number | null
          sphere_os?: number | null
          status?: Database["public"]["Enums"]["pres_status"]
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          admin_reply: string | null
          body: string | null
          created_at: string
          customer_id: string
          id: string
          product_id: string
          rating: number
          status: Database["public"]["Enums"]["review_status"]
          verified_purchase: boolean
        }
        Insert: {
          admin_reply?: string | null
          body?: string | null
          created_at?: string
          customer_id: string
          id?: string
          product_id: string
          rating: number
          status?: Database["public"]["Enums"]["review_status"]
          verified_purchase?: boolean
        }
        Update: {
          admin_reply?: string | null
          body?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          product_id?: string
          rating?: number
          status?: Database["public"]["Enums"]["review_status"]
          verified_purchase?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category_id: string
          created_at: string
          description: string | null
          frame_material: string | null
          frame_shape: string | null
          gender: string | null
          id: string
          images: string[]
          is_active: boolean
          name: string
          price_kes: number
          rating_avg: number | null
          rating_count: number
          search_tsv: unknown
          sku: string
          slug: string
          try_on_image_url: string | null
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category_id: string
          created_at?: string
          description?: string | null
          frame_material?: string | null
          frame_shape?: string | null
          gender?: string | null
          id?: string
          images?: string[]
          is_active?: boolean
          name: string
          price_kes: number
          rating_avg?: number | null
          rating_count?: number
          search_tsv?: unknown
          sku: string
          slug: string
          try_on_image_url?: string | null
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category_id?: string
          created_at?: string
          description?: string | null
          frame_material?: string | null
          frame_shape?: string | null
          gender?: string | null
          id?: string
          images?: string[]
          is_active?: boolean
          name?: string
          price_kes?: number
          rating_avg?: number | null
          rating_count?: number
          search_tsv?: unknown
          sku?: string
          slug?: string
          try_on_image_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_banners: {
        Row: {
          ends_at: string | null
          headline: string | null
          id: string
          image_url: string
          is_active: boolean
          sort_order: number
          starts_at: string | null
          target_url: string | null
        }
        Insert: {
          ends_at?: string | null
          headline?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          sort_order?: number
          starts_at?: string | null
          target_url?: string | null
        }
        Update: {
          ends_at?: string | null
          headline?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          sort_order?: number
          starts_at?: string | null
          target_url?: string | null
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          category_id: string | null
          code: string
          created_at: string
          discount_type: Database["public"]["Enums"]["discount_kind"]
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          starts_at: string | null
          uses: number
          value: number
        }
        Insert: {
          category_id?: string | null
          code: string
          created_at?: string
          discount_type: Database["public"]["Enums"]["discount_kind"]
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          starts_at?: string | null
          uses?: number
          value: number
        }
        Update: {
          category_id?: string | null
          code?: string
          created_at?: string
          discount_type?: Database["public"]["Enums"]["discount_kind"]
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          starts_at?: string | null
          uses?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string
          id: string
          is_branch_scoped: boolean
          name: string
          requires_mfa: boolean
        }
        Insert: {
          created_at?: string
          description: string
          id: string
          is_branch_scoped?: boolean
          name: string
          requires_mfa?: boolean
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_branch_scoped?: boolean
          name?: string
          requires_mfa?: boolean
        }
        Relationships: []
      }
      staff_users: {
        Row: {
          auth_user_id: string
          branch_id: string | null
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          email: string
          full_name: string
          id: string
          role_id: string
        }
        Insert: {
          auth_user_id: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          email: string
          full_name: string
          id?: string
          role_id: string
        }
        Update: {
          auth_user_id?: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          email?: string
          full_name?: string
          id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_users_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_items: {
        Row: {
          created_at: string
          customer_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_due_reminders: {
        Args: { p_bucket: string; p_horizon: string; p_max?: number }
        Returns: {
          contact_name: string
          contact_phone: string
          customer_phone: string
          id: string
          scheduled_at: string
          status: Database["public"]["Enums"]["appt_status"]
        }[]
      }
      current_customer_id: { Args: never; Returns: string }
      deduct_stock_fifo: {
        Args: { p_product_id: string; p_qty: number }
        Returns: undefined
      }
      generate_order_number: { Args: never; Returns: string }
      increment_cart_item_qty: {
        Args: { delta: number; item_id: string }
        Returns: {
          cart_id: string
          id: string
          lens_option: Json | null
          product_id: string
          quantity: number
        }[]
        SetofOptions: {
          from: "*"
          to: "cart_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      increment_promo_uses: { Args: { p_code: string }; Returns: number }
      is_super_admin: { Args: never; Returns: boolean }
      place_order: {
        Args: {
          p_customer_id: string
          p_delivery_option: string
          p_payment_method: string
          p_promo_code: string
          p_shipping: Json
        }
        Returns: {
          branch_id: string | null
          created_at: string
          customer_id: string
          discount_kes: number
          id: string
          mpesa_ref: string | null
          notes: string | null
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pesapal_id: string | null
          promo_code: string | null
          shipping: Json | null
          shipping_kes: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal_kes: number
          total_kes: number
          updated_at: string
          vat_kes: number
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refresh_product_rating: {
        Args: { p_product_id: string }
        Returns: undefined
      }
      try_claim_cron_run: {
        Args: { p_job: string; p_lease: string; p_runner?: string }
        Returns: boolean
      }
    }
    Enums: {
      appt_status:
        | "pending"
        | "confirmed"
        | "rescheduled"
        | "cancelled"
        | "completed"
      cancellation_status: "pending" | "approved" | "declined"
      discount_kind: "percent" | "fixed"
      notification_channel: "sms" | "email"
      notification_status: "pending" | "sent" | "failed" | "abandoned"
      order_status:
        | "pending_payment"
        | "received"
        | "processing"
        | "dispatched"
        | "delivered"
        | "cancelled"
      payment_method: "mpesa" | "pesapal" | "cod"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      pres_status: "pending" | "processed"
      review_status: "pending" | "approved" | "flagged"
      user_role: "super_admin" | "customer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appt_status: [
        "pending",
        "confirmed",
        "rescheduled",
        "cancelled",
        "completed",
      ],
      cancellation_status: ["pending", "approved", "declined"],
      discount_kind: ["percent", "fixed"],
      notification_channel: ["sms", "email"],
      notification_status: ["pending", "sent", "failed", "abandoned"],
      order_status: [
        "pending_payment",
        "received",
        "processing",
        "dispatched",
        "delivered",
        "cancelled",
      ],
      payment_method: ["mpesa", "pesapal", "cod"],
      payment_status: ["pending", "paid", "failed", "refunded"],
      pres_status: ["pending", "processed"],
      review_status: ["pending", "approved", "flagged"],
      user_role: ["super_admin", "customer"],
    },
  },
} as const

