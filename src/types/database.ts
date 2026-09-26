export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      cheque_history: {
        Row: {
          changed_by: string
          cheque_id: string
          created_at: string | null
          from_status: string
          id: string
          note: string | null
          to_status: string
        }
        Insert: {
          changed_by: string
          cheque_id: string
          created_at?: string | null
          from_status: string
          id?: string
          note?: string | null
          to_status: string
        }
        Update: {
          changed_by?: string
          cheque_id?: string
          created_at?: string | null
          from_status?: string
          id?: string
          note?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cheque_history_cheque_id_fkey"
            columns: ["cheque_id"]
            isOneToOne: false
            referencedRelation: "cheques"
            referencedColumns: ["id"]
          },
        ]
      }
      cheques: {
        Row: {
          amount: number
          auto_transition_blocked: boolean | null
          bank_name: string
          cheque_number: string
          created_at: string | null
          deleted_at: string | null
          due_date: string
          id: string
          issue_date: string
          notes: string | null
          party_id: string
          return_reason: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          auto_transition_blocked?: boolean | null
          bank_name: string
          cheque_number: string
          created_at?: string | null
          deleted_at?: string | null
          due_date: string
          id?: string
          issue_date: string
          notes?: string | null
          party_id: string
          return_reason?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          auto_transition_blocked?: boolean | null
          bank_name?: string
          cheque_number?: string
          created_at?: string | null
          deleted_at?: string | null
          due_date?: string
          id?: string
          issue_date?: string
          notes?: string | null
          party_id?: string
          return_reason?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cheques_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_deposits: {
        Row: {
          amount: number
          created_at: string | null
          deposit_date: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          deposit_date?: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          deposit_date?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      parties: {
        Row: {
          bank_name: string | null
          contact_name: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          user_id: string
        }
        Insert: {
          bank_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          user_id: string
        }
        Update: {
          bank_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          allocation_sort: string | null
          auto_pass_enabled: boolean
          auto_pass_time: string | null
          banks: string[] | null
          created_at: string | null
          currency_symbol: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allocation_sort?: string | null
          auto_pass_enabled?: boolean
          auto_pass_time?: string | null
          banks?: string[] | null
          created_at?: string | null
          currency_symbol?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allocation_sort?: string | null
          auto_pass_enabled?: boolean
          auto_pass_time?: string | null
          banks?: string[] | null
          created_at?: string | null
          currency_symbol?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      change_cheque_status: {
        Args: {
          p_changed_by?: string
          p_cheque_id: string
          p_new_status: string
          p_note?: string
          p_return_reason?: string
        }
        Returns: undefined
      }
      record_deposit: {
        Args: {
          p_amount: number
          p_cheque_ids?: string[]
          p_deposit_date: string
          p_notes?: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

