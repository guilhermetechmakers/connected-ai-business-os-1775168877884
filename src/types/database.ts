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
          domain: string | null;
          industry: string | null;
          sso_settings: Json;
          password_policy: Json;
          allowed_auth_methods: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          timezone?: string;
          currency?: string;
          settings?: Json;
          domain?: string | null;
          industry?: string | null;
          sso_settings?: Json;
          password_policy?: Json;
          allowed_auth_methods?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          timezone?: string;
          currency?: string;
          settings?: Json;
          domain?: string | null;
          industry?: string | null;
          sso_settings?: Json;
          password_policy?: Json;
          allowed_auth_methods?: string[];
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
          avatar_url: string | null;
          roles: string[];
          auth_methods: string[];
          preferences: Json;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          company_id?: string | null;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          roles?: string[];
          auth_methods?: string[];
          preferences?: Json;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string | null;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          roles?: string[];
          auth_methods?: string[];
          preferences?: Json;
          status?: string;
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
          is_deleted: boolean;
          version: number;
          department_id: string | null;
          linked_entity_ids: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          entity_type: string;
          payload?: Json;
          source_references?: Json;
          is_deleted?: boolean;
          version?: number;
          department_id?: string | null;
          linked_entity_ids?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          entity_type?: string;
          payload?: Json;
          source_references?: Json;
          is_deleted?: boolean;
          version?: number;
          department_id?: string | null;
          linked_entity_ids?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
      unified_sources: {
        Row: {
          id: string;
          unified_entity_id: string;
          company_id: string;
          provider: string;
          external_id: string;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          unified_entity_id: string;
          company_id: string;
          provider: string;
          external_id: string;
          last_seen_at?: string;
        };
        Update: {
          id?: string;
          unified_entity_id?: string;
          company_id?: string;
          provider?: string;
          external_id?: string;
          last_seen_at?: string;
        };
      };
      entity_links: {
        Row: {
          id: string;
          company_id: string;
          left_entity_id: string;
          right_entity_id: string;
          relation_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          left_entity_id: string;
          right_entity_id: string;
          relation_type?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          left_entity_id?: string;
          right_entity_id?: string;
          relation_type?: string;
          created_at?: string;
        };
      };
      unified_entity_versions: {
        Row: {
          id: string;
          unified_entity_id: string;
          company_id: string;
          version: number;
          payload: Json;
          source_references: Json;
          actor_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          unified_entity_id: string;
          company_id: string;
          version: number;
          payload: Json;
          source_references?: Json;
          actor_user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          unified_entity_id?: string;
          company_id?: string;
          version?: number;
          payload?: Json;
          source_references?: Json;
          actor_user_id?: string | null;
          created_at?: string;
        };
      };
      report_templates: {
        Row: {
          id: string;
          company_id: string;
          department_id: string | null;
          name: string;
          definition: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          department_id?: string | null;
          name: string;
          definition?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          department_id?: string | null;
          name?: string;
          definition?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      report_schedules: {
        Row: {
          id: string;
          company_id: string;
          report_template_id: string;
          cron_expression: string | null;
          export_format: string;
          next_run_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          report_template_id: string;
          cron_expression?: string | null;
          export_format?: string;
          next_run_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          report_template_id?: string;
          cron_expression?: string | null;
          export_format?: string;
          next_run_at?: string | null;
          created_at?: string;
        };
      };
      workflows: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          owner_user_id: string | null;
          definition: Json;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name?: string;
          owner_user_id?: string | null;
          definition?: Json;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          owner_user_id?: string | null;
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
          started_at: string | null;
          finished_at: string | null;
          logs: Json;
          result_metadata: Json;
          test_mode: boolean;
          correlation_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workflow_id: string;
          status?: string;
          started_at?: string | null;
          finished_at?: string | null;
          logs?: Json;
          result_metadata?: Json;
          test_mode?: boolean;
          correlation_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workflow_id?: string;
          status?: string;
          started_at?: string | null;
          finished_at?: string | null;
          logs?: Json;
          result_metadata?: Json;
          test_mode?: boolean;
          correlation_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      workflow_approvals: {
        Row: {
          id: string;
          run_id: string;
          step_id: string | null;
          approver_user_id: string | null;
          decision: string;
          notes: string | null;
          created_at: string;
          decided_at: string | null;
        };
        Insert: {
          id?: string;
          run_id: string;
          step_id?: string | null;
          approver_user_id?: string | null;
          decision?: string;
          notes?: string | null;
          created_at?: string;
          decided_at?: string | null;
        };
        Update: {
          id?: string;
          run_id?: string;
          step_id?: string | null;
          approver_user_id?: string | null;
          decision?: string;
          notes?: string | null;
          created_at?: string;
          decided_at?: string | null;
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
          related_entity: string | null;
          related_id: string | null;
          department_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          event_type: string;
          actor_user_id?: string | null;
          payload?: Json;
          related_entity?: string | null;
          related_id?: string | null;
          department_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          event_type?: string;
          actor_user_id?: string | null;
          payload?: Json;
          related_entity?: string | null;
          related_id?: string | null;
          department_id?: string | null;
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
      invitations: {
        Row: {
          id: string;
          company_id: string;
          token: string;
          email: string;
          invited_by: string | null;
          expires_at: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          token: string;
          email: string;
          invited_by?: string | null;
          expires_at: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          token?: string;
          email?: string;
          invited_by?: string | null;
          expires_at?: string;
          status?: string;
          created_at?: string;
        };
      };
      external_accounts: {
        Row: {
          id: string;
          profile_id: string;
          company_id: string;
          provider: string;
          provider_user_id: string;
          linked_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          company_id: string;
          provider: string;
          provider_user_id: string;
          linked_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          company_id?: string;
          provider?: string;
          provider_user_id?: string;
          linked_at?: string;
        };
      };
      auth_login_attempts: {
        Row: {
          id: string;
          email_normalized: string;
          ip: string | null;
          attempted_at: string;
          success: boolean;
        };
        Insert: {
          id?: string;
          email_normalized: string;
          ip?: string | null;
          attempted_at?: string;
          success?: boolean;
        };
        Update: {
          id?: string;
          email_normalized?: string;
          ip?: string | null;
          attempted_at?: string;
          success?: boolean;
        };
      };
      auth_lockouts: {
        Row: {
          email_normalized: string;
          failed_count: number;
          locked_until: string | null;
          updated_at: string;
        };
        Insert: {
          email_normalized: string;
          failed_count?: number;
          locked_until?: string | null;
          updated_at?: string;
        };
        Update: {
          email_normalized?: string;
          failed_count?: number;
          locked_until?: string | null;
          updated_at?: string;
        };
      };
      password_reset_tokens: {
        Row: {
          token: string;
          user_id: string;
          company_id: string | null;
          expires_at: string;
          used: boolean;
          created_at: string;
        };
        Insert: {
          token: string;
          user_id: string;
          company_id?: string | null;
          expires_at: string;
          used?: boolean;
          created_at?: string;
        };
        Update: {
          token?: string;
          user_id?: string;
          company_id?: string | null;
          expires_at?: string;
          used?: boolean;
          created_at?: string;
        };
      };
      email_verification_tokens: {
        Row: {
          token: string;
          user_id: string;
          expires_at: string;
          used: boolean;
          created_at: string;
        };
        Insert: {
          token: string;
          user_id: string;
          expires_at: string;
          used?: boolean;
          created_at?: string;
        };
        Update: {
          token?: string;
          user_id?: string;
          expires_at?: string;
          used?: boolean;
          created_at?: string;
        };
      };
      user_api_keys: {
        Row: {
          id: string;
          profile_id: string;
          company_id: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          scopes: string[];
          created_at: string;
          last_used_at: string | null;
        };
        Insert: {
          id?: string;
          profile_id: string;
          company_id: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          scopes?: string[];
          created_at?: string;
          last_used_at?: string | null;
        };
        Update: {
          id?: string;
          profile_id?: string;
          company_id?: string;
          name?: string;
          key_prefix?: string;
          key_hash?: string;
          scopes?: string[];
          created_at?: string;
          last_used_at?: string | null;
        };
      };
      auth_security_events: {
        Row: {
          id: string;
          company_id: string | null;
          profile_id: string | null;
          event_type: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string | null;
          profile_id?: string | null;
          event_type: string;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string | null;
          profile_id?: string | null;
          event_type?: string;
          payload?: Json;
          created_at?: string;
        };
      };
    };
    Views: {
      v_dashboard_entity_rollups: {
        Row: {
          company_id: string;
          entity_type: string;
          active_count: number;
        };
      };
    };
    Functions: {
      current_company_id: { Args: Record<string, never>; Returns: string | null };
      search_unified_entities: {
        Args: {
          p_search: string;
          p_entity_type?: string | null;
          p_department_id?: string | null;
          p_limit?: number | null;
        };
        Returns: {
          id: string;
          company_id: string;
          entity_type: string;
          payload: Json;
          source_references: Json;
          is_deleted: boolean;
          version: number;
          department_id: string | null;
          linked_entity_ids: string[];
          created_at: string;
          updated_at: string;
        }[];
      };
      refresh_dashboard_kpis_mv: { Args: Record<string, never>; Returns: undefined };
    };
    Enums: Record<string, never>;
  };
}
