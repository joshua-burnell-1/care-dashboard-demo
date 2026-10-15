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
      care_team_members: {
        Row: {
          created_at: string
          id: string
          name: string
          note: string
          role: string
          sort_index: number
          updated_at: string
          where_based: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          note?: string
          role?: string
          sort_index?: number
          updated_at?: string
          where_based?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          note?: string
          role?: string
          sort_index?: number
          updated_at?: string
          where_based?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string
        }
        Relationships: []
      }
      dashboard_sections: {
        Row: {
          content: Json
          key: string
          updated_at: string
        }
        Insert: {
          content?: Json
          key: string
          updated_at?: string
        }
        Update: {
          content?: Json
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          error: string | null
          extracted_chars: number
          id: string
          mime_type: string
          name: string
          size_bytes: number
          status: string
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          error?: string | null
          extracted_chars?: number
          id?: string
          mime_type?: string
          name: string
          size_bytes?: number
          status?: string
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          error?: string | null
          extracted_chars?: number
          id?: string
          mime_type?: string
          name?: string
          size_bytes?: number
          status?: string
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: []
      }
      edit_history: {
        Row: {
          changed_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          operation: string
          record_id: string
          table_name: string
        }
        Insert: {
          changed_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          record_id: string
          table_name: string
        }
        Update: {
          changed_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      kpi_cards: {
        Row: {
          created_at: string
          id: string
          label: string
          sort_index: number
          sub: string
          tone: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          sort_index?: number
          sub?: string
          tone?: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          sort_index?: number
          sub?: string
          tone?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      lab_results: {
        Row: {
          category: string | null
          created_at: string
          date: string | null
          flag: string | null
          id: string
          metric: string
          note: string
          reference_range: string | null
          sort_index: number
          source: string
          source_document_id: string | null
          unit: string
          updated_at: string
          value_numeric: number | null
          value_text: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          date?: string | null
          flag?: string | null
          id?: string
          metric: string
          note?: string
          reference_range?: string | null
          sort_index?: number
          source?: string
          source_document_id?: string | null
          unit?: string
          updated_at?: string
          value_numeric?: number | null
          value_text?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          date?: string | null
          flag?: string | null
          id?: string
          metric?: string
          note?: string
          reference_range?: string | null
          sort_index?: number
          source?: string
          source_document_id?: string | null
          unit?: string
          updated_at?: string
          value_numeric?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_results_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_cache: {
        Row: {
          context: string
          data: Json
          id: number
          last_error: string | null
          last_synced_at: string
          sources: Json
        }
        Insert: {
          context?: string
          data?: Json
          id: number
          last_error?: string | null
          last_synced_at?: string
          sources?: Json
        }
        Update: {
          context?: string
          data?: Json
          id?: number
          last_error?: string | null
          last_synced_at?: string
          sources?: Json
        }
        Relationships: []
      }
      medication_items: {
        Row: {
          created_at: string
          dose: string
          id: string
          item: string
          purpose: string
          sort_index: number
          started_by: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dose?: string
          id?: string
          item: string
          purpose?: string
          sort_index?: number
          started_by?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dose?: string
          id?: string
          item?: string
          purpose?: string
          sort_index?: number
          started_by?: string
          updated_at?: string
        }
        Relationships: []
      }
      plan_items: {
        Row: {
          body: string
          created_at: string
          event_date: string | null
          id: string
          sort_index: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          event_date?: string | null
          id?: string
          sort_index?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          event_date?: string | null
          id?: string
          sort_index?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      psa_readings: {
        Row: {
          created_at: string
          date: string
          id: string
          note: string
          phase: string
          sort_index: number
          unit: string
          updated_at: string
          value: number | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          note?: string
          phase?: string
          sort_index?: number
          unit?: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          note?: string
          phase?: string
          sort_index?: number
          unit?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      realtime_status: {
        Row: {
          enabled: boolean | null
          table_name: string | null
        }
        Relationships: []
      }
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
    Enums: {},
  },
} as const
