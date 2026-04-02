export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          timezone: string;
          currency: string;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          timezone?: string;
          currency?: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          timezone?: string;
          currency?: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          company_id: string | null;
          email: string | null;
          display_name: string | null;
          roles: string[];
          auth_methods: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          company_id?: string | null;
          email?: string | null;
          display_name?: string | null;
          roles?: string[];
          auth_methods?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string | null;
          email?: string | null;
          display_name?: string | null;
          roles?: string[];
          auth_methods?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
      departments: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          lead_user_id: string | null;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          lead_user_id?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          lead_user_id?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      roles: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          permissions: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          permissions?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          permissions?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      integrations: {
        Row: {
          id: string;
          company_id: string;
          provider: string;
          status: string;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          provider: string;
          status?: string;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          provider?: string;
          status?: string;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      unified_entities: {
        Row: {
          id: string;
          company_id: string;
          entity_type: string;
          payload: Json;
          source_references: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          entity_type: string;
          payload?: Json;
          source_references?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          entity_type?: string;
          payload?: Json;
          source_references?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      workflows: {
        Row: {
          id: string;
          company_id: string;
          definition: Json;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          definition?: Json;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          definition?: Json;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      workflow_runs: {
        Row: {
          id: string;
          workflow_id: string;
          status: string;
          logs: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workflow_id: string;
          status?: string;
          logs?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workflow_id?: string;
          status?: string;
          logs?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          company_id: string;
          source_provider: string;
          external_id: string | null;
          text_content: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          source_provider: string;
          external_id?: string | null;
          text_content?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          source_provider?: string;
          external_id?: string | null;
          text_content?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      kpis: {
        Row: {
          id: string;
          company_id: string;
          definition: Json;
          cached_value: Json | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          definition?: Json;
          cached_value?: Json | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          definition?: Json;
          cached_value?: Json | null;
          updated_at?: string;
        };
      };
      activity_logs: {
        Row: {
          id: string;
          company_id: string;
          event_type: string;
          actor_user_id: string | null;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          event_type: string;
          actor_user_id?: string | null;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          event_type?: string;
          actor_user_id?: string | null;
          payload?: Json;
          created_at?: string;
        };
      };
      ai_conversations: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          messages: Json;
          actions: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          messages?: Json;
          actions?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          user_id?: string;
          messages?: Json;
          actions?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      connectors: {
        Row: {
          id: string;
          company_id: string;
          provider_key: string;
          display_name: string | null;
          capabilities: Json;
          config: Json;
          config_hash: string | null;
          status: string;
          last_sync_at: string | null;
          sync_interval_minutes: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          provider_key: string;
          display_name?: string | null;
          capabilities?: Json;
          config?: Json;
          config_hash?: string | null;
          status?: string;
          last_sync_at?: string | null;
          sync_interval_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          provider_key?: string;
          display_name?: string | null;
          capabilities?: Json;
          config?: Json;
          config_hash?: string | null;
          status?: string;
          last_sync_at?: string | null;
          sync_interval_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      connector_credentials: {
        Row: {
          id: string;
          company_id: string;
          connector_id: string;
          encrypted_payload: string;
          metadata: Json;
          rotated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          connector_id: string;
          encrypted_payload: string;
          metadata?: Json;
          rotated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          connector_id?: string;
          encrypted_payload?: string;
          metadata?: Json;
          rotated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      connector_field_mappings: {
        Row: {
          id: string;
          company_id: string;
          connector_id: string;
          source_field: string;
          target_entity: string;
          target_field: string;
          data_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          connector_id: string;
          source_field: string;
          target_entity: string;
          target_field: string;
          data_type?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          connector_id?: string;
          source_field?: string;
          target_entity?: string;
          target_field?: string;
          data_type?: string;
          created_at?: string;
        };
      };
      connector_sync_runs: {
        Row: {
          id: string;
          company_id: string;
          connector_id: string;
          started_at: string;
          ended_at: string | null;
          status: string;
          result_summary: Json;
          idempotency_key: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          connector_id: string;
          started_at?: string;
          ended_at?: string | null;
          status?: string;
          result_summary?: Json;
          idempotency_key?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          connector_id?: string;
          started_at?: string;
          ended_at?: string | null;
          status?: string;
          result_summary?: Json;
          idempotency_key?: string | null;
          created_at?: string;
        };
      };
      connector_sync_log_entries: {
        Row: {
          id: string;
          sync_run_id: string;
          level: string;
          message: string;
          error_details: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sync_run_id: string;
          level?: string;
          message: string;
          error_details?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          sync_run_id?: string;
          level?: string;
          message?: string;
          error_details?: Json | null;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_company_id: { Args: Record<string, never>; Returns: string | null };
    };
    Enums: Record<string, never>;
  };
}
