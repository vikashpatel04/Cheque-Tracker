export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
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
          auto_pass_time: string | null
          created_at: string | null
          currency_symbol: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allocation_sort?: string | null
          auto_pass_time?: string | null
          created_at?: string | null
          currency_symbol?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allocation_sort?: string | null
          auto_pass_time?: string | null
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
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Update"]
