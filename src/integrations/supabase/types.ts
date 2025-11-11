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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          acao: string
          alvo: string
          created_at: string
          detalhes: Json | null
          id: string
          usuario_id: string
        }
        Insert: {
          acao: string
          alvo: string
          created_at?: string
          detalhes?: Json | null
          id?: string
          usuario_id: string
        }
        Update: {
          acao?: string
          alvo?: string
          created_at?: string
          detalhes?: Json | null
          id?: string
          usuario_id?: string
        }
        Relationships: []
      }
      board_comments: {
        Row: {
          author_name: string
          board_id: string
          content: string
          created_at: string
          id: string
          is_public: boolean | null
          updated_at: string
        }
        Insert: {
          author_name: string
          board_id: string
          content: string
          created_at?: string
          id?: string
          is_public?: boolean | null
          updated_at?: string
        }
        Update: {
          author_name?: string
          board_id?: string
          content?: string
          created_at?: string
          id?: string
          is_public?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_comments_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "board_ai_view"
            referencedColumns: ["board_id"]
          },
          {
            foreignKeyName: "board_comments_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      board_messages: {
        Row: {
          board_id: string
          created_at: string | null
          id: string
          is_public: boolean | null
          message_content: string
          sender_email: string | null
          sender_name: string
          sender_type: string
          updated_at: string | null
        }
        Insert: {
          board_id: string
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          message_content: string
          sender_email?: string | null
          sender_name: string
          sender_type: string
          updated_at?: string | null
        }
        Update: {
          board_id?: string
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          message_content?: string
          sender_email?: string | null
          sender_name?: string
          sender_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "board_messages_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "board_ai_view"
            referencedColumns: ["board_id"]
          },
          {
            foreignKeyName: "board_messages_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          owner_id: string
          publico: boolean
          senha_hash: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          owner_id: string
          publico?: boolean
          senha_hash: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          owner_id?: string
          publico?: boolean
          senha_hash?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      columns: {
        Row: {
          board_id: string
          cor: string | null
          created_at: string
          id: string
          posicao: number
          titulo: string
          updated_at: string
        }
        Insert: {
          board_id: string
          cor?: string | null
          created_at?: string
          id?: string
          posicao?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          board_id?: string
          cor?: string | null
          created_at?: string
          id?: string
          posicao?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "columns_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "board_ai_view"
            referencedColumns: ["board_id"]
          },
          {
            foreignKeyName: "columns_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      multas_monitoradas: {
        Row: {
          created_at: string | null
          data_infracao: string | null
          data_vencimento: string | null
          enviado_1dia: boolean | null
          enviado_chegada: boolean | null
          enviado_hoje: boolean | null
          id_brobot: string
          placa: string | null
          renavam: string | null
          status: string | null
          updated_at: string | null
          valor_reais: number | null
        }
        Insert: {
          created_at?: string | null
          data_infracao?: string | null
          data_vencimento?: string | null
          enviado_1dia?: boolean | null
          enviado_chegada?: boolean | null
          enviado_hoje?: boolean | null
          id_brobot: string
          placa?: string | null
          renavam?: string | null
          status?: string | null
          updated_at?: string | null
          valor_reais?: number | null
        }
        Update: {
          created_at?: string | null
          data_infracao?: string | null
          data_vencimento?: string | null
          enviado_1dia?: boolean | null
          enviado_chegada?: boolean | null
          enviado_hoje?: boolean | null
          id_brobot?: string
          placa?: string | null
          renavam?: string | null
          status?: string | null
          updated_at?: string | null
          valor_reais?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          foto_perfil: string | null
          id: string
          nome: string
          status: Database["public"]["Enums"]["user_status"]
          telefone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          foto_perfil?: string | null
          id: string
          nome: string
          status?: Database["public"]["Enums"]["user_status"]
          telefone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          foto_perfil?: string | null
          id?: string
          nome?: string
          status?: Database["public"]["Enums"]["user_status"]
          telefone?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          author_name: string
          content: string
          created_at: string
          id: string
          is_public: boolean | null
          task_id: string
          updated_at: string
        }
        Insert: {
          author_name: string
          content: string
          created_at?: string
          id?: string
          is_public?: boolean | null
          task_id: string
          updated_at?: string
        }
        Update: {
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          is_public?: boolean | null
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_participants: {
        Row: {
          created_at: string | null
          id: string
          role: string | null
          task_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: string | null
          task_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string | null
          task_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_participants_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          anexos: string[] | null
          column_id: string
          created_at: string
          data_entrega: string | null
          descricao: string | null
          id: string
          posicao: number
          prioridade: Database["public"]["Enums"]["task_priority"]
          responsavel_id: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          anexos?: string[] | null
          column_id: string
          created_at?: string
          data_entrega?: string | null
          descricao?: string | null
          id?: string
          posicao?: number
          prioridade?: Database["public"]["Enums"]["task_priority"]
          responsavel_id?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          anexos?: string[] | null
          column_id?: string
          created_at?: string
          data_entrega?: string | null
          descricao?: string | null
          id?: string
          posicao?: number
          prioridade?: Database["public"]["Enums"]["task_priority"]
          responsavel_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "columns"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          board_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          board_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          board_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "board_ai_view"
            referencedColumns: ["board_id"]
          },
          {
            foreignKeyName: "user_roles_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      board_ai_view: {
        Row: {
          board_id: string | null
          data: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_email: { Args: { user_id: string }; Returns: string }
      get_user_emails: {
        Args: { user_ids: string[] }
        Returns: {
          email: string
          id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_user_active: { Args: { _user_id: string }; Returns: boolean }
      sync_multas: { Args: { items: Json }; Returns: number }
    }
    Enums: {
      app_role: "user" | "admin"
      task_priority: "baixa" | "media" | "alta"
      user_status: "aguardando" | "ativo" | "bloqueado"
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
      app_role: ["user", "admin"],
      task_priority: ["baixa", "media", "alta"],
      user_status: ["aguardando", "ativo", "bloqueado"],
    },
  },
} as const
