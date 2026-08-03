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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agendamento_anexos: {
        Row: {
          agendamento_id: string
          content_type: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
        }
        Insert: {
          agendamento_id: string
          content_type?: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number
          id?: string
        }
        Update: {
          agendamento_id?: string
          content_type?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduling_attachments_scheduling_request_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "scheduling_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamento_archives: {
        Row: {
          agendamento_id: string
          created_at: string
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          agendamento_id: string
          created_at?: string
          id?: string
          kind?: string
          user_id: string
        }
        Update: {
          agendamento_id?: string
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      agendamentos: {
        Row: {
          cargo_1: string
          cargo_2: string
          created_at: string
          data_secao: string
          destinatario_cargo_1: string
          destinatario_cargo_2: string
          destinatario_nome: string
          destinatario_secao: string
          dirigente: string
          email_de: string
          email_para: string
          horario: string
          id: string
          local: string
          nome_associado: string
          nome_evento: string
          observacoes: string
          ramo_escoteiro: string
          recipient_response: string
          recipient_response_at: string | null
          recipient_response_by: string | null
          recipient_response_reason: string | null
          secao: string
          status: string
          tipo_atividade: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cargo_1?: string
          cargo_2?: string
          created_at?: string
          data_secao: string
          destinatario_cargo_1?: string
          destinatario_cargo_2?: string
          destinatario_nome?: string
          destinatario_secao?: string
          dirigente?: string
          email_de: string
          email_para?: string
          horario: string
          id?: string
          local?: string
          nome_associado: string
          nome_evento?: string
          observacoes?: string
          ramo_escoteiro?: string
          recipient_response?: string
          recipient_response_at?: string | null
          recipient_response_by?: string | null
          recipient_response_reason?: string | null
          secao?: string
          status?: string
          tipo_atividade?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cargo_1?: string
          cargo_2?: string
          created_at?: string
          data_secao?: string
          destinatario_cargo_1?: string
          destinatario_cargo_2?: string
          destinatario_nome?: string
          destinatario_secao?: string
          dirigente?: string
          email_de?: string
          email_para?: string
          horario?: string
          id?: string
          local?: string
          nome_associado?: string
          nome_evento?: string
          observacoes?: string
          ramo_escoteiro?: string
          recipient_response?: string
          recipient_response_at?: string | null
          recipient_response_by?: string | null
          recipient_response_reason?: string | null
          secao?: string
          status?: string
          tipo_atividade?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_push_notifications: {
        Row: {
          agendamento_id: string
          agendamento_source: Database["public"]["Enums"]["agendamento_source"]
          attempts: number
          body: string
          created_at: string
          delivered_count: number
          failed_count: number
          id: string
          last_error: string | null
          max_attempts: number
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_channel_status"]
          title: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          agendamento_id: string
          agendamento_source?: Database["public"]["Enums"]["agendamento_source"]
          attempts?: number
          body: string
          created_at?: string
          delivered_count?: number
          failed_count?: number
          id?: string
          last_error?: string | null
          max_attempts?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_channel_status"]
          title: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          agendamento_id?: string
          agendamento_source?: Database["public"]["Enums"]["agendamento_source"]
          attempts?: number
          body?: string
          created_at?: string
          delivered_count?: number
          failed_count?: number
          id?: string
          last_error?: string | null
          max_attempts?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_channel_status"]
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      aprovacoes: {
        Row: {
          agendamento_id: string
          aprovado_por: string | null
          created_at: string
          id: string
          motivo_rejeicao: string | null
          nivel: number
          status: string
          updated_at: string
        }
        Insert: {
          agendamento_id: string
          aprovado_por?: string | null
          created_at?: string
          id?: string
          motivo_rejeicao?: string | null
          nivel: number
          status?: string
          updated_at?: string
        }
        Update: {
          agendamento_id?: string
          aprovado_por?: string | null
          created_at?: string
          id?: string
          motivo_rejeicao?: string | null
          nivel?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aprovacoes_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "scheduling_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          created_at: string
          details: Json | null
          id: string
          image_id: string | null
          ip_address: string | null
          user_id: string
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          details?: Json | null
          id?: string
          image_id?: string | null
          ip_address?: string | null
          user_id: string
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          details?: Json | null
          id?: string
          image_id?: string | null
          ip_address?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "images"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          display_name: string
          icon: string
          id: string
          key: string
          sort_order: number
        }
        Insert: {
          display_name: string
          icon?: string
          id?: string
          key: string
          sort_order?: number
        }
        Update: {
          display_name?: string
          icon?: string
          id?: string
          key?: string
          sort_order?: number
        }
        Relationships: []
      }
      document_access_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          document_id: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          document_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          document_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_access_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_folders: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          is_system: boolean
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      document_role_permissions: {
        Row: {
          can_delete: boolean
          can_download: boolean
          can_edit: boolean
          can_share: boolean
          can_upload: boolean
          can_view: boolean
          created_at: string
          document_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          can_delete?: boolean
          can_download?: boolean
          can_edit?: boolean
          can_share?: boolean
          can_upload?: boolean
          can_view?: boolean
          created_at?: string
          document_id: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          can_delete?: boolean
          can_download?: boolean
          can_edit?: boolean
          can_share?: boolean
          can_upload?: boolean
          can_view?: boolean
          created_at?: string
          document_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "document_role_permissions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string | null
          checksum: string | null
          created_at: string
          description: string | null
          download_count: number
          event_id: string | null
          extension: string | null
          filename: string
          folder_id: string | null
          id: string
          is_archived: boolean
          mime_type: string
          scout_id: string | null
          size_bytes: number
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string | null
          view_count: number
          visibility: string
        }
        Insert: {
          category?: string | null
          checksum?: string | null
          created_at?: string
          description?: string | null
          download_count?: number
          event_id?: string | null
          extension?: string | null
          filename: string
          folder_id?: string | null
          id?: string
          is_archived?: boolean
          mime_type: string
          scout_id?: string | null
          size_bytes?: number
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
          view_count?: number
          visibility?: string
        }
        Update: {
          category?: string | null
          checksum?: string | null
          created_at?: string
          description?: string | null
          download_count?: number
          event_id?: string | null
          extension?: string | null
          filename?: string
          folder_id?: string | null
          id?: string
          is_archived?: boolean
          mime_type?: string
          scout_id?: string | null
          size_bytes?: number
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          view_count?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_scout_id_fkey"
            columns: ["scout_id"]
            isOneToOne: false
            referencedRelation: "scouts"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_uploads: {
        Row: {
          branch: string
          created_at: string
          drive_file_id: string | null
          drive_folder_id: string | null
          drive_folder_url: string | null
          error_message: string | null
          file_name: string
          file_size: number
          id: string
          mime_type: string
          photo_date: string
          scout_id: string | null
          scout_name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch?: string
          created_at?: string
          drive_file_id?: string | null
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          error_message?: string | null
          file_name: string
          file_size?: number
          id?: string
          mime_type?: string
          photo_date: string
          scout_id?: string | null
          scout_name?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          branch?: string
          created_at?: string
          drive_file_id?: string | null
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          error_message?: string | null
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          photo_date?: string
          scout_id?: string | null
          scout_name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          recipient: string
          status: string
          template_name: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient: string
          status: string
          template_name?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient?: string
          status?: string
          template_name?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      event_permissions: {
        Row: {
          can_download: boolean
          can_manage: boolean
          can_upload: boolean
          can_view: boolean
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          can_download?: boolean
          can_manage?: boolean
          can_upload?: boolean
          can_view?: boolean
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          can_download?: boolean
          can_manage?: boolean
          can_upload?: boolean
          can_view?: boolean
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_permissions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_share_links: {
        Row: {
          created_at: string
          created_by: string
          event_id: string
          expires_at: string
          id: string
          is_active: boolean
          max_views: number | null
          token: string
          view_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          event_id: string
          expires_at: string
          id?: string
          is_active?: boolean
          max_views?: number | null
          token?: string
          view_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          event_id?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          max_views?: number | null
          token?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_share_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string
          description: string | null
          event_date: string | null
          id: string
          location: string | null
          name: string
          scout_group: string | null
          source: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          event_date?: string | null
          id?: string
          location?: string | null
          name: string
          scout_group?: string | null
          source?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          event_date?: string | null
          id?: string
          location?: string | null
          name?: string
          scout_group?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      global_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      guardians: {
        Row: {
          authorization_date: string | null
          created_at: string
          created_by: string
          email: string
          id: string
          image_authorization: boolean
          name: string
          phone: string | null
          scout_id: string
        }
        Insert: {
          authorization_date?: string | null
          created_at?: string
          created_by: string
          email?: string
          id?: string
          image_authorization?: boolean
          name: string
          phone?: string | null
          scout_id: string
        }
        Update: {
          authorization_date?: string | null
          created_at?: string
          created_by?: string
          email?: string
          id?: string
          image_authorization?: boolean
          name?: string
          phone?: string | null
          scout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardians_scout_id_fkey"
            columns: ["scout_id"]
            isOneToOne: false
            referencedRelation: "scouts"
            referencedColumns: ["id"]
          },
        ]
      }
      hosting_config: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      images: {
        Row: {
          branch_id: string
          caption: string | null
          consent: boolean
          created_at: string
          downloads: number
          duration_seconds: number | null
          event_id: string | null
          external_url: string | null
          filename: string | null
          id: string
          media_type: string
          minor_age: number | null
          responsible_name: string | null
          storage_path: string | null
          tags: string[] | null
          thumbnail_path: string | null
          user_id: string
          views: number
          visibility: Database["public"]["Enums"]["image_visibility"]
        }
        Insert: {
          branch_id: string
          caption?: string | null
          consent?: boolean
          created_at?: string
          downloads?: number
          duration_seconds?: number | null
          event_id?: string | null
          external_url?: string | null
          filename?: string | null
          id?: string
          media_type?: string
          minor_age?: number | null
          responsible_name?: string | null
          storage_path?: string | null
          tags?: string[] | null
          thumbnail_path?: string | null
          user_id: string
          views?: number
          visibility?: Database["public"]["Enums"]["image_visibility"]
        }
        Update: {
          branch_id?: string
          caption?: string | null
          consent?: boolean
          created_at?: string
          downloads?: number
          duration_seconds?: number | null
          event_id?: string | null
          external_url?: string | null
          filename?: string | null
          id?: string
          media_type?: string
          minor_age?: number | null
          responsible_name?: string | null
          storage_path?: string | null
          tags?: string[] | null
          thumbnail_path?: string | null
          user_id?: string
          views?: number
          visibility?: Database["public"]["Enums"]["image_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "images_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "images_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_links: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          role: string
          section: string | null
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          role?: string
          section?: string | null
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          role?: string
          section?: string | null
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          email: string
          failed_count: number
          last_failed_at: string
          locked_until: string | null
          updated_at: string
        }
        Insert: {
          email: string
          failed_count?: number
          last_failed_at?: string
          locked_until?: string | null
          updated_at?: string
        }
        Update: {
          email?: string
          failed_count?: number
          last_failed_at?: string
          locked_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      motivational_messages: {
        Row: {
          author: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          text: string
          updated_at: string
        }
        Insert: {
          author?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          text: string
          updated_at?: string
        }
        Update: {
          author?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          text?: string
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          category: string
          id: string
          key: string
          name: string
          sort_order: number
        }
        Insert: {
          category: string
          id?: string
          key: string
          name: string
          sort_order?: number
        }
        Update: {
          category?: string
          id?: string
          key?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cargo_1: string | null
          cargo_2: string | null
          created_at: string
          email: string
          force_refresh_at: string | null
          id: string
          is_active: boolean
          must_change_password: boolean
          name: string
          section: string | null
          updated_at: string
          user_id: string
          user_number: number | null
        }
        Insert: {
          avatar_url?: string | null
          cargo_1?: string | null
          cargo_2?: string | null
          created_at?: string
          email?: string
          force_refresh_at?: string | null
          id?: string
          is_active?: boolean
          must_change_password?: boolean
          name?: string
          section?: string | null
          updated_at?: string
          user_id: string
          user_number?: number | null
        }
        Update: {
          avatar_url?: string | null
          cargo_1?: string | null
          cargo_2?: string | null
          created_at?: string
          email?: string
          force_refresh_at?: string | null
          id?: string
          is_active?: boolean
          must_change_password?: boolean
          name?: string
          section?: string | null
          updated_at?: string
          user_id?: string
          user_number?: number | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      role_descriptions: {
        Row: {
          description: string
          display_name: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          description?: string
          display_name: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          description?: string
          display_name?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          id: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          id?: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          id?: string
          permission_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduling_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          created_at: string
          data: string
          descricao: string
          destinatario_cargo_1: string
          destinatario_cargo_2: string
          destinatario_email: string
          destinatario_nome: string
          destinatario_secao: string
          email: string
          event_id: string | null
          horario: string
          id: string
          local: string
          nome_responsavel: string
          rejection_reason: string | null
          status: string
          tipo: string
          token_confirmacao: string
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          data: string
          descricao?: string
          destinatario_cargo_1?: string
          destinatario_cargo_2?: string
          destinatario_email?: string
          destinatario_nome?: string
          destinatario_secao?: string
          email: string
          event_id?: string | null
          horario: string
          id?: string
          local: string
          nome_responsavel: string
          rejection_reason?: string | null
          status?: string
          tipo: string
          token_confirmacao?: string
          token_expires_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          data?: string
          descricao?: string
          destinatario_cargo_1?: string
          destinatario_cargo_2?: string
          destinatario_email?: string
          destinatario_nome?: string
          destinatario_secao?: string
          email?: string
          event_id?: string | null
          horario?: string
          id?: string
          local?: string
          nome_responsavel?: string
          rejection_reason?: string | null
          status?: string
          tipo?: string
          token_confirmacao?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduling_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduling_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      scout_achievements: {
        Row: {
          achievement_date: string
          created_at: string
          created_by: string
          description: string
          id: string
          name: string
          scout_id: string
          type: Database["public"]["Enums"]["achievement_type"]
          updated_at: string
        }
        Insert: {
          achievement_date: string
          created_at?: string
          created_by: string
          description?: string
          id?: string
          name: string
          scout_id: string
          type?: Database["public"]["Enums"]["achievement_type"]
          updated_at?: string
        }
        Update: {
          achievement_date?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          name?: string
          scout_id?: string
          type?: Database["public"]["Enums"]["achievement_type"]
          updated_at?: string
        }
        Relationships: []
      }
      scout_photos: {
        Row: {
          caption: string
          created_at: string
          file_size: number
          id: string
          is_favorite: boolean
          mime_type: string
          scout_id: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          caption?: string
          created_at?: string
          file_size?: number
          id?: string
          is_favorite?: boolean
          mime_type?: string
          scout_id: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          caption?: string
          created_at?: string
          file_size?: number
          id?: string
          is_favorite?: boolean
          mime_type?: string
          scout_id?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "scout_photos_scout_id_fkey"
            columns: ["scout_id"]
            isOneToOne: false
            referencedRelation: "scouts"
            referencedColumns: ["id"]
          },
        ]
      }
      scouts: {
        Row: {
          admission_date: string | null
          birth_date: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          manual_branch: string | null
          name: string
          notes: string | null
          phone: string | null
          photo_url: string | null
          registration_id: string | null
          scout_group: string
          section: string | null
          subgroup_id: string | null
          transition_date: string | null
          updated_at: string
        }
        Insert: {
          admission_date?: string | null
          birth_date: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          manual_branch?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          registration_id?: string | null
          scout_group?: string
          section?: string | null
          subgroup_id?: string | null
          transition_date?: string | null
          updated_at?: string
        }
        Update: {
          admission_date?: string | null
          birth_date?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          manual_branch?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          registration_id?: string | null
          scout_group?: string
          section?: string | null
          subgroup_id?: string | null
          transition_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scouts_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "subgroups"
            referencedColumns: ["id"]
          },
        ]
      }
      security_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          priority: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          priority?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          priority?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      storage_alert_config: {
        Row: {
          bucket_crit_bytes: number
          bucket_warn_bytes: number
          db_crit_bytes: number
          db_warn_bytes: number
          id: number
          storage_crit_bytes: number
          storage_warn_bytes: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bucket_crit_bytes?: number
          bucket_warn_bytes?: number
          db_crit_bytes?: number
          db_warn_bytes?: number
          id?: number
          storage_crit_bytes?: number
          storage_warn_bytes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bucket_crit_bytes?: number
          bucket_warn_bytes?: number
          db_crit_bytes?: number
          db_warn_bytes?: number
          id?: number
          storage_crit_bytes?: number
          storage_warn_bytes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      storage_alerts_sent: {
        Row: {
          alert_key: string
          id: string
          level: string
          sent_at: string
          threshold_bytes: number
          value_bytes: number
        }
        Insert: {
          alert_key: string
          id?: string
          level: string
          sent_at?: string
          threshold_bytes: number
          value_bytes: number
        }
        Update: {
          alert_key?: string
          id?: string
          level?: string
          sent_at?: string
          threshold_bytes?: number
          value_bytes?: number
        }
        Relationships: []
      }
      subgroups: {
        Row: {
          branch_key: string
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          branch_key: string
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          branch_key?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_health: {
        Row: {
          details: Json | null
          id: string
          last_check: string | null
          service_name: string
          status: string
          updated_at: string | null
        }
        Insert: {
          details?: Json | null
          id?: string
          last_check?: string | null
          service_name: string
          status: string
          updated_at?: string | null
        }
        Update: {
          details?: Json | null
          id?: string
          last_check?: string | null
          service_name?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      upload_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          image_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          image_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          image_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "upload_logs_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "images"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          app_version: string | null
          browser: string
          created_at: string
          device_fingerprint: string
          device_name: string
          geo_city: string | null
          geo_country: string | null
          id: string
          ip_address: string | null
          is_trusted: boolean
          last_login_at: string
          os: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          browser?: string
          created_at?: string
          device_fingerprint: string
          device_name?: string
          geo_city?: string | null
          geo_country?: string | null
          id?: string
          ip_address?: string | null
          is_trusted?: boolean
          last_login_at?: string
          os?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          browser?: string
          created_at?: string
          device_fingerprint?: string
          device_name?: string
          geo_city?: string | null
          geo_country?: string | null
          id?: string
          ip_address?: string | null
          is_trusted?: boolean
          last_login_at?: string
          os?: string
          user_id?: string
        }
        Relationships: []
      }
      user_google_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          google_email: string
          id: string
          refresh_token: string
          scope: string
          token_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          google_email?: string
          id?: string
          refresh_token: string
          scope?: string
          token_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          google_email?: string
          id?: string
          refresh_token?: string
          scope?: string
          token_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_notifications: {
        Row: {
          agendamento_id: string
          agendamento_source: Database["public"]["Enums"]["agendamento_source"]
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          max_attempts: number
          message: string
          provider_message_sid: string | null
          recipient_name: string
          recipient_phone: string
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_channel_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          agendamento_id: string
          agendamento_source?: Database["public"]["Enums"]["agendamento_source"]
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          message: string
          provider_message_sid?: string | null
          recipient_name?: string
          recipient_phone: string
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_channel_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          agendamento_id?: string
          agendamento_source?: Database["public"]["Enums"]["agendamento_source"]
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          message?: string
          provider_message_sid?: string | null
          recipient_name?: string
          recipient_phone?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_channel_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      agendamento_notification_status: {
        Row: {
          agendamento_id: string | null
          agendamento_source:
            | Database["public"]["Enums"]["agendamento_source"]
            | null
          email_status: string | null
          push_status: string | null
          user_id: string | null
          whatsapp_status: string | null
        }
        Insert: {
          agendamento_id?: string | null
          agendamento_source?: never
          email_status?: never
          push_status?: never
          user_id?: string | null
          whatsapp_status?: never
        }
        Update: {
          agendamento_id?: string | null
          agendamento_source?: never
          email_status?: never
          push_status?: never
          user_id?: string | null
          whatsapp_status?: never
        }
        Relationships: []
      }
    }
    Functions: {
      admin_check_agendamento_visibility: {
        Args: { p_agendamento_id: string; p_email: string }
        Returns: {
          can_view: boolean
          has_admin_role: boolean
          is_recipient: boolean
          is_sender: boolean
          persona_email: string
          persona_user_id: string
          reason: string
        }[]
      }
      admin_clear_inactive_sessions: { Args: never; Returns: number }
      admin_clear_login_history: { Args: never; Returns: number }
      admin_list_locked_logins: {
        Args: never
        Returns: {
          email: string
          failed_count: number
          is_locked: boolean
          last_failed_at: string
          locked_until: string
        }[]
      }
      admin_list_online_users: {
        Args: never
        Returns: {
          last_active: string
          name: string
          user_id: string
        }[]
      }
      admin_signout_user: {
        Args: { p_admin_user_id?: string; p_user_id: string }
        Returns: undefined
      }
      admin_unlock_login: { Args: { p_email: string }; Returns: undefined }
      can_access_document: {
        Args: { _action?: string; _document_id: string; _user_id: string }
        Returns: boolean
      }
      can_upload_documents: { Args: { _user_id: string }; Returns: boolean }
      can_view_member_data: { Args: { _user_id: string }; Returns: boolean }
      can_view_storage_image: {
        Args: { _storage_path: string; _user_id: string }
        Returns: boolean
      }
      check_login_block: {
        Args: { p_email: string }
        Returns: {
          failed_count: number
          locked: boolean
          remaining_seconds: number
        }[]
      }
      cleanup_cron_job_run_details: { Args: never; Returns: number }
      cleanup_old_refresh_tokens: { Args: never; Returns: number }
      clear_login_attempts: { Args: { p_email: string }; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_admin_emails: {
        Args: never
        Returns: {
          email: string
        }[]
      }
      get_db_storage_stats: { Args: never; Returns: Json }
      get_invite_link_by_token: {
        Args: { p_token: string }
        Returns: {
          created_at: string
          expires_at: string
          id: string
          role: string
          section: string
          used_at: string
          used_by: string
        }[]
      }
      get_next_user_number: { Args: never; Returns: number }
      get_share_link_by_token: {
        Args: { p_token: string }
        Returns: {
          event_id: string
          expires_at: string
          is_active: boolean
          max_views: number
          view_count: number
        }[]
      }
      get_user_section: { Args: { _user_id: string }; Returns: string }
      has_event_permission: {
        Args: { _event_id: string; _permission: string; _user_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: { _permission_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_share_link_view: {
        Args: { p_token: string }
        Returns: undefined
      }
      is_guardian_for_scout: {
        Args: { _scout_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: { Args: { _user_id: string }; Returns: boolean }
      log_audit: {
        Args: {
          _action: string
          _after_data?: Json
          _before_data?: Json
          _details?: Json
          _image_id?: string
        }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_login_failure: {
        Args: { p_email: string }
        Returns: {
          attempts_left: number
          locked: boolean
          remaining_seconds: number
        }[]
      }
      renumber_scouts: { Args: never; Returns: undefined }
      requeue_notification: {
        Args: { p_channel: string; p_notification_id: string }
        Returns: undefined
      }
      respond_agendamento: {
        Args: {
          p_agendamento_id: string
          p_reason?: string
          p_response: string
        }
        Returns: {
          cargo_1: string
          cargo_2: string
          created_at: string
          data_secao: string
          destinatario_cargo_1: string
          destinatario_cargo_2: string
          destinatario_nome: string
          destinatario_secao: string
          dirigente: string
          email_de: string
          email_para: string
          horario: string
          id: string
          local: string
          nome_associado: string
          nome_evento: string
          observacoes: string
          ramo_escoteiro: string
          recipient_response: string
          recipient_response_at: string | null
          recipient_response_by: string | null
          recipient_response_reason: string | null
          secao: string
          status: string
          tipo_atividade: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "agendamentos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_users_for_scheduling: {
        Args: { p_query: string }
        Returns: {
          email: string
          name: string
          section: string
          user_id: string
        }[]
      }
    }
    Enums: {
      achievement_type:
        | "especialidade"
        | "insignia"
        | "distintivo"
        | "conquista"
        | "outro"
      agendamento_source: "agendamento" | "scheduling_request"
      app_role:
        | "admin"
        | "viewer"
        | "chefe"
        | "parent"
        | "dirigente"
        | "dirigente_gestor"
        | "voluntario"
        | "diretor_presidente"
        | "diretor_administrativo"
        | "diretor_financeiro"
        | "assistente"
      image_visibility: "private" | "group" | "public"
      notification_channel_status: "pending" | "sent" | "error" | "discarded"
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
      achievement_type: [
        "especialidade",
        "insignia",
        "distintivo",
        "conquista",
        "outro",
      ],
      agendamento_source: ["agendamento", "scheduling_request"],
      app_role: [
        "admin",
        "viewer",
        "chefe",
        "parent",
        "dirigente",
        "dirigente_gestor",
        "voluntario",
        "diretor_presidente",
        "diretor_administrativo",
        "diretor_financeiro",
        "assistente",
      ],
      image_visibility: ["private", "group", "public"],
      notification_channel_status: ["pending", "sent", "error", "discarded"],
    },
  },
} as const
