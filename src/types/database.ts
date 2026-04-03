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
          activity_log_retention_days: number;
          region: string;
          tenant_status: string;
          plan: string;
          billing_id: string | null;
          legal_name: string | null;
          display_name: string | null;
          country: string | null;
          onboarding_completed_at: string | null;
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
          activity_log_retention_days?: number;
          region?: string;
          tenant_status?: string;
          plan?: string;
          billing_id?: string | null;
          legal_name?: string | null;
          display_name?: string | null;
          country?: string | null;
          onboarding_completed_at?: string | null;
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
          activity_log_retention_days?: number;
          region?: string;
          tenant_status?: string;
          plan?: string;
          billing_id?: string | null;
          legal_name?: string | null;
          display_name?: string | null;
          country?: string | null;
          onboarding_completed_at?: string | null;
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
          job_title: string | null;
          department: string | null;
          contact_info: Json;
          totp_enabled: boolean;
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
          job_title?: string | null;
          department?: string | null;
          contact_info?: Json;
          totp_enabled?: boolean;
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
          job_title?: string | null;
          department?: string | null;
          contact_info?: Json;
          totp_enabled?: boolean;
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
          description: string;
          permissions: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          description?: string;
          permissions?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          description?: string;
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
          last_sync_at: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          provider: string;
          status?: string;
          config?: Json;
          last_sync_at?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          provider?: string;
          status?: string;
          config?: Json;
          last_sync_at?: string | null;
          error_message?: string | null;
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
          department_id: string | null;
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
          department_id?: string | null;
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
          department_id?: string | null;
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
          redacted_payload: Json;
          metadata: Json;
          related_entity: string | null;
          related_id: string | null;
          department_id: string | null;
          workflow_run_id: string | null;
          connector_id: string | null;
          integration_id: string | null;
          ai_action_id: string | null;
          ai_triggered: boolean;
          idempotency_key: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          event_type: string;
          actor_user_id?: string | null;
          payload?: Json;
          redacted_payload?: Json;
          metadata?: Json;
          related_entity?: string | null;
          related_id?: string | null;
          department_id?: string | null;
          workflow_run_id?: string | null;
          connector_id?: string | null;
          integration_id?: string | null;
          ai_action_id?: string | null;
          ai_triggered?: boolean;
          idempotency_key?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          event_type?: string;
          actor_user_id?: string | null;
          payload?: Json;
          redacted_payload?: Json;
          metadata?: Json;
          related_entity?: string | null;
          related_id?: string | null;
          department_id?: string | null;
          workflow_run_id?: string | null;
          connector_id?: string | null;
          integration_id?: string | null;
          ai_action_id?: string | null;
          ai_triggered?: boolean;
          idempotency_key?: string | null;
          created_at?: string;
        };
      };
      system_templates: {
        Row: {
          id: string;
          template_key: string;
          name: string;
          category: string;
          definition: Json;
          version: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          template_key: string;
          name: string;
          category?: string;
          definition?: Json;
          version?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          template_key?: string;
          name?: string;
          category?: string;
          definition?: Json;
          version?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      feature_flags: {
        Row: {
          id: string;
          flag_key: string;
          company_id: string | null;
          enabled: boolean;
          rollout: number;
          payload: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          flag_key: string;
          company_id?: string | null;
          enabled?: boolean;
          rollout?: number;
          payload?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          flag_key?: string;
          company_id?: string | null;
          enabled?: boolean;
          rollout?: number;
          payload?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      tenant_data_policies: {
        Row: {
          id: string;
          company_id: string;
          retention_period_days: number;
          export_allowed: boolean;
          purge_scheduled: boolean;
          audit_config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          retention_period_days?: number;
          export_allowed?: boolean;
          purge_scheduled?: boolean;
          audit_config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          retention_period_days?: number;
          export_allowed?: boolean;
          purge_scheduled?: boolean;
          audit_config?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      settings_audit_log: {
        Row: {
          id: string;
          company_id: string;
          actor_user_id: string | null;
          action: string;
          changes: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          actor_user_id?: string | null;
          action: string;
          changes?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          actor_user_id?: string | null;
          action?: string;
          changes?: Json;
          created_at?: string;
        };
      };
      profile_role_assignments: {
        Row: {
          profile_id: string;
          role_id: string;
          created_at: string;
        };
        Insert: {
          profile_id: string;
          role_id: string;
          created_at?: string;
        };
        Update: {
          profile_id?: string;
          role_id?: string;
          created_at?: string;
        };
      };
      builder_api_keys: {
        Row: {
          id: string;
          company_id: string;
          profile_id: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          scopes: string[];
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          profile_id: string;
          name?: string;
          key_prefix: string;
          key_hash: string;
          scopes?: string[];
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          profile_id?: string;
          name?: string;
          key_prefix?: string;
          key_hash?: string;
          scopes?: string[];
          expires_at?: string | null;
          created_at?: string;
        };
      };
      tenant_configs: {
        Row: {
          id: string;
          company_id: string;
          config_key: string;
          config_value: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          config_key: string;
          config_value?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          config_key?: string;
          config_value?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      onboarding_templates: {
        Row: {
          id: string;
          name: string;
          template_type: string;
          version: number;
          data: Json;
          is_active: boolean;
          tenant_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          template_type?: string;
          version?: number;
          data?: Json;
          is_active?: boolean;
          tenant_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          template_type?: string;
          version?: number;
          data?: Json;
          is_active?: boolean;
          tenant_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      email_templates: {
        Row: {
          id: string;
          company_id: string;
          template_key: string;
          subject: string;
          body: string;
          placeholders: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          template_key: string;
          subject: string;
          body: string;
          placeholders?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          template_key?: string;
          subject?: string;
          body?: string;
          placeholders?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      ai_conversations: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          messages: Json;
          actions: Json;
          mode: string;
          title: string | null;
          metadata: Json;
          department_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          messages?: Json;
          actions?: Json;
          mode?: string;
          title?: string | null;
          metadata?: Json;
          department_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          user_id?: string;
          messages?: Json;
          actions?: Json;
          mode?: string;
          title?: string | null;
          metadata?: Json;
          department_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          company_id: string;
          role: string;
          content: string;
          citations: Json;
          token_usage: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          company_id: string;
          role: string;
          content?: string;
          citations?: Json;
          token_usage?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          company_id?: string;
          role?: string;
          content?: string;
          citations?: Json;
          token_usage?: Json | null;
          created_at?: string;
        };
      };
      ai_prompt_templates: {
        Row: {
          id: string;
          company_id: string;
          department: string | null;
          purpose: string;
          name: string;
          template_text: string;
          slots: Json;
          is_active: boolean;
          workspace_mode: string;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          department?: string | null;
          purpose?: string;
          name: string;
          template_text: string;
          slots?: Json;
          is_active?: boolean;
          workspace_mode?: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          department?: string | null;
          purpose?: string;
          name?: string;
          template_text?: string;
          slots?: Json;
          is_active?: boolean;
          workspace_mode?: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      ai_action_logs: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          action_name: string;
          status: string;
          details: Json;
          conversation_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          action_name: string;
          status?: string;
          details?: Json;
          conversation_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          user_id?: string;
          action_name?: string;
          status?: string;
          details?: Json;
          conversation_id?: string | null;
          created_at?: string;
        };
      };
      ai_usage_telemetry: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          model: string;
          prompt_tokens: number | null;
          completion_tokens: number | null;
          latency_ms: number | null;
          conversation_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          model?: string;
          prompt_tokens?: number | null;
          completion_tokens?: number | null;
          latency_ms?: number | null;
          conversation_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          user_id?: string;
          model?: string;
          prompt_tokens?: number | null;
          completion_tokens?: number | null;
          latency_ms?: number | null;
          conversation_id?: string | null;
          created_at?: string;
        };
      };
      ai_context_chunks: {
        Row: {
          id: string;
          company_id: string;
          workspace_id: string;
          source_type: string;
          source_id: string | null;
          content: string;
          metadata: Json;
          embedding: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          workspace_id?: string;
          source_type: string;
          source_id?: string | null;
          content: string;
          metadata?: Json;
          embedding?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          workspace_id?: string;
          source_type?: string;
          source_id?: string | null;
          content?: string;
          metadata?: Json;
          embedding?: Json | null;
          created_at?: string;
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
          last_error_message: string | null;
          last_error_remediation: string | null;
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
          last_error_message?: string | null;
          last_error_remediation?: string | null;
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
          last_error_message?: string | null;
          last_error_remediation?: string | null;
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
          expires_at: string | null;
          status: string;
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
          expires_at?: string | null;
          status?: string;
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
          expires_at?: string | null;
          status?: string;
          created_at?: string;
          last_used_at?: string | null;
        };
      };
      avatar_assets: {
        Row: {
          id: string;
          profile_id: string;
          company_id: string;
          url: string;
          size_bytes: number;
          mime_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          company_id: string;
          url: string;
          size_bytes: number;
          mime_type: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          company_id?: string;
          url?: string;
          size_bytes?: number;
          mime_type?: string;
          created_at?: string;
        };
      };
      profile_totp_enrollment: {
        Row: {
          profile_id: string;
          secret_b32: string;
          created_at: string;
        };
        Insert: {
          profile_id: string;
          secret_b32: string;
          created_at?: string;
        };
        Update: {
          profile_id?: string;
          secret_b32?: string;
          created_at?: string;
        };
      };
      profile_totp_active: {
        Row: {
          profile_id: string;
          secret_b32: string;
          created_at: string;
        };
        Insert: {
          profile_id: string;
          secret_b32: string;
          created_at?: string;
        };
        Update: {
          profile_id?: string;
          secret_b32?: string;
          created_at?: string;
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
      alert_rules: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          trigger_type: string;
          conditions: Json;
          actions: Json;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          trigger_type: string;
          conditions?: Json;
          actions?: Json;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          trigger_type?: string;
          conditions?: Json;
          actions?: Json;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          notification_type: string;
          title: string;
          message: string;
          data: Json;
          read_at: string | null;
          created_at: string;
          channel: string;
          status: string;
          related_item_id: string | null;
          alert_rule_id: string | null;
          priority: number;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          notification_type: string;
          title: string;
          message: string;
          data?: Json;
          read_at?: string | null;
          created_at?: string;
          channel: string;
          status?: string;
          related_item_id?: string | null;
          alert_rule_id?: string | null;
          priority?: number;
        };
        Update: {
          id?: string;
          company_id?: string;
          user_id?: string;
          notification_type?: string;
          title?: string;
          message?: string;
          data?: Json;
          read_at?: string | null;
          created_at?: string;
          channel?: string;
          status?: string;
          related_item_id?: string | null;
          alert_rule_id?: string | null;
          priority?: number;
        };
      };
      notification_preferences: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          channels: string[];
          preferences: Json;
          quiet_hours: Json | null;
          data_retention_days: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          channels?: string[];
          preferences?: Json;
          quiet_hours?: Json | null;
          data_retention_days?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          user_id?: string;
          channels?: string[];
          preferences?: Json;
          quiet_hours?: Json | null;
          data_retention_days?: number;
          updated_at?: string;
        };
      };
      notification_schedules: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          cron_expression: string;
          next_run_at: string | null;
          payload_template: Json;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          cron_expression: string;
          next_run_at?: string | null;
          payload_template?: Json;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          cron_expression?: string;
          next_run_at?: string | null;
          payload_template?: Json;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      notification_channel_settings: {
        Row: {
          company_id: string;
          sendgrid_from_email: string | null;
          sendgrid_reply_to: string | null;
          fcm_sender_id: string | null;
          webhook_delivery_url: string | null;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          sendgrid_from_email?: string | null;
          sendgrid_reply_to?: string | null;
          fcm_sender_id?: string | null;
          webhook_delivery_url?: string | null;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          sendgrid_from_email?: string | null;
          sendgrid_reply_to?: string | null;
          fcm_sender_id?: string | null;
          webhook_delivery_url?: string | null;
          updated_at?: string;
        };
      };
      notification_provider_credentials: {
        Row: {
          id: string;
          company_id: string;
          provider: string;
          encrypted_payload: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          provider: string;
          encrypted_payload: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          provider?: string;
          encrypted_payload?: string;
          updated_at?: string;
        };
      };
      indexed_documents: {
        Row: {
          id: string;
          company_id: string;
          source_provider: string;
          external_id: string;
          title: string;
          full_text: string | null;
          snippet: string | null;
          embedding: Json | null;
          indexed_at: string;
          metadata: Json;
          permissions: Json;
          department_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          source_provider: string;
          external_id?: string;
          title?: string;
          full_text?: string | null;
          snippet?: string | null;
          embedding?: Json | null;
          indexed_at?: string;
          metadata?: Json;
          permissions?: Json;
          department_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          source_provider?: string;
          external_id?: string;
          title?: string;
          full_text?: string | null;
          snippet?: string | null;
          embedding?: Json | null;
          indexed_at?: string;
          metadata?: Json;
          permissions?: Json;
          department_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      search_index_jobs: {
        Row: {
          id: string;
          company_id: string;
          status: string;
          provider: string | null;
          message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          status?: string;
          provider?: string | null;
          message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          status?: string;
          provider?: string | null;
          message?: string | null;
          created_at?: string;
        };
      };
      ai_search_summary_logs: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          context_items: Json;
          summary: string;
          confidence: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          context_items?: Json;
          summary?: string;
          confidence?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          user_id?: string;
          context_items?: Json;
          summary?: string;
          confidence?: number | null;
          created_at?: string;
        };
      };
      saved_searches: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          name: string;
          query: string;
          filters: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          name: string;
          query?: string;
          filters?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          user_id?: string;
          name?: string;
          query?: string;
          filters?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      module_templates: {
        Row: {
          id: string;
          company_id: string | null;
          slug: string;
          name: string;
          description: string | null;
          preview_ui: string;
          default_ui_entry: string;
          bindings_template: Json;
          dependencies: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string | null;
          slug?: string;
          name: string;
          description?: string | null;
          preview_ui?: string;
          default_ui_entry?: string;
          bindings_template?: Json;
          dependencies?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string | null;
          slug?: string;
          name?: string;
          description?: string | null;
          preview_ui?: string;
          default_ui_entry?: string;
          bindings_template?: Json;
          dependencies?: Json;
          created_at?: string;
        };
      };
      internal_modules: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          description: string;
          ui_entry: string;
          status: string;
          tenant_scope: Json;
          tags: string[];
          data_bindings: Json;
          permissions: Json;
          health_status: string;
          last_deployed_at: string | null;
          marketplace_template_id: string | null;
          installed_from_template: boolean;
          active_version_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          description?: string;
          ui_entry?: string;
          status?: string;
          tenant_scope?: Json;
          tags?: string[];
          data_bindings?: Json;
          permissions?: Json;
          health_status?: string;
          last_deployed_at?: string | null;
          marketplace_template_id?: string | null;
          installed_from_template?: boolean;
          active_version_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          description?: string;
          ui_entry?: string;
          status?: string;
          tenant_scope?: Json;
          tags?: string[];
          data_bindings?: Json;
          permissions?: Json;
          health_status?: string;
          last_deployed_at?: string | null;
          marketplace_template_id?: string | null;
          installed_from_template?: boolean;
          active_version_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      module_versions: {
        Row: {
          id: string;
          module_id: string;
          version_tag: string;
          changelog: string;
          is_active: boolean;
          migration_notes: string | null;
          binding_diff: Json;
          snapshot: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          module_id: string;
          version_tag: string;
          changelog?: string;
          is_active?: boolean;
          migration_notes?: string | null;
          binding_diff?: Json;
          snapshot?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          module_id?: string;
          version_tag?: string;
          changelog?: string;
          is_active?: boolean;
          migration_notes?: string | null;
          binding_diff?: Json;
          snapshot?: Json;
          created_at?: string;
        };
      };
      module_department_access: {
        Row: {
          id: string;
          module_id: string;
          department_id: string;
          access_level: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          module_id: string;
          department_id: string;
          access_level?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          module_id?: string;
          department_id?: string;
          access_level?: string;
          created_at?: string;
        };
      };
      dashboard_widget_definitions: {
        Row: {
          id: string;
          company_id: string | null;
          name: string;
          type: string;
          default_config: Json;
          visibility_rules: Json;
          data_adapter_key: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string | null;
          name: string;
          type: string;
          default_config?: Json;
          visibility_rules?: Json;
          data_adapter_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string | null;
          name?: string;
          type?: string;
          default_config?: Json;
          visibility_rules?: Json;
          data_adapter_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      dashboard_layouts: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          name: string;
          dashboard_kind: string;
          layout_json: Json;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          name?: string;
          dashboard_kind: string;
          layout_json?: Json;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          user_id?: string;
          name?: string;
          dashboard_kind?: string;
          layout_json?: Json;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      dashboard_widget_instances: {
        Row: {
          id: string;
          layout_id: string;
          widget_definition_id: string | null;
          widget_type: string;
          config: Json;
          is_visible: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          layout_id: string;
          widget_definition_id?: string | null;
          widget_type: string;
          config?: Json;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          layout_id?: string;
          widget_definition_id?: string | null;
          widget_type?: string;
          config?: Json;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      dashboard_export_schedules: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          layout_id: string | null;
          target_type: string;
          target_value: string;
          cron_expression: string;
          last_run_at: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          layout_id?: string | null;
          target_type: string;
          target_value: string;
          cron_expression?: string;
          last_run_at?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          user_id?: string;
          layout_id?: string | null;
          target_type?: string;
          target_value?: string;
          cron_expression?: string;
          last_run_at?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      dashboard_audit_events: {
        Row: {
          id: string;
          company_id: string;
          actor_user_id: string | null;
          event_type: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          actor_user_id?: string | null;
          event_type: string;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          actor_user_id?: string | null;
          event_type?: string;
          payload?: Json;
          created_at?: string;
        };
      };
      marketing_pricing_tiers: {
        Row: {
          id: string;
          slug: string | null;
          name: string;
          display_price: string;
          period: string;
          features: string[];
          cta_label: string;
          cta_href: string | null;
          is_highlighted: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug?: string | null;
          name: string;
          display_price: string;
          period?: string;
          features?: string[];
          cta_label?: string;
          cta_href?: string | null;
          is_highlighted?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string | null;
          name?: string;
          display_price?: string;
          period?: string;
          features?: string[];
          cta_label?: string;
          cta_href?: string | null;
          is_highlighted?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      marketing_feature_highlights: {
        Row: {
          id: string;
          icon_key: string;
          title: string;
          description: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          icon_key?: string;
          title: string;
          description: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          icon_key?: string;
          title?: string;
          description?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      marketing_testimonials: {
        Row: {
          id: string;
          logo_url: string | null;
          quote: string;
          author: string;
          role: string;
          company_key: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          logo_url?: string | null;
          quote: string;
          author: string;
          role: string;
          company_key?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          logo_url?: string | null;
          quote?: string;
          author?: string;
          role?: string;
          company_key?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
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
