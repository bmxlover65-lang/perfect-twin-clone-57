export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at: string | null
          operator_id: string
          products: string[]
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          label?: string
          last_used_at?: string | null
          operator_id: string
          products?: string[]
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string
          last_used_at?: string | null
          operator_id?: string
          products?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      balloon_rounds: {
        Row: {
          crash: number | null
          crashed_at: string | null
          created_at: string
          event_id: string
          round_id: string
        }
        Insert: {
          crash?: number | null
          crashed_at?: string | null
          created_at?: string
          event_id?: string
          round_id: string
        }
        Update: {
          crash?: number | null
          crashed_at?: string | null
          created_at?: string
          event_id?: string
          round_id?: string
        }
        Relationships: []
      }
      bet_rejections: {
        Row: {
          code: string
          created_at: string
          game_id: string | null
          id: string
          ip: string | null
          market: string | null
          message: string | null
          odds: number | null
          operator_id: string | null
          operator_user_id: string | null
          round_id: string | null
          selection: string | null
          stake: number | null
        }
        Insert: {
          code: string
          created_at?: string
          game_id?: string | null
          id?: string
          ip?: string | null
          market?: string | null
          message?: string | null
          odds?: number | null
          operator_id?: string | null
          operator_user_id?: string | null
          round_id?: string | null
          selection?: string | null
          stake?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          game_id?: string | null
          id?: string
          ip?: string | null
          market?: string | null
          message?: string | null
          odds?: number | null
          operator_id?: string | null
          operator_user_id?: string | null
          round_id?: string | null
          selection?: string | null
          stake?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bet_rejections_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      bets: {
        Row: {
          created_at: string
          game_id: string
          id: string
          market: string | null
          odds: number
          operator_id: string
          operator_user_id: string
          payout: number
          reference: string | null
          round_id: string
          selection: string
          settled_at: string | null
          stake: number
          status: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          market?: string | null
          odds: number
          operator_id: string
          operator_user_id: string
          payout?: number
          reference?: string | null
          round_id: string
          selection: string
          settled_at?: string | null
          stake: number
          status?: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          market?: string | null
          odds?: number
          operator_id?: string
          operator_user_id?: string
          payout?: number
          reference?: string | null
          round_id?: string
          selection?: string
          settled_at?: string | null
          stake?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bets_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      callback_logs: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          ok: boolean
          operator_id: string
          request: Json | null
          response: Json | null
          status_code: number | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          ok?: boolean
          operator_id: string
          request?: Json | null
          response?: Json | null
          status_code?: number | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          ok?: boolean
          operator_id?: string
          request?: Json | null
          response?: Json | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "callback_logs_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_whitelist: {
        Row: {
          api_key_id: string | null
          created_at: string
          domain: string
          id: string
          note: string | null
          operator_id: string
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          domain: string
          id?: string
          note?: string | null
          operator_id: string
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          domain?: string
          id?: string
          note?: string | null
          operator_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_whitelist_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domain_whitelist_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_whitelist: {
        Row: {
          api_key_id: string | null
          created_at: string
          id: string
          ip: string
          note: string | null
          operator_id: string
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          id?: string
          ip: string
          note?: string | null
          operator_id: string
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          id?: string
          ip?: string
          note?: string | null
          operator_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ip_whitelist_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ip_whitelist_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      operators: {
        Row: {
          bet_passthrough: boolean
          callback_secret: string | null
          callback_url: string | null
          contact_email: string | null
          created_at: string
          currency: string
          id: string
          name: string
          owner_id: string | null
          plan_amount: number
          plan_expires_at: string | null
          products: string[]
          status: string
        }
        Insert: {
          bet_passthrough?: boolean
          callback_secret?: string | null
          callback_url?: string | null
          contact_email?: string | null
          created_at?: string
          currency?: string
          id?: string
          name: string
          owner_id?: string | null
          plan_amount?: number
          plan_expires_at?: string | null
          products?: string[]
          status?: string
        }
        Update: {
          bet_passthrough?: boolean
          callback_secret?: string | null
          callback_url?: string | null
          contact_email?: string | null
          created_at?: string
          currency?: string
          id?: string
          name?: string
          owner_id?: string | null
          plan_amount?: number
          plan_expires_at?: string | null
          products?: string[]
          status?: string
        }
        Relationships: []
      }
      rounds: {
        Row: {
          created_at: string
          game_id: string
          id: string
          manual: boolean
          result: Json | null
          round_id: string
          settled_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          manual?: boolean
          result?: Json | null
          round_id: string
          settled_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          manual?: boolean
          result?: Json | null
          round_id?: string
          settled_at?: string | null
          status?: string
        }
        Relationships: []
      }
      sports_watch: {
        Row: {
          event_id: string
          gone_since: string | null
          sport_id: string
          state: Json
          updated_at: string
        }
        Insert: {
          event_id: string
          gone_since?: string | null
          sport_id: string
          state?: Json
          updated_at?: string
        }
        Update: {
          event_id?: string
          gone_since?: string | null
          sport_id?: string
          state?: Json
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          balance_after: number | null
          bet_id: string | null
          created_at: string
          id: string
          kind: string
          operator_id: string
          operator_user_id: string
          reference: string | null
          status: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          bet_id?: string | null
          created_at?: string
          id?: string
          kind: string
          operator_id: string
          operator_user_id: string
          reference?: string | null
          status?: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          bet_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          operator_id?: string
          operator_user_id?: string
          reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_bet_id_fkey"
            columns: ["bet_id"]
            isOneToOne: false
            referencedRelation: "bets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owns_operator: { Args: { _operator_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "operator"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "operator"],
    },
  },
} as const
