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
      _docker_migrations: {
        Row: {
          applied_at: string | null
          filename: string
        }
        Insert: {
          applied_at?: string | null
          filename: string
        }
        Update: {
          applied_at?: string | null
          filename?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          branch_id: string
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          customer_id: string | null
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
          customer_id?: string | null
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
          customer_id?: string | null
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
      branches: {
        Row: {
          address: string | null
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
      customers: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
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
          is_featured: boolean
          is_trending: boolean
          name: string
          price_kes: number
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
          is_featured?: boolean
          is_trending?: boolean
          name: string
          price_kes: number
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
          is_featured?: boolean
          is_trending?: boolean
          name?: string
          price_kes?: number
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
          type: string
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
          type?: string
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
          type?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_customer_id: { Args: never; Returns: string }
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
    }
    Enums: {
      appt_status:
        | "pending"
        | "confirmed"
        | "rescheduled"
        | "cancelled"
        | "completed"
      discount_kind: "percent" | "fixed"
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
      discount_kind: ["percent", "fixed"],
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

