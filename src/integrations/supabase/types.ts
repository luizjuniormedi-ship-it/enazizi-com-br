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
      adaptive_experiment_efficacy: {
        Row: {
          avg_improvement_score: number | null
          experiment_id: string | null
          friction_reduction_score: number | null
          id: string
          retention_lift: number | null
          sample_size: number | null
          updated_at: string | null
          variant_id: string
        }
        Insert: {
          avg_improvement_score?: number | null
          experiment_id?: string | null
          friction_reduction_score?: number | null
          id?: string
          retention_lift?: number | null
          sample_size?: number | null
          updated_at?: string | null
          variant_id: string
        }
        Update: {
          avg_improvement_score?: number | null
          experiment_id?: string | null
          friction_reduction_score?: number | null
          id?: string
          retention_lift?: number | null
          sample_size?: number | null
          updated_at?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adaptive_experiment_efficacy_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "adaptive_experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      adaptive_experiments: {
        Row: {
          created_at: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string | null
          target_metric: string
          variants: Json
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string | null
          target_metric: string
          variants: Json
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string | null
          target_metric?: string
          variants?: Json
        }
        Relationships: []
      }
      adaptive_governance_logs: {
        Row: {
          action_type: string
          created_at: string | null
          id: string
          metadata: Json | null
          policy_id: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          policy_id?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          policy_id?: string | null
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adaptive_governance_logs_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "intervention_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      adaptive_interventions: {
        Row: {
          action_payload: Json | null
          action_taken: string
          cognitive_insight: string | null
          confidence_score: number | null
          context_node_id: string | null
          created_at: string | null
          effectiveness_score: number | null
          estimated_time_min: number | null
          evidence_score: number | null
          experiment_id: string | null
          experiment_variant_id: string | null
          explanation: string | null
          friction_score_snapshot: number | null
          historical_effectiveness_snapshot: number | null
          id: string
          impact_summary: string | null
          metadata: Json | null
          outcome_metrics: Json | null
          policy_id: string | null
          post_intervention_outcome: string | null
          recommendation_text: string | null
          resolved_at: string | null
          severity: string | null
          status: string | null
          trigger_count: number | null
          trigger_type: string
          user_id: string | null
          video_lesson_id: string | null
        }
        Insert: {
          action_payload?: Json | null
          action_taken: string
          cognitive_insight?: string | null
          confidence_score?: number | null
          context_node_id?: string | null
          created_at?: string | null
          effectiveness_score?: number | null
          estimated_time_min?: number | null
          evidence_score?: number | null
          experiment_id?: string | null
          experiment_variant_id?: string | null
          explanation?: string | null
          friction_score_snapshot?: number | null
          historical_effectiveness_snapshot?: number | null
          id?: string
          impact_summary?: string | null
          metadata?: Json | null
          outcome_metrics?: Json | null
          policy_id?: string | null
          post_intervention_outcome?: string | null
          recommendation_text?: string | null
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
          trigger_count?: number | null
          trigger_type: string
          user_id?: string | null
          video_lesson_id?: string | null
        }
        Update: {
          action_payload?: Json | null
          action_taken?: string
          cognitive_insight?: string | null
          confidence_score?: number | null
          context_node_id?: string | null
          created_at?: string | null
          effectiveness_score?: number | null
          estimated_time_min?: number | null
          evidence_score?: number | null
          experiment_id?: string | null
          experiment_variant_id?: string | null
          explanation?: string | null
          friction_score_snapshot?: number | null
          historical_effectiveness_snapshot?: number | null
          id?: string
          impact_summary?: string | null
          metadata?: Json | null
          outcome_metrics?: Json | null
          policy_id?: string | null
          post_intervention_outcome?: string | null
          recommendation_text?: string | null
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
          trigger_count?: number | null
          trigger_type?: string
          user_id?: string | null
          video_lesson_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adaptive_interventions_context_node_id_fkey"
            columns: ["context_node_id"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adaptive_interventions_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "adaptive_experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adaptive_interventions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "intervention_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adaptive_interventions_video_lesson_id_fkey"
            columns: ["video_lesson_id"]
            isOneToOne: false
            referencedRelation: "ai_video_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      adaptive_path_logs: {
        Row: {
          adjustment_type: string
          created_at: string | null
          id: string
          metadata: Json | null
          new_path_node_id: string | null
          original_path_node_id: string | null
          trigger_reason: string
          user_id: string
        }
        Insert: {
          adjustment_type: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_path_node_id?: string | null
          original_path_node_id?: string | null
          trigger_reason: string
          user_id: string
        }
        Update: {
          adjustment_type?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_path_node_id?: string | null
          original_path_node_id?: string | null
          trigger_reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adaptive_path_logs_new_path_node_id_fkey"
            columns: ["new_path_node_id"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adaptive_path_logs_original_path_node_id_fkey"
            columns: ["original_path_node_id"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      adaptive_schedule_adjustments: {
        Row: {
          cognitive_state: Json | null
          created_at: string | null
          id: string
          new_schedule: Json | null
          previous_schedule: Json | null
          projected_gain: number | null
          reason: string | null
          trigger_type: string | null
          user_id: string
        }
        Insert: {
          cognitive_state?: Json | null
          created_at?: string | null
          id?: string
          new_schedule?: Json | null
          previous_schedule?: Json | null
          projected_gain?: number | null
          reason?: string | null
          trigger_type?: string | null
          user_id: string
        }
        Update: {
          cognitive_state?: Json | null
          created_at?: string | null
          id?: string
          new_schedule?: Json | null
          previous_schedule?: Json | null
          projected_gain?: number | null
          reason?: string | null
          trigger_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      adaptive_schedule_profiles: {
        Row: {
          circadian_profile: string | null
          cognitive_resilience_score: number | null
          created_at: string | null
          drift_sensitivity: number | null
          fatigue_threshold: number | null
          id: string
          last_recalculated_at: string | null
          modality_preferences: Json | null
          optimal_study_windows: Json | null
          preferred_session_duration: number | null
          recovery_efficiency: number | null
          user_id: string
        }
        Insert: {
          circadian_profile?: string | null
          cognitive_resilience_score?: number | null
          created_at?: string | null
          drift_sensitivity?: number | null
          fatigue_threshold?: number | null
          id?: string
          last_recalculated_at?: string | null
          modality_preferences?: Json | null
          optimal_study_windows?: Json | null
          preferred_session_duration?: number | null
          recovery_efficiency?: number | null
          user_id: string
        }
        Update: {
          circadian_profile?: string | null
          cognitive_resilience_score?: number | null
          created_at?: string | null
          drift_sensitivity?: number | null
          fatigue_threshold?: number | null
          id?: string
          last_recalculated_at?: string | null
          modality_preferences?: Json | null
          optimal_study_windows?: Json | null
          preferred_session_duration?: number | null
          recovery_efficiency?: number | null
          user_id?: string
        }
        Relationships: []
      }
      adaptive_schedule_simulations: {
        Row: {
          created_at: string | null
          estimated_mastery_gain: number | null
          id: string
          predicted_drift: number | null
          predicted_fatigue: number | null
          predicted_overload: number | null
          predicted_retention: number | null
          recommended_sequence: Json | null
          simulation_confidence: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          estimated_mastery_gain?: number | null
          id?: string
          predicted_drift?: number | null
          predicted_fatigue?: number | null
          predicted_overload?: number | null
          predicted_retention?: number | null
          recommended_sequence?: Json | null
          simulation_confidence?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          estimated_mastery_gain?: number | null
          id?: string
          predicted_drift?: number | null
          predicted_fatigue?: number | null
          predicted_overload?: number | null
          predicted_retention?: number | null
          recommended_sequence?: Json | null
          simulation_confidence?: number | null
          user_id?: string
        }
        Relationships: []
      }
      adaptive_session_logs: {
        Row: {
          cognitive_snapshot: Json | null
          created_at: string | null
          id: string
          new_mode: string | null
          prev_mode: string | null
          session_id: string
          trigger_reason: string | null
          user_id: string
        }
        Insert: {
          cognitive_snapshot?: Json | null
          created_at?: string | null
          id?: string
          new_mode?: string | null
          prev_mode?: string | null
          session_id: string
          trigger_reason?: string | null
          user_id: string
        }
        Update: {
          cognitive_snapshot?: Json | null
          created_at?: string | null
          id?: string
          new_mode?: string | null
          prev_mode?: string | null
          session_id?: string
          trigger_reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      adaptive_student_profiles: {
        Row: {
          circadian_intelligence_active: boolean | null
          cme_preferences: Json | null
          cognitive_load_estimate: number | null
          cognitive_stress_index: number | null
          current_session_mode: string | null
          drift_score: number | null
          fatigue_index: number | null
          id: string
          intervention_frequency_score: number | null
          last_intervention_at: string | null
          last_policy_violation_at: string | null
          last_recovery_at: string | null
          longitudinal_patterns: Json | null
          mastery_map: Json | null
          multimodal_preference_score: Json | null
          orchestration_intensity: string | null
          overall_friction_score: number | null
          preferred_modality: string | null
          recovery_mode_active: boolean | null
          response_speed_index: number | null
          transparency_enabled: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          circadian_intelligence_active?: boolean | null
          cme_preferences?: Json | null
          cognitive_load_estimate?: number | null
          cognitive_stress_index?: number | null
          current_session_mode?: string | null
          drift_score?: number | null
          fatigue_index?: number | null
          id?: string
          intervention_frequency_score?: number | null
          last_intervention_at?: string | null
          last_policy_violation_at?: string | null
          last_recovery_at?: string | null
          longitudinal_patterns?: Json | null
          mastery_map?: Json | null
          multimodal_preference_score?: Json | null
          orchestration_intensity?: string | null
          overall_friction_score?: number | null
          preferred_modality?: string | null
          recovery_mode_active?: boolean | null
          response_speed_index?: number | null
          transparency_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          circadian_intelligence_active?: boolean | null
          cme_preferences?: Json | null
          cognitive_load_estimate?: number | null
          cognitive_stress_index?: number | null
          current_session_mode?: string | null
          drift_score?: number | null
          fatigue_index?: number | null
          id?: string
          intervention_frequency_score?: number | null
          last_intervention_at?: string | null
          last_policy_violation_at?: string | null
          last_recovery_at?: string | null
          longitudinal_patterns?: Json | null
          mastery_map?: Json | null
          multimodal_preference_score?: Json | null
          orchestration_intensity?: string | null
          overall_friction_score?: number | null
          preferred_modality?: string | null
          recovery_mode_active?: boolean | null
          response_speed_index?: number | null
          transparency_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      admin_alert_schedules: {
        Row: {
          admin_id: string | null
          created_at: string | null
          filters: Json | null
          frequency: string
          id: string
          is_active: boolean | null
          last_run_at: string | null
          notification_channels: string[] | null
        }
        Insert: {
          admin_id?: string | null
          created_at?: string | null
          filters?: Json | null
          frequency: string
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          notification_channels?: string[] | null
        }
        Update: {
          admin_id?: string | null
          created_at?: string | null
          filters?: Json | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          notification_channels?: string[] | null
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_incidents: {
        Row: {
          affected_users_count: number | null
          category: string
          created_at: string | null
          description: string | null
          edge_function: string | null
          id: string
          impact_score: number | null
          initial_event_id: string | null
          last_occurrence_at: string | null
          metrics_snapshot: Json | null
          occurrence_count: number | null
          priority: string | null
          rca_diagnosis: Json | null
          resolution_notes: string | null
          route: string | null
          severity: string
          status: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          affected_users_count?: number | null
          category: string
          created_at?: string | null
          description?: string | null
          edge_function?: string | null
          id?: string
          impact_score?: number | null
          initial_event_id?: string | null
          last_occurrence_at?: string | null
          metrics_snapshot?: Json | null
          occurrence_count?: number | null
          priority?: string | null
          rca_diagnosis?: Json | null
          resolution_notes?: string | null
          route?: string | null
          severity: string
          status?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          affected_users_count?: number | null
          category?: string
          created_at?: string | null
          description?: string | null
          edge_function?: string | null
          id?: string
          impact_score?: number | null
          initial_event_id?: string | null
          last_occurrence_at?: string | null
          metrics_snapshot?: Json | null
          occurrence_count?: number | null
          priority?: string | null
          rca_diagnosis?: Json | null
          resolution_notes?: string | null
          route?: string | null
          severity?: string
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_incidents_initial_event_id_fkey"
            columns: ["initial_event_id"]
            isOneToOne: false
            referencedRelation: "telemetry_events"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_message_reads: {
        Row: {
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "admin_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          priority: string
          recipient_id: string | null
          sender_id: string
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          priority?: string
          recipient_id?: string | null
          sender_id: string
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          priority?: string
          recipient_id?: string | null
          sender_id?: string
          title?: string
        }
        Relationships: []
      }
      ai_cache: {
        Row: {
          cost_saved: number | null
          created_at: string | null
          expires_at: string | null
          id: string
          metadata: Json | null
          model: string | null
          prompt_hash: string
          prompt_text: string | null
          provider: string | null
          response_text: string | null
          tokens_used: number | null
        }
        Insert: {
          cost_saved?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          model?: string | null
          prompt_hash: string
          prompt_text?: string | null
          provider?: string | null
          response_text?: string | null
          tokens_used?: number | null
        }
        Update: {
          cost_saved?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          model?: string | null
          prompt_hash?: string
          prompt_text?: string | null
          provider?: string | null
          response_text?: string | null
          tokens_used?: number | null
        }
        Relationships: []
      }
      ai_content_audit_logs: {
        Row: {
          action: string
          content_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          new_status: string | null
          previous_status: string | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          content_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          new_status?: string | null
          previous_status?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          content_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          new_status?: string | null
          previous_status?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_content_audit_logs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "master_content_library"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_content_cache: {
        Row: {
          banca: string | null
          cache_key: string
          content_json: Json
          content_type: string
          created_at: string
          difficulty: number | null
          expires_at: string | null
          hit_count: number
          id: string
          model_used: string | null
          module: string | null
          normalized_prompt_hash: string | null
          quality_score: number | null
          scope: string
          semantic_hash: string | null
          specialty: string | null
          subtopic: string | null
          topic: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          banca?: string | null
          cache_key: string
          content_json: Json
          content_type?: string
          created_at?: string
          difficulty?: number | null
          expires_at?: string | null
          hit_count?: number
          id?: string
          model_used?: string | null
          module?: string | null
          normalized_prompt_hash?: string | null
          quality_score?: number | null
          scope?: string
          semantic_hash?: string | null
          specialty?: string | null
          subtopic?: string | null
          topic?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          banca?: string | null
          cache_key?: string
          content_json?: Json
          content_type?: string
          created_at?: string
          difficulty?: number | null
          expires_at?: string | null
          hit_count?: number
          id?: string
          model_used?: string | null
          module?: string | null
          normalized_prompt_hash?: string | null
          quality_score?: number | null
          scope?: string
          semantic_hash?: string | null
          specialty?: string | null
          subtopic?: string | null
          topic?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_enterprise_usage_logs: {
        Row: {
          actor_key: string | null
          actor_type: string
          cache_hit: boolean | null
          cost_estimate: number | null
          created_at: string
          error_message: string | null
          function_name: string
          id: string
          model_tier: string | null
          model_used: string | null
          response_time_ms: number | null
          success: boolean
          tokens_used: number | null
          user_id: string | null
        }
        Insert: {
          actor_key?: string | null
          actor_type?: string
          cache_hit?: boolean | null
          cost_estimate?: number | null
          created_at?: string
          error_message?: string | null
          function_name: string
          id?: string
          model_tier?: string | null
          model_used?: string | null
          response_time_ms?: number | null
          success?: boolean
          tokens_used?: number | null
          user_id?: string | null
        }
        Update: {
          actor_key?: string | null
          actor_type?: string
          cache_hit?: boolean | null
          cost_estimate?: number | null
          created_at?: string
          error_message?: string | null
          function_name?: string
          id?: string
          model_tier?: string | null
          model_used?: string | null
          response_time_ms?: number | null
          success?: boolean
          tokens_used?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_export_logs: {
        Row: {
          content_id: string | null
          created_at: string | null
          destination: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          content_id?: string | null
          created_at?: string | null
          destination?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          content_id?: string | null
          created_at?: string | null
          destination?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_export_logs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "master_content_library"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generated_assets: {
        Row: {
          asset_type: string
          banca: string | null
          content_json: Json
          created_at: string
          difficulty: number | null
          id: string
          module: string
          quality_score: number | null
          review_status: string | null
          source_generation_mode: string | null
          specialty: string | null
          subtopic: string | null
          topic: string | null
          updated_at: string
        }
        Insert: {
          asset_type?: string
          banca?: string | null
          content_json?: Json
          created_at?: string
          difficulty?: number | null
          id?: string
          module: string
          quality_score?: number | null
          review_status?: string | null
          source_generation_mode?: string | null
          specialty?: string | null
          subtopic?: string | null
          topic?: string | null
          updated_at?: string
        }
        Update: {
          asset_type?: string
          banca?: string | null
          content_json?: Json
          created_at?: string
          difficulty?: number | null
          id?: string
          module?: string
          quality_score?: number | null
          review_status?: string | null
          source_generation_mode?: string | null
          specialty?: string | null
          subtopic?: string | null
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_generation_queue: {
        Row: {
          completed_at: string | null
          content_id: string | null
          created_at: string
          error_message: string | null
          id: string
          started_at: string | null
          status: string | null
          task_type: Database["public"]["Enums"]["ai_content_type"]
        }
        Insert: {
          completed_at?: string | null
          content_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
          task_type: Database["public"]["Enums"]["ai_content_type"]
        }
        Update: {
          completed_at?: string | null
          content_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
          task_type?: Database["public"]["Enums"]["ai_content_type"]
        }
        Relationships: [
          {
            foreignKeyName: "ai_generation_queue_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "master_content_library"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_operational_alerts: {
        Row: {
          alert_type: string
          content_id: string | null
          created_at: string | null
          id: string
          is_resolved: boolean | null
          message: string
          metadata: Json | null
          resolved_at: string | null
          severity: string
        }
        Insert: {
          alert_type: string
          content_id?: string | null
          created_at?: string | null
          id?: string
          is_resolved?: boolean | null
          message: string
          metadata?: Json | null
          resolved_at?: string | null
          severity?: string
        }
        Update: {
          alert_type?: string
          content_id?: string | null
          created_at?: string | null
          id?: string
          is_resolved?: boolean | null
          message?: string
          metadata?: Json | null
          resolved_at?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_operational_alerts_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "master_content_library"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_routing_decisions: {
        Row: {
          chosen_model: string | null
          chosen_strategy: string | null
          complexity_score: number | null
          created_at: string
          id: string
          latency_ms: number | null
          module: string
          sent_to_queue: boolean | null
          task_type: string | null
          used_cache: boolean | null
          user_id: string
        }
        Insert: {
          chosen_model?: string | null
          chosen_strategy?: string | null
          complexity_score?: number | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          module: string
          sent_to_queue?: boolean | null
          task_type?: string | null
          used_cache?: boolean | null
          user_id: string
        }
        Update: {
          chosen_model?: string | null
          chosen_strategy?: string | null
          complexity_score?: number | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          module?: string
          sent_to_queue?: boolean | null
          task_type?: string | null
          used_cache?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_control: {
        Row: {
          ai_calls_limit: number
          ai_calls_used: number
          created_at: string
          id: string
          period_start: string
          plan_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_calls_limit?: number
          ai_calls_used?: number
          created_at?: string
          id?: string
          period_start?: string
          plan_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_calls_limit?: number
          ai_calls_used?: number
          created_at?: string
          id?: string
          period_start?: string
          plan_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          actor_key: string | null
          actor_type: string | null
          cache_hit: boolean | null
          cache_status: string | null
          content_id: string | null
          cost_estimate: number | null
          cost_saved: number
          created_at: string | null
          error_code: string | null
          error_message: string | null
          estimated_cost: number | null
          function_name: string | null
          id: string
          input_tokens: number | null
          json_validation_status: string | null
          latency_ms: number | null
          model: string
          model_tier: string | null
          model_used: string | null
          module: string | null
          output_tokens: number | null
          prompt_type: string | null
          request_id: string | null
          response_time_ms: number | null
          reused_from_cache: boolean | null
          success: boolean | null
          tenant_id: string | null
          tokens_saved: number
          tokens_used: number | null
          user_id: string | null
        }
        Insert: {
          actor_key?: string | null
          actor_type?: string | null
          cache_hit?: boolean | null
          cache_status?: string | null
          content_id?: string | null
          cost_estimate?: number | null
          cost_saved?: number
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          estimated_cost?: number | null
          function_name?: string | null
          id?: string
          input_tokens?: number | null
          json_validation_status?: string | null
          latency_ms?: number | null
          model: string
          model_tier?: string | null
          model_used?: string | null
          module?: string | null
          output_tokens?: number | null
          prompt_type?: string | null
          request_id?: string | null
          response_time_ms?: number | null
          reused_from_cache?: boolean | null
          success?: boolean | null
          tenant_id?: string | null
          tokens_saved?: number
          tokens_used?: number | null
          user_id?: string | null
        }
        Update: {
          actor_key?: string | null
          actor_type?: string | null
          cache_hit?: boolean | null
          cache_status?: string | null
          content_id?: string | null
          cost_estimate?: number | null
          cost_saved?: number
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          estimated_cost?: number | null
          function_name?: string | null
          id?: string
          input_tokens?: number | null
          json_validation_status?: string | null
          latency_ms?: number | null
          model?: string
          model_tier?: string | null
          model_used?: string | null
          module?: string | null
          output_tokens?: number | null
          prompt_type?: string | null
          request_id?: string | null
          response_time_ms?: number | null
          reused_from_cache?: boolean | null
          success?: boolean | null
          tenant_id?: string | null
          tokens_saved?: number
          tokens_used?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "master_content_library"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_video_lessons: {
        Row: {
          active_incident_count: number | null
          audio_url: string | null
          cdn_provider: string | null
          cinematic_intro_url: string | null
          cinematic_outro_url: string | null
          cme_project_id: string | null
          created_at: string
          created_by: string | null
          current_variant: string | null
          description: string | null
          difficulty_level: string | null
          duration_seconds: number | null
          health_score: number | null
          hls_url: string | null
          id: string
          is_gold_content: boolean | null
          last_test_passed: boolean | null
          last_validation_at: string | null
          learning_objectives: string[] | null
          media_status: string | null
          narrative_clarity_score: number | null
          notebooklm_export_text: string | null
          notebooklm_notebook_url: string | null
          notebooklm_video_url: string | null
          pipeline_last_error: string | null
          playback_url: string | null
          preview_url: string | null
          published_at: string | null
          reviewed_by: string | null
          specialty: string
          status: string
          subtopic: string | null
          thumbnail_url: string | null
          title: string
          topic: string
          tutor_context_snapshot_id: string | null
          tutor_lesson_id: string | null
          tutor_lesson_summary: string | null
          tutor_session_id: string | null
          updated_at: string
          video_url: string | null
          visibility: string
          visual_fatigue_score: number | null
        }
        Insert: {
          active_incident_count?: number | null
          audio_url?: string | null
          cdn_provider?: string | null
          cinematic_intro_url?: string | null
          cinematic_outro_url?: string | null
          cme_project_id?: string | null
          created_at?: string
          created_by?: string | null
          current_variant?: string | null
          description?: string | null
          difficulty_level?: string | null
          duration_seconds?: number | null
          health_score?: number | null
          hls_url?: string | null
          id?: string
          is_gold_content?: boolean | null
          last_test_passed?: boolean | null
          last_validation_at?: string | null
          learning_objectives?: string[] | null
          media_status?: string | null
          narrative_clarity_score?: number | null
          notebooklm_export_text?: string | null
          notebooklm_notebook_url?: string | null
          notebooklm_video_url?: string | null
          pipeline_last_error?: string | null
          playback_url?: string | null
          preview_url?: string | null
          published_at?: string | null
          reviewed_by?: string | null
          specialty: string
          status?: string
          subtopic?: string | null
          thumbnail_url?: string | null
          title: string
          topic: string
          tutor_context_snapshot_id?: string | null
          tutor_lesson_id?: string | null
          tutor_lesson_summary?: string | null
          tutor_session_id?: string | null
          updated_at?: string
          video_url?: string | null
          visibility?: string
          visual_fatigue_score?: number | null
        }
        Update: {
          active_incident_count?: number | null
          audio_url?: string | null
          cdn_provider?: string | null
          cinematic_intro_url?: string | null
          cinematic_outro_url?: string | null
          cme_project_id?: string | null
          created_at?: string
          created_by?: string | null
          current_variant?: string | null
          description?: string | null
          difficulty_level?: string | null
          duration_seconds?: number | null
          health_score?: number | null
          hls_url?: string | null
          id?: string
          is_gold_content?: boolean | null
          last_test_passed?: boolean | null
          last_validation_at?: string | null
          learning_objectives?: string[] | null
          media_status?: string | null
          narrative_clarity_score?: number | null
          notebooklm_export_text?: string | null
          notebooklm_notebook_url?: string | null
          notebooklm_video_url?: string | null
          pipeline_last_error?: string | null
          playback_url?: string | null
          preview_url?: string | null
          published_at?: string | null
          reviewed_by?: string | null
          specialty?: string
          status?: string
          subtopic?: string | null
          thumbnail_url?: string | null
          title?: string
          topic?: string
          tutor_context_snapshot_id?: string | null
          tutor_lesson_id?: string | null
          tutor_lesson_summary?: string | null
          tutor_session_id?: string | null
          updated_at?: string
          video_url?: string | null
          visibility?: string
          visual_fatigue_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_video_lessons_cme_project_id_fkey"
            columns: ["cme_project_id"]
            isOneToOne: false
            referencedRelation: "cme_video_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_events: {
        Row: {
          alert_id: string
          created_at: string
          dedupe_key: string | null
          event_type: string
          id: string
          layer: string
          legacy_origin: string | null
          metadata: Json
          priority: string
          source: string
          suppressed_by: string | null
          user_id: string | null
          via_bridge: boolean
        }
        Insert: {
          alert_id: string
          created_at?: string
          dedupe_key?: string | null
          event_type: string
          id?: string
          layer: string
          legacy_origin?: string | null
          metadata?: Json
          priority: string
          source: string
          suppressed_by?: string | null
          user_id?: string | null
          via_bridge?: boolean
        }
        Update: {
          alert_id?: string
          created_at?: string
          dedupe_key?: string | null
          event_type?: string
          id?: string
          layer?: string
          legacy_origin?: string | null
          metadata?: Json
          priority?: string
          source?: string
          suppressed_by?: string | null
          user_id?: string | null
          via_bridge?: boolean
        }
        Relationships: []
      }
      alias_match_events: {
        Row: {
          alias_key: string
          alias_target: string
          confidence: number | null
          created_at: string
          id: string
          normalized_topic: string | null
          original_topic: string | null
          question_id: string
          run_id: string | null
          specialty_id: string | null
          subtopic_id: string | null
          table_source: string
          topic_id: string | null
        }
        Insert: {
          alias_key: string
          alias_target: string
          confidence?: number | null
          created_at?: string
          id?: string
          normalized_topic?: string | null
          original_topic?: string | null
          question_id: string
          run_id?: string | null
          specialty_id?: string | null
          subtopic_id?: string | null
          table_source: string
          topic_id?: string | null
        }
        Update: {
          alias_key?: string
          alias_target?: string
          confidence?: number | null
          created_at?: string
          id?: string
          normalized_topic?: string | null
          original_topic?: string | null
          question_id?: string
          run_id?: string | null
          specialty_id?: string | null
          subtopic_id?: string | null
          table_source?: string
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alias_match_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "question_classification_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnesis_interactions: {
        Row: {
          category: string | null
          coaching_tip: string | null
          created_at: string
          id: string
          patient_response: string | null
          quality_score: number | null
          question_text: string
          session_id: string
          user_id: string
        }
        Insert: {
          category?: string | null
          coaching_tip?: string | null
          created_at?: string
          id?: string
          patient_response?: string | null
          quality_score?: number | null
          question_text: string
          session_id: string
          user_id: string
        }
        Update: {
          category?: string | null
          coaching_tip?: string | null
          created_at?: string
          id?: string
          patient_response?: string | null
          quality_score?: number | null
          question_text?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamnesis_interactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "anamnesis_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnesis_results: {
        Row: {
          categories_covered: Json
          conversation_history: Json | null
          created_at: string
          difficulty: string
          final_score: number | null
          grade: string | null
          id: string
          ideal_anamnesis: string | null
          specialty: string
          time_total_minutes: number | null
          user_id: string
          xp_earned: number | null
        }
        Insert: {
          categories_covered?: Json
          conversation_history?: Json | null
          created_at?: string
          difficulty?: string
          final_score?: number | null
          grade?: string | null
          id?: string
          ideal_anamnesis?: string | null
          specialty: string
          time_total_minutes?: number | null
          user_id: string
          xp_earned?: number | null
        }
        Update: {
          categories_covered?: Json
          conversation_history?: Json | null
          created_at?: string
          difficulty?: string
          final_score?: number | null
          grade?: string | null
          id?: string
          ideal_anamnesis?: string | null
          specialty?: string
          time_total_minutes?: number | null
          user_id?: string
          xp_earned?: number | null
        }
        Relationships: []
      }
      anamnesis_sessions: {
        Row: {
          categories_covered: Json
          created_at: string
          difficulty: string
          final_score: number | null
          finished_at: string | null
          id: string
          scenario_id: string | null
          session_origin: string
          specialty: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          categories_covered?: Json
          created_at?: string
          difficulty?: string
          final_score?: number | null
          finished_at?: string | null
          id?: string
          scenario_id?: string | null
          session_origin?: string
          specialty: string
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          categories_covered?: Json
          created_at?: string
          difficulty?: string
          final_score?: number | null
          finished_at?: string | null
          id?: string
          scenario_id?: string | null
          session_origin?: string
          specialty?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamnesis_sessions_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "clinical_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_scores: {
        Row: {
          accuracy: number
          chance_score: number | null
          consistency_score: number
          created_at: string
          details_json: Json | null
          domain_score: number
          error_penalty: number
          id: string
          phase: string | null
          prep_index: number | null
          review_score: number
          score: number
          simulation_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy?: number
          chance_score?: number | null
          consistency_score?: number
          created_at?: string
          details_json?: Json | null
          domain_score?: number
          error_penalty?: number
          id?: string
          phase?: string | null
          prep_index?: number | null
          review_score?: number
          score?: number
          simulation_score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy?: number
          chance_score?: number | null
          consistency_score?: number
          created_at?: string
          details_json?: Json | null
          domain_score?: number
          error_penalty?: number
          id?: string
          phase?: string | null
          prep_index?: number | null
          review_score?: number
          score?: number
          simulation_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      asset_quality_audit_logs: {
        Row: {
          asset_id: string
          clinical_match_score: number | null
          created_at: string
          details: Json | null
          gate_source: string | null
          id: string
          image_type: string | null
          rejection_reason: string | null
          status: string
          visual_quality_score: number | null
        }
        Insert: {
          asset_id: string
          clinical_match_score?: number | null
          created_at?: string
          details?: Json | null
          gate_source?: string | null
          id?: string
          image_type?: string | null
          rejection_reason?: string | null
          status: string
          visual_quality_score?: number | null
        }
        Update: {
          asset_id?: string
          clinical_match_score?: number | null
          created_at?: string
          details?: Json | null
          gate_source?: string | null
          id?: string
          image_type?: string | null
          rejection_reason?: string | null
          status?: string
          visual_quality_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_quality_audit_logs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "medical_image_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_validation_results: {
        Row: {
          asset_id: string
          clinical_match_score: number | null
          created_at: string
          detected_image_type: string | null
          id: string
          is_medical_image: boolean
          model_used: string | null
          quality_score: number | null
          validated_at: string
          validation_reason: string | null
          validation_status: string
        }
        Insert: {
          asset_id: string
          clinical_match_score?: number | null
          created_at?: string
          detected_image_type?: string | null
          id?: string
          is_medical_image?: boolean
          model_used?: string | null
          quality_score?: number | null
          validated_at?: string
          validation_reason?: string | null
          validation_status?: string
        }
        Update: {
          asset_id?: string
          clinical_match_score?: number | null
          created_at?: string
          detected_image_type?: string | null
          id?: string
          is_medical_image?: boolean
          model_used?: string | null
          quality_score?: number | null
          validated_at?: string
          validation_reason?: string | null
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_validation_results_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "medical_image_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_decisions: {
        Row: {
          confidence_score: number | null
          created_at: string
          decision_output: Json
          decision_type: string
          event_hash: string | null
          id: string
          input_snapshot: Json
          justification: string
          source_module: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          decision_output?: Json
          decision_type: string
          event_hash?: string | null
          id?: string
          input_snapshot?: Json
          justification?: string
          source_module: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          decision_output?: Json
          decision_type?: string
          event_hash?: string | null
          id?: string
          input_snapshot?: Json
          justification?: string
          source_module?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_simulados_bancas: {
        Row: {
          alias_used: boolean | null
          applied_profile: string | null
          banca_key: string
          batch_number: number | null
          batch_size: number | null
          blueprint_found: boolean | null
          created_at: string | null
          distribution_analysis: Json
          elapsed_ms: number | null
          failed_count: number | null
          generated_count: number | null
          id: string
          job_id: string | null
          questions_data: Json
          target_exam: string | null
          total_requested: number
          user_id: string | null
        }
        Insert: {
          alias_used?: boolean | null
          applied_profile?: string | null
          banca_key: string
          batch_number?: number | null
          batch_size?: number | null
          blueprint_found?: boolean | null
          created_at?: string | null
          distribution_analysis: Json
          elapsed_ms?: number | null
          failed_count?: number | null
          generated_count?: number | null
          id?: string
          job_id?: string | null
          questions_data: Json
          target_exam?: string | null
          total_requested: number
          user_id?: string | null
        }
        Update: {
          alias_used?: boolean | null
          applied_profile?: string | null
          banca_key?: string
          batch_number?: number | null
          batch_size?: number | null
          blueprint_found?: boolean | null
          created_at?: string | null
          distribution_analysis?: Json
          elapsed_ms?: number | null
          failed_count?: number | null
          generated_count?: number | null
          id?: string
          job_id?: string | null
          questions_data?: Json
          target_exam?: string | null
          total_requested?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_simulados_bancas_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "simulation_generation_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_mitigation_logs: {
        Row: {
          action_taken: string
          created_at: string | null
          id: string
          incident_id: string | null
          result_metadata: Json | null
          status: string | null
          target: string | null
        }
        Insert: {
          action_taken: string
          created_at?: string | null
          id?: string
          incident_id?: string | null
          result_metadata?: Json | null
          status?: string | null
          target?: string | null
        }
        Update: {
          action_taken?: string
          created_at?: string | null
          id?: string
          incident_id?: string | null
          result_metadata?: Json | null
          status?: string | null
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_mitigation_logs_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "admin_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_telemetry: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          module: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          module: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          module?: string
          user_id?: string | null
        }
        Relationships: []
      }
      behavioral_telemetry: {
        Row: {
          action_kind: string | null
          created_at: string
          entry_point: string | null
          event_type: string
          id: string
          metadata: Json
          ms_since_session_start: number | null
          pre_action_clicks: number | null
          pre_action_route_changes: number | null
          route: string | null
          user_id: string
          viewport: string | null
        }
        Insert: {
          action_kind?: string | null
          created_at?: string
          entry_point?: string | null
          event_type: string
          id?: string
          metadata?: Json
          ms_since_session_start?: number | null
          pre_action_clicks?: number | null
          pre_action_route_changes?: number | null
          route?: string | null
          user_id: string
          viewport?: string | null
        }
        Update: {
          action_kind?: string | null
          created_at?: string
          entry_point?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          ms_since_session_start?: number | null
          pre_action_clicks?: number | null
          pre_action_route_changes?: number | null
          route?: string | null
          user_id?: string
          viewport?: string | null
        }
        Relationships: []
      }
      bulk_generation_jobs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          mode: string
          progress: Json | null
          result: Json | null
          specialty: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          mode?: string
          progress?: Json | null
          result?: Json | null
          specialty?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          mode?: string
          progress?: Json | null
          result?: Json | null
          specialty?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chance_by_exam: {
        Row: {
          banca: string
          chance_score: number
          created_at: string
          factors_json: Json | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          banca: string
          chance_score?: number
          created_at?: string
          factors_json?: Json | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          banca?: string
          chance_score?: number
          created_at?: string
          factors_json?: Json | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          agent_type: string
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_type: string
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_type?: string
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chronicle_favorites: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          notes: string | null
          specialty: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          notes?: string | null
          specialty?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          specialty?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chronicle_favorites_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chronicle_osce_sessions: {
        Row: {
          chronicle_id: string
          created_at: string
          decisions: Json | null
          evaluation: Json | null
          id: string
          score: number | null
          time_seconds: number | null
          user_id: string
        }
        Insert: {
          chronicle_id: string
          created_at?: string
          decisions?: Json | null
          evaluation?: Json | null
          id?: string
          score?: number | null
          time_seconds?: number | null
          user_id: string
        }
        Update: {
          chronicle_id?: string
          created_at?: string
          decisions?: Json | null
          evaluation?: Json | null
          id?: string
          score?: number | null
          time_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chronicle_osce_sessions_chronicle_id_fkey"
            columns: ["chronicle_id"]
            isOneToOne: false
            referencedRelation: "medical_chronicles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_members: {
        Row: {
          class_id: string
          id: string
          is_active: boolean | null
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          class_id: string
          id?: string
          is_active?: boolean | null
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          class_id?: string
          id?: string
          is_active?: boolean | null
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          institution_id: string
          invite_code: string | null
          is_active: boolean | null
          name: string
          period: number | null
          updated_at: string
          year: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          institution_id: string
          invite_code?: string | null
          is_active?: boolean | null
          name: string
          period?: number | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          institution_id?: string
          invite_code?: string | null
          is_active?: boolean | null
          name?: string
          period?: number | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      classification_health_snapshots: {
        Row: {
          created_at: string
          deterministic_pct: number | null
          heuristic_pct: number | null
          id: string
          pct_specialty: number | null
          pct_subtopic: number | null
          pct_topic: number | null
          queue_pct: number | null
          queue_pending: number | null
          run_id: string | null
          skipped_pct: number | null
          total_questions: number | null
        }
        Insert: {
          created_at?: string
          deterministic_pct?: number | null
          heuristic_pct?: number | null
          id?: string
          pct_specialty?: number | null
          pct_subtopic?: number | null
          pct_topic?: number | null
          queue_pct?: number | null
          queue_pending?: number | null
          run_id?: string | null
          skipped_pct?: number | null
          total_questions?: number | null
        }
        Update: {
          created_at?: string
          deterministic_pct?: number | null
          heuristic_pct?: number | null
          id?: string
          pct_specialty?: number | null
          pct_subtopic?: number | null
          pct_topic?: number | null
          queue_pct?: number | null
          queue_pending?: number | null
          run_id?: string | null
          skipped_pct?: number | null
          total_questions?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "classification_health_snapshots_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "question_classification_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_cases: {
        Row: {
          clinical_history: string
          correct_diagnosis: string
          created_at: string | null
          differential_diagnoses: Json | null
          difficulty: number | null
          explanation: string | null
          id: string
          imaging: string | null
          is_global: boolean | null
          lab_results: Json | null
          physical_exam: string | null
          source: string | null
          specialty: string
          title: string
          treatment: string | null
          user_id: string
          vitals: Json | null
        }
        Insert: {
          clinical_history: string
          correct_diagnosis: string
          created_at?: string | null
          differential_diagnoses?: Json | null
          difficulty?: number | null
          explanation?: string | null
          id?: string
          imaging?: string | null
          is_global?: boolean | null
          lab_results?: Json | null
          physical_exam?: string | null
          source?: string | null
          specialty: string
          title: string
          treatment?: string | null
          user_id: string
          vitals?: Json | null
        }
        Update: {
          clinical_history?: string
          correct_diagnosis?: string
          created_at?: string | null
          differential_diagnoses?: Json | null
          difficulty?: number | null
          explanation?: string | null
          id?: string
          imaging?: string | null
          is_global?: boolean | null
          lab_results?: Json | null
          physical_exam?: string | null
          source?: string | null
          specialty?: string
          title?: string
          treatment?: string | null
          user_id?: string
          vitals?: Json | null
        }
        Relationships: []
      }
      clinical_quality_profiles: {
        Row: {
          average_quality: number | null
          explanation_depth: string | null
          fallback_model: string | null
          id: string
          preferred_model: string | null
          prompt_profile: string | null
          regeneration_rate: number | null
          requires_references: boolean | null
          specialty: string
          total_audited: number | null
          updated_at: string | null
        }
        Insert: {
          average_quality?: number | null
          explanation_depth?: string | null
          fallback_model?: string | null
          id?: string
          preferred_model?: string | null
          prompt_profile?: string | null
          regeneration_rate?: number | null
          requires_references?: boolean | null
          specialty: string
          total_audited?: number | null
          updated_at?: string | null
        }
        Update: {
          average_quality?: number | null
          explanation_depth?: string | null
          fallback_model?: string | null
          id?: string
          preferred_model?: string | null
          prompt_profile?: string | null
          regeneration_rate?: number | null
          requires_references?: boolean | null
          specialty?: string
          total_audited?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      clinical_scenarios: {
        Row: {
          created_at: string
          created_by: string | null
          difficulty: string
          id: string
          is_global: boolean
          scenario_data: Json
          scenario_type: string
          specialty: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          difficulty?: string
          id?: string
          is_global?: boolean
          scenario_data?: Json
          scenario_type?: string
          specialty: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          difficulty?: string
          id?: string
          is_global?: boolean
          scenario_data?: Json
          scenario_type?: string
          specialty?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cme_adaptive_generation_profiles: {
        Row: {
          fsrs_data: Json | null
          id: string
          last_updated: string | null
          preferred_depth: number | null
          preferred_pacing: number | null
          user_id: string | null
          visual_preference: string | null
        }
        Insert: {
          fsrs_data?: Json | null
          id?: string
          last_updated?: string | null
          preferred_depth?: number | null
          preferred_pacing?: number | null
          user_id?: string | null
          visual_preference?: string | null
        }
        Update: {
          fsrs_data?: Json | null
          id?: string
          last_updated?: string | null
          preferred_depth?: number | null
          preferred_pacing?: number | null
          user_id?: string | null
          visual_preference?: string | null
        }
        Relationships: []
      }
      cme_adaptive_interventions: {
        Row: {
          ace_decision_id: string | null
          chapter_ref: string | null
          created_at: string
          efficacy_score: number | null
          friction_type: string
          id: string
          intervention_type: string | null
          project_id: string | null
          student_id: string | null
          variant_id: string | null
        }
        Insert: {
          ace_decision_id?: string | null
          chapter_ref?: string | null
          created_at?: string
          efficacy_score?: number | null
          friction_type: string
          id?: string
          intervention_type?: string | null
          project_id?: string | null
          student_id?: string | null
          variant_id?: string | null
        }
        Update: {
          ace_decision_id?: string | null
          chapter_ref?: string | null
          created_at?: string
          efficacy_score?: number | null
          friction_type?: string
          id?: string
          intervention_type?: string | null
          project_id?: string | null
          student_id?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_adaptive_interventions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cme_video_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_adaptive_interventions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "adaptive_student_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cme_adaptive_interventions_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "cme_render_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_adaptive_pacing_maps: {
        Row: {
          cognitive_load_curve: Json | null
          created_at: string
          fatigue_curve: Json | null
          flow_state_curve: Json | null
          id: string
          pacing_curve: Json
          pacing_mode: string | null
          pause_points: Json | null
          recovery_insertions: Json | null
          reinforcement_points: Json | null
          render_job_id: string | null
          semantic_plan_id: string | null
          stress_curve: Json | null
          target_duration_seconds: number | null
        }
        Insert: {
          cognitive_load_curve?: Json | null
          created_at?: string
          fatigue_curve?: Json | null
          flow_state_curve?: Json | null
          id?: string
          pacing_curve: Json
          pacing_mode?: string | null
          pause_points?: Json | null
          recovery_insertions?: Json | null
          reinforcement_points?: Json | null
          render_job_id?: string | null
          semantic_plan_id?: string | null
          stress_curve?: Json | null
          target_duration_seconds?: number | null
        }
        Update: {
          cognitive_load_curve?: Json | null
          created_at?: string
          fatigue_curve?: Json | null
          flow_state_curve?: Json | null
          id?: string
          pacing_curve?: Json
          pacing_mode?: string | null
          pause_points?: Json | null
          recovery_insertions?: Json | null
          reinforcement_points?: Json | null
          render_job_id?: string | null
          semantic_plan_id?: string | null
          stress_curve?: Json | null
          target_duration_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_adaptive_pacing_maps_semantic_plan_id_fkey"
            columns: ["semantic_plan_id"]
            isOneToOne: false
            referencedRelation: "cme_semantic_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_adaptive_profiles: {
        Row: {
          created_at: string
          id: string
          learning_style: string | null
          overload_threshold: number | null
          pacing_preference: string | null
          preferred_depth: string | null
          replay_rate: number | null
          retention_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          learning_style?: string | null
          overload_threshold?: number | null
          pacing_preference?: string | null
          preferred_depth?: string | null
          replay_rate?: number | null
          retention_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          learning_style?: string | null
          overload_threshold?: number | null
          pacing_preference?: string | null
          preferred_depth?: string | null
          replay_rate?: number | null
          retention_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cme_adaptive_timing_maps: {
        Row: {
          fatigue_protection_map: Json | null
          generated_at: string
          id: string
          lesson_id: string | null
          pacing_curve: Json | null
          recovery_curve: Json | null
          reinforcement_curve: Json | null
          semantic_revisit_map: Json | null
          variant_type: string | null
        }
        Insert: {
          fatigue_protection_map?: Json | null
          generated_at?: string
          id?: string
          lesson_id?: string | null
          pacing_curve?: Json | null
          recovery_curve?: Json | null
          reinforcement_curve?: Json | null
          semantic_revisit_map?: Json | null
          variant_type?: string | null
        }
        Update: {
          fatigue_protection_map?: Json | null
          generated_at?: string
          id?: string
          lesson_id?: string | null
          pacing_curve?: Json | null
          recovery_curve?: Json | null
          reinforcement_curve?: Json | null
          semantic_revisit_map?: Json | null
          variant_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_adaptive_timing_maps_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_attention_maps: {
        Row: {
          cognitive_load_curve: Json
          created_at: string | null
          heatmap_data: Json
          id: string
          lineage_id: string | null
        }
        Insert: {
          cognitive_load_curve: Json
          created_at?: string | null
          heatmap_data: Json
          id?: string
          lineage_id?: string | null
        }
        Update: {
          cognitive_load_curve?: Json
          created_at?: string | null
          heatmap_data?: Json
          id?: string
          lineage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_attention_maps_lineage_id_fkey"
            columns: ["lineage_id"]
            isOneToOne: false
            referencedRelation: "cme_render_lineage"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_audit_logs: {
        Row: {
          action: string
          aggregation_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          aggregation_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          aggregation_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_audit_logs_aggregation_id_fkey"
            columns: ["aggregation_id"]
            isOneToOne: false
            referencedRelation: "cme_session_aggregation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_audit_logs_aggregation_id_fkey"
            columns: ["aggregation_id"]
            isOneToOne: false
            referencedRelation: "cme_session_aggregations"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_autonomous_optimizations: {
        Row: {
          applied_at: string | null
          created_at: string | null
          detected_problem: string | null
          effectiveness_score: number | null
          expected_retention_gain: number | null
          generated_variant_id: string | null
          id: string
          optimization_type: string | null
          video_lesson_id: string | null
        }
        Insert: {
          applied_at?: string | null
          created_at?: string | null
          detected_problem?: string | null
          effectiveness_score?: number | null
          expected_retention_gain?: number | null
          generated_variant_id?: string | null
          id?: string
          optimization_type?: string | null
          video_lesson_id?: string | null
        }
        Update: {
          applied_at?: string | null
          created_at?: string | null
          detected_problem?: string | null
          effectiveness_score?: number | null
          expected_retention_gain?: number | null
          generated_variant_id?: string | null
          id?: string
          optimization_type?: string | null
          video_lesson_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_autonomous_optimizations_generated_variant_id_fkey"
            columns: ["generated_variant_id"]
            isOneToOne: false
            referencedRelation: "cme_variant_generation_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_autonomous_optimizations_video_lesson_id_fkey"
            columns: ["video_lesson_id"]
            isOneToOne: false
            referencedRelation: "ai_video_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_autoscaling_events: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          reason: string | null
          worker_count_after: number | null
          worker_count_before: number | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          worker_count_after?: number | null
          worker_count_before?: number | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          worker_count_after?: number | null
          worker_count_before?: number | null
        }
        Relationships: []
      }
      cme_batch_items: {
        Row: {
          batch_id: string
          created_at: string
          error_log: string | null
          id: string
          input_payload: Json | null
          item_type: string
          project_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          error_log?: string | null
          id?: string
          input_payload?: Json | null
          item_type: string
          project_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          error_log?: string | null
          id?: string
          input_payload?: Json | null
          item_type?: string
          project_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "cme_batch_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_batch_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cme_video_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_batch_jobs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          priority: number | null
          processed_items: number | null
          status: string | null
          title: string
          total_items: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          priority?: number | null
          processed_items?: number | null
          status?: string | null
          title: string
          total_items?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          priority?: number | null
          processed_items?: number | null
          status?: string | null
          title?: string
          total_items?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cme_batch_lineage: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          relationship_type: string | null
          source_id: string | null
          target_id: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          relationship_type?: string | null
          source_id?: string | null
          target_id?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          relationship_type?: string | null
          source_id?: string | null
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_batch_lineage_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "cme_batch_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_benchmark_audit: {
        Row: {
          action_type: string
          actor_id: string | null
          created_at: string
          decision_metadata: Json | null
          id: string
          reference_id: string | null
          render_job_id: string | null
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          created_at?: string
          decision_metadata?: Json | null
          id?: string
          reference_id?: string | null
          render_job_id?: string | null
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          created_at?: string
          decision_metadata?: Json | null
          id?: string
          reference_id?: string | null
          render_job_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_benchmark_audit_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "cme_cinematic_reference_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_benchmark_audit_render_job_id_fkey"
            columns: ["render_job_id"]
            isOneToOne: false
            referencedRelation: "cme_render_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_budget_alerts: {
        Row: {
          cost_center_id: string
          created_at: string | null
          id: string
          is_triggered: boolean | null
          threshold_pct: number
          triggered_at: string | null
        }
        Insert: {
          cost_center_id: string
          created_at?: string | null
          id?: string
          is_triggered?: boolean | null
          threshold_pct: number
          triggered_at?: string | null
        }
        Update: {
          cost_center_id?: string
          created_at?: string | null
          id?: string
          is_triggered?: boolean | null
          threshold_pct?: number
          triggered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_budget_alerts_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cme_cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_buffer_metrics: {
        Row: {
          bitrate_kbps: number | null
          created_at: string | null
          duration_ms: number | null
          event_type: string
          id: string
          playback_session_id: string
          position_seconds: number
        }
        Insert: {
          bitrate_kbps?: number | null
          created_at?: string | null
          duration_ms?: number | null
          event_type: string
          id?: string
          playback_session_id: string
          position_seconds: number
        }
        Update: {
          bitrate_kbps?: number | null
          created_at?: string | null
          duration_ms?: number | null
          event_type?: string
          id?: string
          playback_session_id?: string
          position_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "cme_buffer_metrics_playback_session_id_fkey"
            columns: ["playback_session_id"]
            isOneToOne: false
            referencedRelation: "cme_playback_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_cinematic_quality_score: {
        Row: {
          created_at: string
          drift_reduction_score: number | null
          estimated_retention_score: number | null
          fatigue_protection_score: number | null
          id: string
          multimodal_continuity_score: number | null
          narrative_flow_score: number | null
          overall_cinematic_score: number | null
          pacing_efficiency_score: number | null
          render_job_id: string | null
          reviewer_notes: string | null
          scoring_explanation: Json | null
          segment_weights: Json | null
          verdict: string | null
        }
        Insert: {
          created_at?: string
          drift_reduction_score?: number | null
          estimated_retention_score?: number | null
          fatigue_protection_score?: number | null
          id?: string
          multimodal_continuity_score?: number | null
          narrative_flow_score?: number | null
          overall_cinematic_score?: number | null
          pacing_efficiency_score?: number | null
          render_job_id?: string | null
          reviewer_notes?: string | null
          scoring_explanation?: Json | null
          segment_weights?: Json | null
          verdict?: string | null
        }
        Update: {
          created_at?: string
          drift_reduction_score?: number | null
          estimated_retention_score?: number | null
          fatigue_protection_score?: number | null
          id?: string
          multimodal_continuity_score?: number | null
          narrative_flow_score?: number | null
          overall_cinematic_score?: number | null
          pacing_efficiency_score?: number | null
          render_job_id?: string | null
          reviewer_notes?: string | null
          scoring_explanation?: Json | null
          segment_weights?: Json | null
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_cinematic_quality_score_render_job_id_fkey"
            columns: ["render_job_id"]
            isOneToOne: false
            referencedRelation: "cme_render_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_cinematic_reference_profiles: {
        Row: {
          chapter_profile: Json | null
          cinematic_curve: Json | null
          cognitive_curve: Json | null
          emotional_curve: Json | null
          fatigue_protection_profile: Json | null
          feynman_trigger_points: Json | null
          generated_at: string
          hotspot_heuristics: Json | null
          id: string
          ideal_timings: Json | null
          narrative_profile: Json | null
          pacing_profile: Json | null
          reference_name: string
          reference_type: string | null
          replay_hotspot_profile: Json | null
          retention_profile: Json | null
          semantic_focus_map: Json | null
          storytelling_profile: Json | null
          transition_profile: Json | null
          video_duration_seconds: number | null
          visual_attention_profile: Json | null
          visual_density_profile: Json | null
        }
        Insert: {
          chapter_profile?: Json | null
          cinematic_curve?: Json | null
          cognitive_curve?: Json | null
          emotional_curve?: Json | null
          fatigue_protection_profile?: Json | null
          feynman_trigger_points?: Json | null
          generated_at?: string
          hotspot_heuristics?: Json | null
          id?: string
          ideal_timings?: Json | null
          narrative_profile?: Json | null
          pacing_profile?: Json | null
          reference_name: string
          reference_type?: string | null
          replay_hotspot_profile?: Json | null
          retention_profile?: Json | null
          semantic_focus_map?: Json | null
          storytelling_profile?: Json | null
          transition_profile?: Json | null
          video_duration_seconds?: number | null
          visual_attention_profile?: Json | null
          visual_density_profile?: Json | null
        }
        Update: {
          chapter_profile?: Json | null
          cinematic_curve?: Json | null
          cognitive_curve?: Json | null
          emotional_curve?: Json | null
          fatigue_protection_profile?: Json | null
          feynman_trigger_points?: Json | null
          generated_at?: string
          hotspot_heuristics?: Json | null
          id?: string
          ideal_timings?: Json | null
          narrative_profile?: Json | null
          pacing_profile?: Json | null
          reference_name?: string
          reference_type?: string | null
          replay_hotspot_profile?: Json | null
          retention_profile?: Json | null
          semantic_focus_map?: Json | null
          storytelling_profile?: Json | null
          transition_profile?: Json | null
          video_duration_seconds?: number | null
          visual_attention_profile?: Json | null
          visual_density_profile?: Json | null
        }
        Relationships: []
      }
      cme_cinematic_similarity_reports: {
        Row: {
          cinematic_similarity_score: number | null
          comparison_explanation: Json | null
          fatigue_similarity_score: number | null
          generated_at: string
          id: string
          metadata: Json | null
          narrative_similarity_score: number | null
          overall_similarity_score: number | null
          pacing_similarity_score: number | null
          reference_profile_id: string | null
          render_job_id: string | null
          retention_similarity_score: number | null
        }
        Insert: {
          cinematic_similarity_score?: number | null
          comparison_explanation?: Json | null
          fatigue_similarity_score?: number | null
          generated_at?: string
          id?: string
          metadata?: Json | null
          narrative_similarity_score?: number | null
          overall_similarity_score?: number | null
          pacing_similarity_score?: number | null
          reference_profile_id?: string | null
          render_job_id?: string | null
          retention_similarity_score?: number | null
        }
        Update: {
          cinematic_similarity_score?: number | null
          comparison_explanation?: Json | null
          fatigue_similarity_score?: number | null
          generated_at?: string
          id?: string
          metadata?: Json | null
          narrative_similarity_score?: number | null
          overall_similarity_score?: number | null
          pacing_similarity_score?: number | null
          reference_profile_id?: string | null
          render_job_id?: string | null
          retention_similarity_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_cinematic_similarity_reports_reference_profile_id_fkey"
            columns: ["reference_profile_id"]
            isOneToOne: false
            referencedRelation: "cme_cinematic_reference_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_cinematic_similarity_reports_render_job_id_fkey"
            columns: ["render_job_id"]
            isOneToOne: false
            referencedRelation: "cme_render_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_cluster_metrics: {
        Row: {
          active_workers: number | null
          avg_render_time: number | null
          cpu_utilization: number | null
          created_at: string
          id: string
          queued_jobs: number | null
          vram_utilization: number | null
        }
        Insert: {
          active_workers?: number | null
          avg_render_time?: number | null
          cpu_utilization?: number | null
          created_at?: string
          id?: string
          queued_jobs?: number | null
          vram_utilization?: number | null
        }
        Update: {
          active_workers?: number | null
          avg_render_time?: number | null
          cpu_utilization?: number | null
          created_at?: string
          id?: string
          queued_jobs?: number | null
          vram_utilization?: number | null
        }
        Relationships: []
      }
      cme_cognitive_analysis: {
        Row: {
          active_recall_score: number | null
          cognitive_density: number | null
          created_at: string | null
          feynman_depth: number | null
          generation_id: string | null
          id: string
          learner_profile: string | null
          metadata: Json | null
          overload_risk: number | null
          pacing_score: number | null
          retention_prediction: number | null
          user_id: string | null
          visual_complexity: number | null
        }
        Insert: {
          active_recall_score?: number | null
          cognitive_density?: number | null
          created_at?: string | null
          feynman_depth?: number | null
          generation_id?: string | null
          id?: string
          learner_profile?: string | null
          metadata?: Json | null
          overload_risk?: number | null
          pacing_score?: number | null
          retention_prediction?: number | null
          user_id?: string | null
          visual_complexity?: number | null
        }
        Update: {
          active_recall_score?: number | null
          cognitive_density?: number | null
          created_at?: string | null
          feynman_depth?: number | null
          generation_id?: string | null
          id?: string
          learner_profile?: string | null
          metadata?: Json | null
          overload_risk?: number | null
          pacing_score?: number | null
          retention_prediction?: number | null
          user_id?: string | null
          visual_complexity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_cognitive_analysis_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "cme_session_aggregation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_cognitive_analysis_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "cme_session_aggregations"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_cognitive_pacing: {
        Row: {
          created_at: string
          fatigue_protection_points: number[] | null
          id: string
          intensity_curve: Json
          project_id: string | null
          timeline_events: Json
        }
        Insert: {
          created_at?: string
          fatigue_protection_points?: number[] | null
          id?: string
          intensity_curve: Json
          project_id?: string | null
          timeline_events: Json
        }
        Update: {
          created_at?: string
          fatigue_protection_points?: number[] | null
          id?: string
          intensity_curve?: Json
          project_id?: string | null
          timeline_events?: Json
        }
        Relationships: [
          {
            foreignKeyName: "cme_cognitive_pacing_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cme_video_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_cost_centers: {
        Row: {
          allocated_budget: number | null
          created_at: string | null
          currency: string | null
          id: string
          name: string
          spent_amount: number | null
          tenant_id: string | null
        }
        Insert: {
          allocated_budget?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          name: string
          spent_amount?: number | null
          tenant_id?: string | null
        }
        Update: {
          allocated_budget?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          name?: string
          spent_amount?: number | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      cme_director_decisions: {
        Row: {
          cognitive_goal: string | null
          created_at: string | null
          decision_type: string
          expected_retention_gain: number | null
          id: string
          metadata: Json | null
          pacing_adjustment: number | null
          reasoning: string | null
          render_job_id: string | null
          scene_node_id: string | null
          visual_goal: string | null
        }
        Insert: {
          cognitive_goal?: string | null
          created_at?: string | null
          decision_type: string
          expected_retention_gain?: number | null
          id?: string
          metadata?: Json | null
          pacing_adjustment?: number | null
          reasoning?: string | null
          render_job_id?: string | null
          scene_node_id?: string | null
          visual_goal?: string | null
        }
        Update: {
          cognitive_goal?: string | null
          created_at?: string | null
          decision_type?: string
          expected_retention_gain?: number | null
          id?: string
          metadata?: Json | null
          pacing_adjustment?: number | null
          reasoning?: string | null
          render_job_id?: string | null
          scene_node_id?: string | null
          visual_goal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_director_decisions_render_job_id_fkey"
            columns: ["render_job_id"]
            isOneToOne: false
            referencedRelation: "cme_render_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_director_decisions_scene_node_id_fkey"
            columns: ["scene_node_id"]
            isOneToOne: false
            referencedRelation: "cme_scene_graph_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_exam_sprint_profiles: {
        Row: {
          created_at: string | null
          exam_density: number
          generated_at: string | null
          id: string
          lesson_id: string | null
          retention_focus: string
          sprint_duration: number
          sprint_score: number | null
        }
        Insert: {
          created_at?: string | null
          exam_density: number
          generated_at?: string | null
          id?: string
          lesson_id?: string | null
          retention_focus: string
          sprint_duration: number
          sprint_score?: number | null
        }
        Update: {
          created_at?: string | null
          exam_density?: number
          generated_at?: string | null
          id?: string
          lesson_id?: string | null
          retention_focus?: string
          sprint_duration?: number
          sprint_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_exam_sprint_profiles_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "ai_video_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_explainable_scores: {
        Row: {
          contributing_factors: Json | null
          detected_risks: Json | null
          explanation: string | null
          generated_at: string
          id: string
          optimization_recommendations: Json | null
          render_job_id: string | null
          score_type: string
          score_value: number
        }
        Insert: {
          contributing_factors?: Json | null
          detected_risks?: Json | null
          explanation?: string | null
          generated_at?: string
          id?: string
          optimization_recommendations?: Json | null
          render_job_id?: string | null
          score_type: string
          score_value: number
        }
        Update: {
          contributing_factors?: Json | null
          detected_risks?: Json | null
          explanation?: string | null
          generated_at?: string
          id?: string
          optimization_recommendations?: Json | null
          render_job_id?: string | null
          score_type?: string
          score_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "cme_explainable_scores_render_job_id_fkey"
            columns: ["render_job_id"]
            isOneToOne: false
            referencedRelation: "cme_render_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_generation_eligibility_logs: {
        Row: {
          cognitive_density: number | null
          created_at: string | null
          eligible: boolean
          id: string
          metadata: Json | null
          rejection_reason: string | null
          structure_score: number | null
          tutor_message_id: string
        }
        Insert: {
          cognitive_density?: number | null
          created_at?: string | null
          eligible: boolean
          id?: string
          metadata?: Json | null
          rejection_reason?: string | null
          structure_score?: number | null
          tutor_message_id: string
        }
        Update: {
          cognitive_density?: number | null
          created_at?: string | null
          eligible?: boolean
          id?: string
          metadata?: Json | null
          rejection_reason?: string | null
          structure_score?: number | null
          tutor_message_id?: string
        }
        Relationships: []
      }
      cme_governance_logs: {
        Row: {
          comments: string | null
          created_at: string
          from_status: string | null
          id: string
          metadata: Json | null
          project_id: string | null
          reviewer_id: string | null
          to_status: string
          verdict: string | null
        }
        Insert: {
          comments?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string | null
          reviewer_id?: string | null
          to_status: string
          verdict?: string | null
        }
        Update: {
          comments?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string | null
          reviewer_id?: string | null
          to_status?: string
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_governance_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cme_video_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_governance_reviews: {
        Row: {
          approved_at: string | null
          blocking_reasons: Json | null
          created_at: string
          id: string
          lesson_id: string | null
          review_notes: string | null
          review_status: string | null
          review_type: string
          reviewer_id: string | null
        }
        Insert: {
          approved_at?: string | null
          blocking_reasons?: Json | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          review_notes?: string | null
          review_status?: string | null
          review_type: string
          reviewer_id?: string | null
        }
        Update: {
          approved_at?: string | null
          blocking_reasons?: Json | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          review_notes?: string | null
          review_status?: string | null
          review_type?: string
          reviewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_governance_reviews_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_gpu_clusters: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          max_workers: number
          name: string
          provider: string
          region: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_workers?: number
          name: string
          provider: string
          region: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_workers?: number
          name?: string
          provider?: string
          region?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cme_gpu_cost_metrics: {
        Row: {
          cost_center_id: string | null
          created_at: string | null
          estimated_cost: number | null
          id: string
          render_job_id: string
          vram_minutes: number | null
          worker_id: string
        }
        Insert: {
          cost_center_id?: string | null
          created_at?: string | null
          estimated_cost?: number | null
          id?: string
          render_job_id: string
          vram_minutes?: number | null
          worker_id: string
        }
        Update: {
          cost_center_id?: string | null
          created_at?: string | null
          estimated_cost?: number | null
          id?: string
          render_job_id?: string
          vram_minutes?: number | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_gpu_cost_metrics_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cme_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_gpu_cost_metrics_render_job_id_fkey"
            columns: ["render_job_id"]
            isOneToOne: false
            referencedRelation: "cme_render_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_gpu_cost_metrics_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "cme_worker_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_gpu_workers: {
        Row: {
          active_jobs: number | null
          active_projects: number | null
          created_at: string
          current_load: number | null
          gpu_model: string | null
          id: string
          last_heartbeat: string
          parallel_render_limit: number | null
          render_capacity: number | null
          render_capacity_score: number | null
          status: string
          temperature_c: number | null
          thermal_state: string | null
          vram_total_mb: number | null
          vram_used_mb: number | null
          worker_name: string
        }
        Insert: {
          active_jobs?: number | null
          active_projects?: number | null
          created_at?: string
          current_load?: number | null
          gpu_model?: string | null
          id?: string
          last_heartbeat?: string
          parallel_render_limit?: number | null
          render_capacity?: number | null
          render_capacity_score?: number | null
          status?: string
          temperature_c?: number | null
          thermal_state?: string | null
          vram_total_mb?: number | null
          vram_used_mb?: number | null
          worker_name: string
        }
        Update: {
          active_jobs?: number | null
          active_projects?: number | null
          created_at?: string
          current_load?: number | null
          gpu_model?: string | null
          id?: string
          last_heartbeat?: string
          parallel_render_limit?: number | null
          render_capacity?: number | null
          render_capacity_score?: number | null
          status?: string
          temperature_c?: number | null
          thermal_state?: string | null
          vram_total_mb?: number | null
          vram_used_mb?: number | null
          worker_name?: string
        }
        Relationships: []
      }
      cme_hls_manifests: {
        Row: {
          average_bitrate: number | null
          created_at: string | null
          id: string
          latency_score: number | null
          master_manifest_url: string
          playback_health_score: number | null
          resolution_profiles: Json | null
          segment_count: number | null
          video_lesson_id: string | null
        }
        Insert: {
          average_bitrate?: number | null
          created_at?: string | null
          id?: string
          latency_score?: number | null
          master_manifest_url: string
          playback_health_score?: number | null
          resolution_profiles?: Json | null
          segment_count?: number | null
          video_lesson_id?: string | null
        }
        Update: {
          average_bitrate?: number | null
          created_at?: string | null
          id?: string
          latency_score?: number | null
          master_manifest_url?: string
          playback_health_score?: number | null
          resolution_profiles?: Json | null
          segment_count?: number | null
          video_lesson_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_hls_manifests_video_lesson_id_fkey"
            columns: ["video_lesson_id"]
            isOneToOne: false
            referencedRelation: "ai_video_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_incidents: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          probable_cause: string | null
          resolved_at: string | null
          severity: string
          status: string
          timeline: Json | null
          title: string
          updated_at: string | null
          video_lesson_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          probable_cause?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          timeline?: Json | null
          title: string
          updated_at?: string | null
          video_lesson_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          probable_cause?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          timeline?: Json | null
          title?: string
          updated_at?: string | null
          video_lesson_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_incidents_video_lesson_id_fkey"
            columns: ["video_lesson_id"]
            isOneToOne: false
            referencedRelation: "ai_video_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_knowledge_lineage: {
        Row: {
          created_at: string | null
          id: string
          source_entity_id: string
          source_entity_type: string
          target_entity_id: string
          target_entity_type: string
          transformation_type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          source_entity_id: string
          source_entity_type: string
          target_entity_id: string
          target_entity_type: string
          transformation_type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          source_entity_id?: string
          source_entity_type?: string
          target_entity_id?: string
          target_entity_type?: string
          transformation_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cme_knowledge_mesh_edges: {
        Row: {
          created_at: string
          id: string
          relationship_type: string
          source_node_id: string
          strength: number | null
          target_node_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          relationship_type: string
          source_node_id: string
          strength?: number | null
          target_node_id: string
        }
        Update: {
          created_at?: string
          id?: string
          relationship_type?: string
          source_node_id?: string
          strength?: number | null
          target_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_knowledge_mesh_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "cme_knowledge_mesh_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_knowledge_mesh_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "cme_knowledge_mesh_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_knowledge_mesh_nodes: {
        Row: {
          cognitive_weight: number | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          title: string | null
          user_id: string
        }
        Insert: {
          cognitive_weight?: number | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          title?: string | null
          user_id: string
        }
        Update: {
          cognitive_weight?: number | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cme_learning_feedback: {
        Row: {
          chapter_id: string | null
          completion_rate: number | null
          created_at: string | null
          engagement_score: number | null
          id: string
          replay_count: number | null
          technical_depth_feedback: string | null
          user_id: string | null
          video_id: string | null
        }
        Insert: {
          chapter_id?: string | null
          completion_rate?: number | null
          created_at?: string | null
          engagement_score?: number | null
          id?: string
          replay_count?: number | null
          technical_depth_feedback?: string | null
          user_id?: string | null
          video_id?: string | null
        }
        Update: {
          chapter_id?: string | null
          completion_rate?: number | null
          created_at?: string | null
          engagement_score?: number | null
          id?: string
          replay_count?: number | null
          technical_depth_feedback?: string | null
          user_id?: string | null
          video_id?: string | null
        }
        Relationships: []
      }
      cme_lesson_blocks: {
        Row: {
          aggregation_id: string
          block_order: number
          block_type: string
          cognitive_density: number | null
          content: string
          content_hash: string | null
          created_at: string
          estimated_minutes: number | null
          id: string
          last_error: string | null
          scene_graph_data: Json | null
          source_message_ids: string[] | null
          title: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          aggregation_id: string
          block_order: number
          block_type: string
          cognitive_density?: number | null
          content: string
          content_hash?: string | null
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          last_error?: string | null
          scene_graph_data?: Json | null
          source_message_ids?: string[] | null
          title: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          aggregation_id?: string
          block_order?: number
          block_type?: string
          cognitive_density?: number | null
          content?: string
          content_hash?: string | null
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          last_error?: string | null
          scene_graph_data?: Json | null
          source_message_ids?: string[] | null
          title?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_lesson_blocks_aggregation_id_fkey"
            columns: ["aggregation_id"]
            isOneToOne: false
            referencedRelation: "cme_session_aggregation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_lesson_blocks_aggregation_id_fkey"
            columns: ["aggregation_id"]
            isOneToOne: false
            referencedRelation: "cme_session_aggregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_lesson_blocks_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "cme_session_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_lineage_edges: {
        Row: {
          created_at: string | null
          id: string
          relationship_type: string
          source_node_id: string
          target_node_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          relationship_type: string
          source_node_id: string
          target_node_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          relationship_type?: string
          source_node_id?: string
          target_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_lineage_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "cme_lineage_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_lineage_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "cme_lineage_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_lineage_nodes: {
        Row: {
          created_at: string | null
          entity_id: string
          id: string
          metadata: Json | null
          type: string
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          id?: string
          metadata?: Json | null
          type: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          id?: string
          metadata?: Json | null
          type?: string
        }
        Relationships: []
      }
      cme_lineage_transformations: {
        Row: {
          created_at: string | null
          edge_id: string
          id: string
          input_hash: string | null
          output_hash: string | null
          parameters: Json | null
          transformation_type: string
        }
        Insert: {
          created_at?: string | null
          edge_id: string
          id?: string
          input_hash?: string | null
          output_hash?: string | null
          parameters?: Json | null
          transformation_type: string
        }
        Update: {
          created_at?: string | null
          edge_id?: string
          id?: string
          input_hash?: string | null
          output_hash?: string | null
          parameters?: Json | null
          transformation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_lineage_transformations_edge_id_fkey"
            columns: ["edge_id"]
            isOneToOne: false
            referencedRelation: "cme_lineage_edges"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_media_reprocessing_jobs: {
        Row: {
          created_at: string | null
          error_log: string | null
          failure_reason: string | null
          id: string
          last_attempt_at: string | null
          metadata: Json | null
          render_job_id: string | null
          reprocess_status: string
          resolved_at: string | null
          retry_count: number | null
          video_lesson_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_log?: string | null
          failure_reason?: string | null
          id?: string
          last_attempt_at?: string | null
          metadata?: Json | null
          render_job_id?: string | null
          reprocess_status?: string
          resolved_at?: string | null
          retry_count?: number | null
          video_lesson_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_log?: string | null
          failure_reason?: string | null
          id?: string
          last_attempt_at?: string | null
          metadata?: Json | null
          render_job_id?: string | null
          reprocess_status?: string
          resolved_at?: string | null
          retry_count?: number | null
          video_lesson_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_media_reprocessing_jobs_video_lesson_id_fkey"
            columns: ["video_lesson_id"]
            isOneToOne: false
            referencedRelation: "ai_video_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_media_validation_logs: {
        Row: {
          checked_url: string | null
          created_at: string | null
          detected_issue: string | null
          id: string
          latency_ms: number | null
          metadata: Json | null
          mime_type: string | null
          recommendation: string | null
          response_code: number | null
          validation_status: string
          validation_type: string
          video_lesson_id: string | null
        }
        Insert: {
          checked_url?: string | null
          created_at?: string | null
          detected_issue?: string | null
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          mime_type?: string | null
          recommendation?: string | null
          response_code?: number | null
          validation_status: string
          validation_type: string
          video_lesson_id?: string | null
        }
        Update: {
          checked_url?: string | null
          created_at?: string | null
          detected_issue?: string | null
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          mime_type?: string | null
          recommendation?: string | null
          response_code?: number | null
          validation_status?: string
          validation_type?: string
          video_lesson_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_media_validation_logs_video_lesson_id_fkey"
            columns: ["video_lesson_id"]
            isOneToOne: false
            referencedRelation: "ai_video_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_multimodal_analytics: {
        Row: {
          abandonment_points: Json | null
          avg_pacing_efficiency: number | null
          chapter_retention: Json | null
          cinematic_retention_score: number | null
          cognitive_load_score: number | null
          completion_rate: number | null
          created_at: string
          drift_probability: number | null
          fatigue_score: number | null
          id: string
          multimodal_mastery_score: number | null
          pacing_efficiency: number | null
          project_id: string | null
          replay_count: number | null
          replay_hotspots: Json | null
          stress_spikes: Json | null
          student_id: string | null
          tutor_dependency_score: number | null
          watch_time_seconds: number
        }
        Insert: {
          abandonment_points?: Json | null
          avg_pacing_efficiency?: number | null
          chapter_retention?: Json | null
          cinematic_retention_score?: number | null
          cognitive_load_score?: number | null
          completion_rate?: number | null
          created_at?: string
          drift_probability?: number | null
          fatigue_score?: number | null
          id?: string
          multimodal_mastery_score?: number | null
          pacing_efficiency?: number | null
          project_id?: string | null
          replay_count?: number | null
          replay_hotspots?: Json | null
          stress_spikes?: Json | null
          student_id?: string | null
          tutor_dependency_score?: number | null
          watch_time_seconds?: number
        }
        Update: {
          abandonment_points?: Json | null
          avg_pacing_efficiency?: number | null
          chapter_retention?: Json | null
          cinematic_retention_score?: number | null
          cognitive_load_score?: number | null
          completion_rate?: number | null
          created_at?: string
          drift_probability?: number | null
          fatigue_score?: number | null
          id?: string
          multimodal_mastery_score?: number | null
          pacing_efficiency?: number | null
          project_id?: string | null
          replay_count?: number | null
          replay_hotspots?: Json | null
          stress_spikes?: Json | null
          student_id?: string | null
          tutor_dependency_score?: number | null
          watch_time_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "cme_multimodal_analytics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cme_video_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_multimodal_analytics_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "adaptive_student_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      cme_narrative_scripts: {
        Row: {
          chapters: Json
          cinematic_script: Json
          created_at: string
          emotional_curve: Json | null
          emphasis_map: Json | null
          generated_by_model: string | null
          id: string
          narrative_style: string | null
          pacing_curve: Json | null
          pacing_hints: Json | null
          project_id: string | null
          recovery_insertions: Json | null
          render_job_id: string | null
          retention_reinforcement_points: Json | null
          semantic_plan_id: string | null
        }
        Insert: {
          chapters: Json
          cinematic_script: Json
          created_at?: string
          emotional_curve?: Json | null
          emphasis_map?: Json | null
          generated_by_model?: string | null
          id?: string
          narrative_style?: string | null
          pacing_curve?: Json | null
          pacing_hints?: Json | null
          project_id?: string | null
          recovery_insertions?: Json | null
          render_job_id?: string | null
          retention_reinforcement_points?: Json | null
          semantic_plan_id?: string | null
        }
        Update: {
          chapters?: Json
          cinematic_script?: Json
          created_at?: string
          emotional_curve?: Json | null
          emphasis_map?: Json | null
          generated_by_model?: string | null
          id?: string
          narrative_style?: string | null
          pacing_curve?: Json | null
          pacing_hints?: Json | null
          project_id?: string | null
          recovery_insertions?: Json | null
          render_job_id?: string | null
          retention_reinforcement_points?: Json | null
          semantic_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_narrative_scripts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cme_video_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_narrative_scripts_semantic_plan_id_fkey"
            columns: ["semantic_plan_id"]
            isOneToOne: false
            referencedRelation: "cme_semantic_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_neuroanalytics: {
        Row: {
          abandonment_risk: number | null
          cognitive_load: number | null
          created_at: string
          engagement_score: number | null
          fatigue_score: number | null
          generation_id: string | null
          id: string
          retention_prediction: number | null
          user_id: string
        }
        Insert: {
          abandonment_risk?: number | null
          cognitive_load?: number | null
          created_at?: string
          engagement_score?: number | null
          fatigue_score?: number | null
          generation_id?: string | null
          id?: string
          retention_prediction?: number | null
          user_id: string
        }
        Update: {
          abandonment_risk?: number | null
          cognitive_load?: number | null
          created_at?: string
          engagement_score?: number | null
          fatigue_score?: number | null
          generation_id?: string | null
          id?: string
          retention_prediction?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_neuroanalytics_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "cme_video_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_overlay_clusters: {
        Row: {
          block_id: string | null
          cluster_data: Json
          created_at: string | null
          id: string
        }
        Insert: {
          block_id?: string | null
          cluster_data: Json
          created_at?: string | null
          id?: string
        }
        Update: {
          block_id?: string | null
          cluster_data?: Json
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_overlay_clusters_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "cme_lesson_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_pipeline_events: {
        Row: {
          aggregation_id: string | null
          created_at: string
          error_message: string | null
          id: string
          latency_ms: number | null
          message: string | null
          metadata: Json | null
          progress: number | null
          project_id: string | null
          render_job_id: string | null
          stage: string
          status: string
          user_id: string | null
          worker_id: string | null
        }
        Insert: {
          aggregation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          message?: string | null
          metadata?: Json | null
          progress?: number | null
          project_id?: string | null
          render_job_id?: string | null
          stage: string
          status: string
          user_id?: string | null
          worker_id?: string | null
        }
        Update: {
          aggregation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          message?: string | null
          metadata?: Json | null
          progress?: number | null
          project_id?: string | null
          render_job_id?: string | null
          stage?: string
          status?: string
          user_id?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_pipeline_events_aggregation_id_fkey"
            columns: ["aggregation_id"]
            isOneToOne: false
            referencedRelation: "cme_session_aggregation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_pipeline_events_aggregation_id_fkey"
            columns: ["aggregation_id"]
            isOneToOne: false
            referencedRelation: "cme_session_aggregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_pipeline_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cme_video_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_pipeline_events_render_job_id_fkey"
            columns: ["render_job_id"]
            isOneToOne: false
            referencedRelation: "cme_render_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_pipeline_snapshots: {
        Row: {
          created_at: string | null
          id: string
          render_job_id: string | null
          state_data: Json
          step_name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          render_job_id?: string | null
          state_data: Json
          step_name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          render_job_id?: string | null
          state_data?: Json
          step_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_pipeline_snapshots_render_job_id_fkey"
            columns: ["render_job_id"]
            isOneToOne: false
            referencedRelation: "cme_render_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_pipeline_stages: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          name: string
          retry_policy_id: string | null
          timeout_seconds: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          display_order: number
          id?: string
          name: string
          retry_policy_id?: string | null
          timeout_seconds?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          name?: string
          retry_policy_id?: string | null
          timeout_seconds?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_pipeline_stages_retry_policy_id_fkey"
            columns: ["retry_policy_id"]
            isOneToOne: false
            referencedRelation: "cme_retry_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_playback_audit_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          load_time_ms: number | null
          media_status: string | null
          player_state: string | null
          selected_url: string | null
          user_id: string | null
          video_lesson_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          load_time_ms?: number | null
          media_status?: string | null
          player_state?: string | null
          selected_url?: string | null
          user_id?: string | null
          video_lesson_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          load_time_ms?: number | null
          media_status?: string | null
          player_state?: string | null
          selected_url?: string | null
          user_id?: string | null
          video_lesson_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_playback_audit_logs_video_lesson_id_fkey"
            columns: ["video_lesson_id"]
            isOneToOne: false
            referencedRelation: "ai_video_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_playback_hotspots: {
        Row: {
          abandon_density: number | null
          fatigue_density: number | null
          friction_score: number | null
          generated_at: string
          hotspot_type: string
          id: string
          lesson_id: string | null
          quiz_error_density: number | null
          replay_density: number | null
          retention_drop: number | null
          segment_id: string | null
          tutor_density: number | null
        }
        Insert: {
          abandon_density?: number | null
          fatigue_density?: number | null
          friction_score?: number | null
          generated_at?: string
          hotspot_type: string
          id?: string
          lesson_id?: string | null
          quiz_error_density?: number | null
          replay_density?: number | null
          retention_drop?: number | null
          segment_id?: string | null
          tutor_density?: number | null
        }
        Update: {
          abandon_density?: number | null
          fatigue_density?: number | null
          friction_score?: number | null
          generated_at?: string
          hotspot_type?: string
          id?: string
          lesson_id?: string | null
          quiz_error_density?: number | null
          replay_density?: number | null
          retention_drop?: number | null
          segment_id?: string | null
          tutor_density?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_playback_hotspots_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_playback_segments: {
        Row: {
          created_at: string
          end_time: number
          id: string
          project_id: string
          segment_index: number
          start_time: number
          status: string | null
          thumbnail_url: string | null
          title: string | null
          transcript: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          end_time: number
          id?: string
          project_id: string
          segment_index: number
          start_time: number
          status?: string | null
          thumbnail_url?: string | null
          title?: string | null
          transcript?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          end_time?: number
          id?: string
          project_id?: string
          segment_index?: number
          start_time?: number
          status?: string | null
          thumbnail_url?: string | null
          title?: string | null
          transcript?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_playback_segments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cme_video_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_playback_sessions: {
        Row: {
          created_at: string | null
          device_info: Json | null
          id: string
          is_completed: boolean | null
          last_position_seconds: number | null
          render_job_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: Json | null
          id?: string
          is_completed?: boolean | null
          last_position_seconds?: number | null
          render_job_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: Json | null
          id?: string
          is_completed?: boolean | null
          last_position_seconds?: number | null
          render_job_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_playback_sessions_render_job_id_fkey"
            columns: ["render_job_id"]
            isOneToOne: false
            referencedRelation: "cme_render_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_quality_analysis: {
        Row: {
          analysis_payload: Json | null
          continuity_score: number | null
          created_at: string | null
          drift_probability: number | null
          fatigue_score: number | null
          id: string
          is_safe_for_publication: boolean | null
          overload_score: number | null
          quality_score: number
          retention_projection: number | null
          video_lesson_id: string | null
        }
        Insert: {
          analysis_payload?: Json | null
          continuity_score?: number | null
          created_at?: string | null
          drift_probability?: number | null
          fatigue_score?: number | null
          id?: string
          is_safe_for_publication?: boolean | null
          overload_score?: number | null
          quality_score: number
          retention_projection?: number | null
          video_lesson_id?: string | null
        }
        Update: {
          analysis_payload?: Json | null
          continuity_score?: number | null
          created_at?: string | null
          drift_probability?: number | null
          fatigue_score?: number | null
          id?: string
          is_safe_for_publication?: boolean | null
          overload_score?: number | null
          quality_score?: number
          retention_projection?: number | null
          video_lesson_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_quality_analysis_video_lesson_id_fkey"
            columns: ["video_lesson_id"]
            isOneToOne: false
            referencedRelation: "ai_video_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_quality_reviews: {
        Row: {
          aggregation_id: string | null
          approved: boolean | null
          continuity_score: number | null
          created_at: string | null
          drift_score: number | null
          fatigue_score: number | null
          id: string
          narrative_score: number | null
          pacing_score: number | null
          quality_score: number | null
          review_notes: string | null
          reviewer_id: string | null
        }
        Insert: {
          aggregation_id?: string | null
          approved?: boolean | null
          continuity_score?: number | null
          created_at?: string | null
          drift_score?: number | null
          fatigue_score?: number | null
          id?: string
          narrative_score?: number | null
          pacing_score?: number | null
          quality_score?: number | null
          review_notes?: string | null
          reviewer_id?: string | null
        }
        Update: {
          aggregation_id?: string | null
          approved?: boolean | null
          continuity_score?: number | null
          created_at?: string | null
          drift_score?: number | null
          fatigue_score?: number | null
          id?: string
          narrative_score?: number | null
          pacing_score?: number | null
          quality_score?: number | null
          review_notes?: string | null
          reviewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_quality_reviews_aggregation_id_fkey"
            columns: ["aggregation_id"]
            isOneToOne: false
            referencedRelation: "cme_session_aggregation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_quality_reviews_aggregation_id_fkey"
            columns: ["aggregation_id"]
            isOneToOne: false
            referencedRelation: "cme_session_aggregations"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_queue_priorities: {
        Row: {
          created_at: string | null
          id: string
          name: string
          sla_seconds: number | null
          weight: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          sla_seconds?: number | null
          weight?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          sla_seconds?: number | null
          weight?: number
        }
        Relationships: []
      }
      cme_recovery_actions: {
        Row: {
          action_type: string
          created_at: string | null
          id: string
          metadata: Json | null
          reason: string
          render_job_id: string
          status: string
        }
        Insert: {
          action_type: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          reason: string
          render_job_id: string
          status: string
        }
        Update: {
          action_type?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          reason?: string
          render_job_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_recovery_actions_render_job_id_fkey"
            columns: ["render_job_id"]
            isOneToOne: false
            referencedRelation: "cme_render_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_recovery_runs: {
        Row: {
          created_at: string | null
          id: string
          incident_id: string | null
          recovery_strategy: string | null
          render_job_id: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          incident_id?: string | null
          recovery_strategy?: string | null
          render_job_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          incident_id?: string | null
          recovery_strategy?: string | null
          render_job_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_recovery_runs_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "cme_system_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_recovery_runs_render_job_id_fkey"
            columns: ["render_job_id"]
            isOneToOne: false
            referencedRelation: "cme_render_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_reference_uploads: {
        Row: {
          analysis_logs: Json | null
          created_at: string
          file_path: string
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          original_filename: string | null
          pedagogical_goal: string | null
          reference_id: string | null
          specialty: string | null
          updated_at: string
          upload_status: string | null
          uploader_id: string | null
        }
        Insert: {
          analysis_logs?: Json | null
          created_at?: string
          file_path: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          pedagogical_goal?: string | null
          reference_id?: string | null
          specialty?: string | null
          updated_at?: string
          upload_status?: string | null
          uploader_id?: string | null
        }
        Update: {
          analysis_logs?: Json | null
          created_at?: string
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          pedagogical_goal?: string | null
          reference_id?: string | null
          specialty?: string | null
          updated_at?: string
          upload_status?: string | null
          uploader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_reference_uploads_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "cme_cinematic_reference_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_regression_tests: {
        Row: {
          browser_metadata: Json | null
          created_at: string | null
          error_details: string | null
          id: string
          latency_ms: number | null
          status: string
          test_type: string
          video_lesson_id: string | null
        }
        Insert: {
          browser_metadata?: Json | null
          created_at?: string | null
          error_details?: string | null
          id?: string
          latency_ms?: number | null
          status: string
          test_type: string
          video_lesson_id?: string | null
        }
        Update: {
          browser_metadata?: Json | null
          created_at?: string | null
          error_details?: string | null
          id?: string
          latency_ms?: number | null
          status?: string
          test_type?: string
          video_lesson_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_regression_tests_video_lesson_id_fkey"
            columns: ["video_lesson_id"]
            isOneToOne: false
            referencedRelation: "ai_video_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_render_chunks: {
        Row: {
          chunk_order: number
          created_at: string
          duration_ms: number | null
          error_log: string | null
          id: string
          output_url: string | null
          render_job_id: string | null
          retry_count: number | null
          scene_id: string | null
          status: string
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          chunk_order: number
          created_at?: string
          duration_ms?: number | null
          error_log?: string | null
          id?: string
          output_url?: string | null
          render_job_id?: string | null
          retry_count?: number | null
          scene_id?: string | null
          status?: string
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          chunk_order?: number
          created_at?: string
          duration_ms?: number | null
          error_log?: string | null
          id?: string
          output_url?: string | null
          render_job_id?: string | null
          retry_count?: number | null
          scene_id?: string | null
          status?: string
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_render_chunks_render_job_id_fkey"
            columns: ["render_job_id"]
            isOneToOne: false
            referencedRelation: "cme_render_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_render_chunks_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "cme_scene_graphs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_render_chunks_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "cme_gpu_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_render_cluster_metrics: {
        Row: {
          active_jobs: number | null
          created_at: string | null
          gpu_temperature: number | null
          id: string
          queue_pressure: number | null
          render_latency_ms: number | null
          thermal_state: string | null
          vram_usage_mb: number | null
          worker_id: string | null
        }
        Insert: {
          active_jobs?: number | null
          created_at?: string | null
          gpu_temperature?: number | null
          id?: string
          queue_pressure?: number | null
          render_latency_ms?: number | null
          thermal_state?: string | null
          vram_usage_mb?: number | null
          worker_id?: string | null
        }
        Update: {
          active_jobs?: number | null
          created_at?: string | null
          gpu_temperature?: number | null
          id?: string
          queue_pressure?: number | null
          render_latency_ms?: number | null
          thermal_state?: string | null
          vram_usage_mb?: number | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_render_cluster_metrics_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "cme_gpu_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_render_costs: {
        Row: {
          created_at: string | null
          estimated_cost: number | null
          gpu_minutes: number | null
          id: string
          render_job_id: string
          render_quality: string | null
          worker_id: string | null
        }
        Insert: {
          created_at?: string | null
          estimated_cost?: number | null
          gpu_minutes?: number | null
          id?: string
          render_job_id: string
          render_quality?: string | null
          worker_id?: string | null
        }
        Update: {
          created_at?: string | null
          estimated_cost?: number | null
          gpu_minutes?: number | null
          id?: string
          render_job_id?: string
          render_quality?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_render_costs_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "cme_worker_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_render_failures: {
        Row: {
          auto_fix_applied: boolean | null
          created_at: string
          failure_type: string
          gpu_worker_id: string | null
          id: string
          job_id: string | null
          recovery_attempt: number | null
          recovery_logs: Json | null
          recovery_strategy: string | null
          render_stage: string
          rerender_parent_job_id: string | null
          rerender_reason: string | null
          stack_trace: string | null
        }
        Insert: {
          auto_fix_applied?: boolean | null
          created_at?: string
          failure_type: string
          gpu_worker_id?: string | null
          id?: string
          job_id?: string | null
          recovery_attempt?: number | null
          recovery_logs?: Json | null
          recovery_strategy?: string | null
          render_stage: string
          rerender_parent_job_id?: string | null
          rerender_reason?: string | null
          stack_trace?: string | null
        }
        Update: {
          auto_fix_applied?: boolean | null
          created_at?: string
          failure_type?: string
          gpu_worker_id?: string | null
          id?: string
          job_id?: string | null
          recovery_attempt?: number | null
          recovery_logs?: Json | null
          recovery_strategy?: string | null
          render_stage?: string
          rerender_parent_job_id?: string | null
          rerender_reason?: string | null
          stack_trace?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_render_failures_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "cme_render_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_render_jobs: {
        Row: {
          adaptive_profile_snapshot: Json | null
          adaptive_variant: string | null
          aggregation_id: string | null
          chapter_manifest: Json | null
          chunk_composition_status: string | null
          cinematic_quality_score: number | null
          cinematic_score: number | null
          completed_at: string | null
          config: Json | null
          director_ai_id: string | null
          distributed_chunks: number | null
          estimated_cost_cents: number | null
          estimated_vram_mb: number | null
          failed_at: string | null
          generation_id: string | null
          gpu_required: boolean | null
          gpu_worker_id: string | null
          id: string
          idempotency_key: string | null
          output_url: string | null
          pacing_efficiency_score: number | null
          parent_job_id: string | null
          pipeline_last_error: string | null
          preview_url: string | null
          priority: number | null
          priority_score: number | null
          progress: number | null
          project_id: string | null
          queue_id: string | null
          queued_at: string
          reference_profile_id: string | null
          render_checkpoints: Json | null
          render_duration_ms: number | null
          render_lineage: Json | null
          render_metadata: Json | null
          render_mode: string | null
          render_stage: string | null
          render_type: string
          retention_projection: number | null
          retry_count: number | null
          started_at: string | null
          started_rendering_at: string | null
          status: string
          thumbnail_url: string | null
          updated_at: string
          user_id: string | null
          variant_type: string | null
          visual_grammar_id: string | null
          voice_profile_id: string | null
          vram_usage: number | null
          worker_selection_score: Json | null
        }
        Insert: {
          adaptive_profile_snapshot?: Json | null
          adaptive_variant?: string | null
          aggregation_id?: string | null
          chapter_manifest?: Json | null
          chunk_composition_status?: string | null
          cinematic_quality_score?: number | null
          cinematic_score?: number | null
          completed_at?: string | null
          config?: Json | null
          director_ai_id?: string | null
          distributed_chunks?: number | null
          estimated_cost_cents?: number | null
          estimated_vram_mb?: number | null
          failed_at?: string | null
          generation_id?: string | null
          gpu_required?: boolean | null
          gpu_worker_id?: string | null
          id?: string
          idempotency_key?: string | null
          output_url?: string | null
          pacing_efficiency_score?: number | null
          parent_job_id?: string | null
          pipeline_last_error?: string | null
          preview_url?: string | null
          priority?: number | null
          priority_score?: number | null
          progress?: number | null
          project_id?: string | null
          queue_id?: string | null
          queued_at?: string
          reference_profile_id?: string | null
          render_checkpoints?: Json | null
          render_duration_ms?: number | null
          render_lineage?: Json | null
          render_metadata?: Json | null
          render_mode?: string | null
          render_stage?: string | null
          render_type: string
          retention_projection?: number | null
          retry_count?: number | null
          started_at?: string | null
          started_rendering_at?: string | null
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string | null
          variant_type?: string | null
          visual_grammar_id?: string | null
          voice_profile_id?: string | null
          vram_usage?: number | null
          worker_selection_score?: Json | null
        }
        Update: {
          adaptive_profile_snapshot?: Json | null
          adaptive_variant?: string | null
          aggregation_id?: string | null
          chapter_manifest?: Json | null
          chunk_composition_status?: string | null
          cinematic_quality_score?: number | null
          cinematic_score?: number | null
          completed_at?: string | null
          config?: Json | null
          director_ai_id?: string | null
          distributed_chunks?: number | null
          estimated_cost_cents?: number | null
          estimated_vram_mb?: number | null
          failed_at?: string | null
          generation_id?: string | null
          gpu_required?: boolean | null
          gpu_worker_id?: string | null
          id?: string
          idempotency_key?: string | null
          output_url?: string | null
          pacing_efficiency_score?: number | null
          parent_job_id?: string | null
          pipeline_last_error?: string | null
          preview_url?: string | null
          priority?: number | null
          priority_score?: number | null
          progress?: number | null
          project_id?: string | null
          queue_id?: string | null
          queued_at?: string
          reference_profile_id?: string | null
          render_checkpoints?: Json | null
          render_duration_ms?: number | null
          render_lineage?: Json | null
          render_metadata?: Json | null
          render_mode?: string | null
          render_stage?: string | null
          render_type?: string
          retention_projection?: number | null
          retry_count?: number | null
          started_at?: string | null
          started_rendering_at?: string | null
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string | null
          variant_type?: string | null
          visual_grammar_id?: string | null
          voice_profile_id?: string | null
          vram_usage?: number | null
          worker_selection_score?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_render_jobs_aggregation_id_fkey"
            columns: ["aggregation_id"]
            isOneToOne: false
            referencedRelation: "cme_session_aggregation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_render_jobs_aggregation_id_fkey"
            columns: ["aggregation_id"]
            isOneToOne: false
            referencedRelation: "cme_session_aggregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_render_jobs_gpu_worker_id_fkey"
            columns: ["gpu_worker_id"]
            isOneToOne: false
            referencedRelation: "cme_gpu_workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_render_jobs_parent_job_id_fkey"
            columns: ["parent_job_id"]
            isOneToOne: false
            referencedRelation: "cme_render_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_render_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cme_video_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_render_jobs_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "cme_render_queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_render_jobs_reference_profile_id_fkey"
            columns: ["reference_profile_id"]
            isOneToOne: false
            referencedRelation: "cme_cinematic_reference_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_render_jobs_visual_grammar_id_fkey"
            columns: ["visual_grammar_id"]
            isOneToOne: false
            referencedRelation: "cme_visual_grammar_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_render_jobs_voice_profile_id_fkey"
            columns: ["voice_profile_id"]
            isOneToOne: false
            referencedRelation: "cme_voice_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_render_lineage: {
        Row: {
          aggregation_id: string | null
          created_at: string | null
          id: string
          output_url: string | null
          parent_render_id: string | null
          render_job_id: string | null
          scene_graph_id: string | null
          variant_id: string | null
        }
        Insert: {
          aggregation_id?: string | null
          created_at?: string | null
          id?: string
          output_url?: string | null
          parent_render_id?: string | null
          render_job_id?: string | null
          scene_graph_id?: string | null
          variant_id?: string | null
        }
        Update: {
          aggregation_id?: string | null
          created_at?: string | null
          id?: string
          output_url?: string | null
          parent_render_id?: string | null
          render_job_id?: string | null
          scene_graph_id?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_render_lineage_aggregation_id_fkey"
            columns: ["aggregation_id"]
            isOneToOne: false
            referencedRelation: "cme_session_aggregation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_render_lineage_aggregation_id_fkey"
            columns: ["aggregation_id"]
            isOneToOne: false
            referencedRelation: "cme_session_aggregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_render_lineage_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "cme_session_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_render_outputs: {
        Row: {
          codec: string | null
          created_at: string | null
          duration_seconds: number | null
          file_size_bytes: number | null
          hls_manifest_url: string | null
          id: string
          metadata: Json | null
          output_type: string
          output_url: string
          render_job_id: string | null
          render_quality_score: number | null
          resolution: string | null
        }
        Insert: {
          codec?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          hls_manifest_url?: string | null
          id?: string
          metadata?: Json | null
          output_type: string
          output_url: string
          render_job_id?: string | null
          render_quality_score?: number | null
          resolution?: string | null
        }
        Update: {
          codec?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          hls_manifest_url?: string | null
          id?: string
          metadata?: Json | null
          output_type?: string
          output_url?: string
          render_job_id?: string | null
          render_quality_score?: number | null
          resolution?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_render_outputs_render_job_id_fkey"
            columns: ["render_job_id"]
            isOneToOne: false
            referencedRelation: "cme_render_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_render_queues: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_paused: boolean | null
          max_concurrency: number | null
          name: string
          priority_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_paused?: boolean | null
          max_concurrency?: number | null
          name: string
          priority_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_paused?: boolean | null
          max_concurrency?: number | null
          name?: string
          priority_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_render_queues_priority_id_fkey"
            columns: ["priority_id"]
            isOneToOne: false
            referencedRelation: "cme_queue_priorities"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_render_segments: {
        Row: {
          chapter_number: number | null
          created_at: string | null
          duration_seconds: number | null
          end_time: number | null
          id: string
          playback_url: string | null
          render_job_id: string
          start_time: number | null
          status: string | null
        }
        Insert: {
          chapter_number?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          end_time?: number | null
          id?: string
          playback_url?: string | null
          render_job_id: string
          start_time?: number | null
          status?: string | null
        }
        Update: {
          chapter_number?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          end_time?: number | null
          id?: string
          playback_url?: string | null
          render_job_id?: string
          start_time?: number | null
          status?: string | null
        }
        Relationships: []
      }
      cme_resume_points: {
        Row: {
          checkpoint_data: Json
          created_at: string | null
          id: string
          render_job_id: string
          stage_id: string
        }
        Insert: {
          checkpoint_data: Json
          created_at?: string | null
          id?: string
          render_job_id: string
          stage_id: string
        }
        Update: {
          checkpoint_data?: Json
          created_at?: string | null
          id?: string
          render_job_id?: string
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_resume_points_render_job_id_fkey"
            columns: ["render_job_id"]
            isOneToOne: false
            referencedRelation: "cme_render_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_resume_points_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "cme_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_retry_attempts: {
        Row: {
          attempt_number: number
          created_at: string | null
          error_received: string | null
          id: string
          job_id: string
          next_retry_at: string | null
          policy_id: string | null
          strategy_used: string | null
        }
        Insert: {
          attempt_number: number
          created_at?: string | null
          error_received?: string | null
          id?: string
          job_id: string
          next_retry_at?: string | null
          policy_id?: string | null
          strategy_used?: string | null
        }
        Update: {
          attempt_number?: number
          created_at?: string | null
          error_received?: string | null
          id?: string
          job_id?: string
          next_retry_at?: string | null
          policy_id?: string | null
          strategy_used?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_retry_attempts_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "cme_retry_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_retry_policies: {
        Row: {
          backoff_factor: number | null
          created_at: string | null
          id: string
          initial_delay_sec: number | null
          max_retries: number | null
          name: string | null
        }
        Insert: {
          backoff_factor?: number | null
          created_at?: string | null
          id?: string
          initial_delay_sec?: number | null
          max_retries?: number | null
          name?: string | null
        }
        Update: {
          backoff_factor?: number | null
          created_at?: string | null
          id?: string
          initial_delay_sec?: number | null
          max_retries?: number | null
          name?: string | null
        }
        Relationships: []
      }
      cme_scene_graph_nodes: {
        Row: {
          cognitive_intensity: number | null
          created_at: string | null
          end_second: number
          id: string
          is_active: boolean | null
          node_type: string
          payload: Json | null
          reinforcement_type: string | null
          render_payload: Json
          scene_graph_id: string | null
          semantic_role: string | null
          sequence_order: number | null
          start_second: number
          title: string | null
          transition_profile: string | null
          user_id: string | null
        }
        Insert: {
          cognitive_intensity?: number | null
          created_at?: string | null
          end_second: number
          id?: string
          is_active?: boolean | null
          node_type: string
          payload?: Json | null
          reinforcement_type?: string | null
          render_payload: Json
          scene_graph_id?: string | null
          semantic_role?: string | null
          sequence_order?: number | null
          start_second: number
          title?: string | null
          transition_profile?: string | null
          user_id?: string | null
        }
        Update: {
          cognitive_intensity?: number | null
          created_at?: string | null
          end_second?: number
          id?: string
          is_active?: boolean | null
          node_type?: string
          payload?: Json | null
          reinforcement_type?: string | null
          render_payload?: Json
          scene_graph_id?: string | null
          semantic_role?: string | null
          sequence_order?: number | null
          start_second?: number
          title?: string | null
          transition_profile?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_scene_graph_nodes_scene_graph_id_fkey"
            columns: ["scene_graph_id"]
            isOneToOne: false
            referencedRelation: "cme_scene_graphs"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_scene_graphs: {
        Row: {
          animation_type: string | null
          attention_curve: Json | null
          cognitive_load_level: string | null
          created_at: string
          error_message: string | null
          estimated_duration_seconds: number | null
          focus_elements: Json | null
          focus_graph: Json | null
          graph_payload: Json | null
          id: string
          job_id: string | null
          medical_concept: string | null
          metadata: Json | null
          motion_graph: Json | null
          narrative_script_id: string | null
          overlay_graph: Json | null
          render_priority: number | null
          scene_graph: Json
          scene_order: number | null
          scene_type: string | null
          semantic_plan_id: string | null
          session_id: string | null
          status: string | null
          title: string | null
          transition_type: string | null
          updated_at: string | null
          user_id: string | null
          video_lesson_id: string | null
          video_project_id: string | null
          visual_attention_map: Json | null
          visual_goal: string | null
        }
        Insert: {
          animation_type?: string | null
          attention_curve?: Json | null
          cognitive_load_level?: string | null
          created_at?: string
          error_message?: string | null
          estimated_duration_seconds?: number | null
          focus_elements?: Json | null
          focus_graph?: Json | null
          graph_payload?: Json | null
          id?: string
          job_id?: string | null
          medical_concept?: string | null
          metadata?: Json | null
          motion_graph?: Json | null
          narrative_script_id?: string | null
          overlay_graph?: Json | null
          render_priority?: number | null
          scene_graph?: Json
          scene_order?: number | null
          scene_type?: string | null
          semantic_plan_id?: string | null
          session_id?: string | null
          status?: string | null
          title?: string | null
          transition_type?: string | null
          updated_at?: string | null
          user_id?: string | null
          video_lesson_id?: string | null
          video_project_id?: string | null
          visual_attention_map?: Json | null
          visual_goal?: string | null
        }
        Update: {
          animation_type?: string | null
          attention_curve?: Json | null
          cognitive_load_level?: string | null
          created_at?: string
          error_message?: string | null
          estimated_duration_seconds?: number | null
          focus_elements?: Json | null
          focus_graph?: Json | null
          graph_payload?: Json | null
          id?: string
          job_id?: string | null
          medical_concept?: string | null
          metadata?: Json | null
          motion_graph?: Json | null
          narrative_script_id?: string | null
          overlay_graph?: Json | null
          render_priority?: number | null
          scene_graph?: Json
          scene_order?: number | null
          scene_type?: string | null
          semantic_plan_id?: string | null
          session_id?: string | null
          status?: string | null
          title?: string | null
          transition_type?: string | null
          updated_at?: string | null
          user_id?: string | null
          video_lesson_id?: string | null
          video_project_id?: string | null
          visual_attention_map?: Json | null
          visual_goal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_scene_graphs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "cme_render_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_scene_graphs_narrative_script_id_fkey"
            columns: ["narrative_script_id"]
            isOneToOne: false
            referencedRelation: "cme_narrative_scripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_scene_graphs_semantic_plan_id_fkey"
            columns: ["semantic_plan_id"]
            isOneToOne: false
            referencedRelation: "cme_semantic_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_scene_graphs_video_lesson_id_fkey"
            columns: ["video_lesson_id"]
            isOneToOne: false
            referencedRelation: "ai_video_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_scene_graphs_video_project_id_fkey"
            columns: ["video_project_id"]
            isOneToOne: false
            referencedRelation: "cme_video_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_scene_transitions: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          from_node_id: string | null
          id: string
          to_node_id: string | null
          transition_type: string
        }
        Insert: {
          created_at?: string | null
          duration_ms?: number | null
          from_node_id?: string | null
          id?: string
          to_node_id?: string | null
          transition_type: string
        }
        Update: {
          created_at?: string | null
          duration_ms?: number | null
          from_node_id?: string | null
          id?: string
          to_node_id?: string | null
          transition_type?: string
        }
        Relationships: []
      }
      cme_semantic_plans: {
        Row: {
          clinical_priority_points: string[] | null
          clinical_reasoning_flow: Json | null
          cognitive_difficulty_map: Json | null
          concept_map: Json | null
          created_at: string
          exam_priority_points: string[] | null
          id: string
          narrative_priority_map: Json | null
          pathology_connections: Json | null
          pharmacology_connections: Json | null
          physiology_connections: Json | null
          prerequisite_graph: Json | null
          project_id: string | null
          render_job_id: string | null
          retention_hotspots: Json | null
          semantic_focus_windows: Json | null
          semantic_outline: Json
          specialty: string | null
          subtopic: string | null
          topic: string | null
          updated_at: string | null
        }
        Insert: {
          clinical_priority_points?: string[] | null
          clinical_reasoning_flow?: Json | null
          cognitive_difficulty_map?: Json | null
          concept_map?: Json | null
          created_at?: string
          exam_priority_points?: string[] | null
          id?: string
          narrative_priority_map?: Json | null
          pathology_connections?: Json | null
          pharmacology_connections?: Json | null
          physiology_connections?: Json | null
          prerequisite_graph?: Json | null
          project_id?: string | null
          render_job_id?: string | null
          retention_hotspots?: Json | null
          semantic_focus_windows?: Json | null
          semantic_outline: Json
          specialty?: string | null
          subtopic?: string | null
          topic?: string | null
          updated_at?: string | null
        }
        Update: {
          clinical_priority_points?: string[] | null
          clinical_reasoning_flow?: Json | null
          cognitive_difficulty_map?: Json | null
          concept_map?: Json | null
          created_at?: string
          exam_priority_points?: string[] | null
          id?: string
          narrative_priority_map?: Json | null
          pathology_connections?: Json | null
          pharmacology_connections?: Json | null
          physiology_connections?: Json | null
          prerequisite_graph?: Json | null
          project_id?: string | null
          render_job_id?: string | null
          retention_hotspots?: Json | null
          semantic_focus_windows?: Json | null
          semantic_outline?: Json
          specialty?: string | null
          subtopic?: string | null
          topic?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_semantic_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cme_video_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_session_aggregations: {
        Row: {
          aggregated_content: string
          aggregation_status:
            | Database["public"]["Enums"]["cme_aggregation_status"]
            | null
          cognitive_density: number | null
          completed_at: string | null
          created_at: string
          detected_specialties: Json | null
          detected_topics: string[] | null
          error_message: string | null
          estimated_duration: number | null
          estimated_duration_seconds: number | null
          id: string
          is_manual_upload: boolean | null
          manual_video_url: string | null
          metadata: Json | null
          narrative_density: number | null
          pipeline_last_error: string | null
          source_conversation_id: string | null
          started_at: string | null
          status: string | null
          title: string | null
          total_blocks: number | null
          tutor_session_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          aggregated_content: string
          aggregation_status?:
            | Database["public"]["Enums"]["cme_aggregation_status"]
            | null
          cognitive_density?: number | null
          completed_at?: string | null
          created_at?: string
          detected_specialties?: Json | null
          detected_topics?: string[] | null
          error_message?: string | null
          estimated_duration?: number | null
          estimated_duration_seconds?: number | null
          id?: string
          is_manual_upload?: boolean | null
          manual_video_url?: string | null
          metadata?: Json | null
          narrative_density?: number | null
          pipeline_last_error?: string | null
          source_conversation_id?: string | null
          started_at?: string | null
          status?: string | null
          title?: string | null
          total_blocks?: number | null
          tutor_session_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          aggregated_content?: string
          aggregation_status?:
            | Database["public"]["Enums"]["cme_aggregation_status"]
            | null
          cognitive_density?: number | null
          completed_at?: string | null
          created_at?: string
          detected_specialties?: Json | null
          detected_topics?: string[] | null
          error_message?: string | null
          estimated_duration?: number | null
          estimated_duration_seconds?: number | null
          id?: string
          is_manual_upload?: boolean | null
          manual_video_url?: string | null
          metadata?: Json | null
          narrative_density?: number | null
          pipeline_last_error?: string | null
          source_conversation_id?: string | null
          started_at?: string | null
          status?: string | null
          title?: string | null
          total_blocks?: number | null
          tutor_session_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_session_aggregations_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_session_aggregations_tutor_session_id_fkey"
            columns: ["tutor_session_id"]
            isOneToOne: false
            referencedRelation: "tutor_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_session_variants: {
        Row: {
          aggregation_id: string | null
          cognitive_density: number | null
          created_at: string | null
          id: string
          pacing_profile: Json | null
          retention_projection: number | null
          target_duration: number | null
          variant_type: string
          voice_profile: string | null
        }
        Insert: {
          aggregation_id?: string | null
          cognitive_density?: number | null
          created_at?: string | null
          id?: string
          pacing_profile?: Json | null
          retention_projection?: number | null
          target_duration?: number | null
          variant_type: string
          voice_profile?: string | null
        }
        Update: {
          aggregation_id?: string | null
          cognitive_density?: number | null
          created_at?: string | null
          id?: string
          pacing_profile?: Json | null
          retention_projection?: number | null
          target_duration?: number | null
          variant_type?: string
          voice_profile?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_session_variants_aggregation_id_fkey"
            columns: ["aggregation_id"]
            isOneToOne: false
            referencedRelation: "cme_session_aggregation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_session_variants_aggregation_id_fkey"
            columns: ["aggregation_id"]
            isOneToOne: false
            referencedRelation: "cme_session_aggregations"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_stage_executions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          metrics: Json | null
          output_data: Json | null
          render_job_id: string
          stage_id: string
          started_at: string | null
          status: string
          worker_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          metrics?: Json | null
          output_data?: Json | null
          render_job_id: string
          stage_id: string
          started_at?: string | null
          status: string
          worker_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          metrics?: Json | null
          output_data?: Json | null
          render_job_id?: string
          stage_id?: string
          started_at?: string | null
          status?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_stage_executions_render_job_id_fkey"
            columns: ["render_job_id"]
            isOneToOne: false
            referencedRelation: "cme_render_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_stage_executions_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "cme_pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_stage_executions_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "cme_worker_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_stage_failures: {
        Row: {
          created_at: string | null
          error_code: string
          error_message: string
          id: string
          is_retryable: boolean | null
          stack_trace: string | null
          stage_execution_id: string
        }
        Insert: {
          created_at?: string | null
          error_code: string
          error_message: string
          id?: string
          is_retryable?: boolean | null
          stack_trace?: string | null
          stage_execution_id: string
        }
        Update: {
          created_at?: string | null
          error_code?: string
          error_message?: string
          id?: string
          is_retryable?: boolean | null
          stack_trace?: string | null
          stage_execution_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_stage_failures_stage_execution_id_fkey"
            columns: ["stage_execution_id"]
            isOneToOne: false
            referencedRelation: "cme_stage_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_streaming_sessions: {
        Row: {
          bitrate_preference: string | null
          created_at: string
          device_info: Json | null
          id: string
          is_active: boolean | null
          last_position: number | null
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bitrate_preference?: string | null
          created_at?: string
          device_info?: Json | null
          id?: string
          is_active?: boolean | null
          last_position?: number | null
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bitrate_preference?: string | null
          created_at?: string
          device_info?: Json | null
          id?: string
          is_active?: boolean | null
          last_position?: number | null
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_streaming_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cme_video_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_system_incidents: {
        Row: {
          component: string
          created_at: string | null
          error_code: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          resolved: boolean | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["cme_incident_severity"] | null
          stack_trace: string | null
          user_id: string | null
        }
        Insert: {
          component: string
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          resolved?: boolean | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["cme_incident_severity"] | null
          stack_trace?: string | null
          user_id?: string | null
        }
        Update: {
          component?: string
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          resolved?: boolean | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["cme_incident_severity"] | null
          stack_trace?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cme_timeline_clips: {
        Row: {
          created_at: string | null
          duration: number | null
          id: string
          offset_time: number | null
          properties: Json | null
          source_node_id: string | null
          start_time: number | null
          track_id: string | null
        }
        Insert: {
          created_at?: string | null
          duration?: number | null
          id?: string
          offset_time?: number | null
          properties?: Json | null
          source_node_id?: string | null
          start_time?: number | null
          track_id?: string | null
        }
        Update: {
          created_at?: string | null
          duration?: number | null
          id?: string
          offset_time?: number | null
          properties?: Json | null
          source_node_id?: string | null
          start_time?: number | null
          track_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_timeline_clips_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "cme_timeline_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_timeline_tracks: {
        Row: {
          created_at: string | null
          id: string
          is_locked: boolean | null
          is_muted: boolean | null
          order_index: number | null
          scene_graph_id: string
          track_name: string | null
          track_type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          is_muted?: boolean | null
          order_index?: number | null
          scene_graph_id: string
          track_name?: string | null
          track_type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          is_muted?: boolean | null
          order_index?: number | null
          scene_graph_id?: string
          track_name?: string | null
          track_type?: string | null
        }
        Relationships: []
      }
      cme_tutor_origins: {
        Row: {
          cme_video_project_id: string | null
          created_at: string
          id: string
          lesson_id: string | null
          tutor_message_id: string
          tutor_session_id: string
        }
        Insert: {
          cme_video_project_id?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          tutor_message_id: string
          tutor_session_id: string
        }
        Update: {
          cme_video_project_id?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          tutor_message_id?: string
          tutor_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_tutor_origins_cme_video_project_id_fkey"
            columns: ["cme_video_project_id"]
            isOneToOne: false
            referencedRelation: "cme_video_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_v3_feature_flags: {
        Row: {
          is_enabled: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          is_enabled?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          is_enabled?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cme_variant_generation_logs: {
        Row: {
          adaptation_reason: string | null
          created_at: string | null
          fatigue_adjustments: Json | null
          id: string
          narrative_adjustments: Json | null
          pacing_adjustments: Json | null
          reinforcement_adjustments: Json | null
          variant_type: string
          video_lesson_id: string | null
        }
        Insert: {
          adaptation_reason?: string | null
          created_at?: string | null
          fatigue_adjustments?: Json | null
          id?: string
          narrative_adjustments?: Json | null
          pacing_adjustments?: Json | null
          reinforcement_adjustments?: Json | null
          variant_type: string
          video_lesson_id?: string | null
        }
        Update: {
          adaptation_reason?: string | null
          created_at?: string | null
          fatigue_adjustments?: Json | null
          id?: string
          narrative_adjustments?: Json | null
          pacing_adjustments?: Json | null
          reinforcement_adjustments?: Json | null
          variant_type?: string
          video_lesson_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_variant_generation_logs_video_lesson_id_fkey"
            columns: ["video_lesson_id"]
            isOneToOne: false
            referencedRelation: "ai_video_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_video_assets: {
        Row: {
          asset_type: string
          created_at: string
          id: string
          metadata: Json | null
          project_id: string | null
          url: string
        }
        Insert: {
          asset_type: string
          created_at?: string
          id?: string
          metadata?: Json | null
          project_id?: string | null
          url: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          project_id?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_video_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cme_video_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_video_projects: {
        Row: {
          aggregation_id: string | null
          config: Json | null
          created_at: string
          fatigue_risk_score: number | null
          health_score: number | null
          id: string
          lineage_path: string | null
          narrative_coherence_score: number | null
          overload_score: number | null
          quality_ai_metadata: Json | null
          quality_score: number | null
          status: string
          target_audience: string | null
          title: string
          topic_id: string | null
          updated_at: string
          user_id: string | null
          validation_checks: Json | null
        }
        Insert: {
          aggregation_id?: string | null
          config?: Json | null
          created_at?: string
          fatigue_risk_score?: number | null
          health_score?: number | null
          id?: string
          lineage_path?: string | null
          narrative_coherence_score?: number | null
          overload_score?: number | null
          quality_ai_metadata?: Json | null
          quality_score?: number | null
          status?: string
          target_audience?: string | null
          title: string
          topic_id?: string | null
          updated_at?: string
          user_id?: string | null
          validation_checks?: Json | null
        }
        Update: {
          aggregation_id?: string | null
          config?: Json | null
          created_at?: string
          fatigue_risk_score?: number | null
          health_score?: number | null
          id?: string
          lineage_path?: string | null
          narrative_coherence_score?: number | null
          overload_score?: number | null
          quality_ai_metadata?: Json | null
          quality_score?: number | null
          status?: string
          target_audience?: string | null
          title?: string
          topic_id?: string | null
          updated_at?: string
          user_id?: string | null
          validation_checks?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_video_projects_aggregation_id_fkey"
            columns: ["aggregation_id"]
            isOneToOne: false
            referencedRelation: "cme_session_aggregation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_video_projects_aggregation_id_fkey"
            columns: ["aggregation_id"]
            isOneToOne: false
            referencedRelation: "cme_session_aggregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_video_projects_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_viewing_analytics: {
        Row: {
          created_at: string
          id: string
          interaction_type: string | null
          playback_speed: number | null
          project_id: string
          session_id: string | null
          timestamp_end: number | null
          timestamp_start: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interaction_type?: string | null
          playback_speed?: number | null
          project_id: string
          session_id?: string | null
          timestamp_end?: number | null
          timestamp_start?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interaction_type?: string | null
          playback_speed?: number | null
          project_id?: string
          session_id?: string | null
          timestamp_end?: number | null
          timestamp_start?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_viewing_analytics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cme_video_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cme_viewing_analytics_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cme_streaming_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_visual_grammar_profiles: {
        Row: {
          animation_rules: Json | null
          cognitive_density: number | null
          created_at: string | null
          grammar_type: string
          id: string
          motion_profile: string | null
          overlay_density: number | null
          pacing_rules: Json | null
          specialty: string
          transition_profile: string | null
        }
        Insert: {
          animation_rules?: Json | null
          cognitive_density?: number | null
          created_at?: string | null
          grammar_type: string
          id?: string
          motion_profile?: string | null
          overlay_density?: number | null
          pacing_rules?: Json | null
          specialty: string
          transition_profile?: string | null
        }
        Update: {
          animation_rules?: Json | null
          cognitive_density?: number | null
          created_at?: string | null
          grammar_type?: string
          id?: string
          motion_profile?: string | null
          overlay_density?: number | null
          pacing_rules?: Json | null
          specialty?: string
          transition_profile?: string | null
        }
        Relationships: []
      }
      cme_voice_assets: {
        Row: {
          audio_url: string | null
          cognitive_timing_map: Json | null
          created_at: string
          duration_seconds: number | null
          emotional_metadata: Json | null
          id: string
          narration_text: string
          pacing_metadata: Json | null
          provider: string
          render_job_id: string | null
          scene_id: string | null
          ssml_text: string | null
          status: string | null
          voice_id: string
        }
        Insert: {
          audio_url?: string | null
          cognitive_timing_map?: Json | null
          created_at?: string
          duration_seconds?: number | null
          emotional_metadata?: Json | null
          id?: string
          narration_text: string
          pacing_metadata?: Json | null
          provider: string
          render_job_id?: string | null
          scene_id?: string | null
          ssml_text?: string | null
          status?: string | null
          voice_id: string
        }
        Update: {
          audio_url?: string | null
          cognitive_timing_map?: Json | null
          created_at?: string
          duration_seconds?: number | null
          emotional_metadata?: Json | null
          id?: string
          narration_text?: string
          pacing_metadata?: Json | null
          provider?: string
          render_job_id?: string | null
          scene_id?: string | null
          ssml_text?: string | null
          status?: string | null
          voice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_voice_assets_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "cme_scene_graphs"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_voice_profiles: {
        Row: {
          cognitive_load_profile: string | null
          created_at: string | null
          emotional_intensity: number | null
          id: string
          pause_density: number
          profile_name: string
          pronunciation_style: string | null
          reinforcement_style: string | null
          speaking_speed: number
        }
        Insert: {
          cognitive_load_profile?: string | null
          created_at?: string | null
          emotional_intensity?: number | null
          id?: string
          pause_density?: number
          profile_name: string
          pronunciation_style?: string | null
          reinforcement_style?: string | null
          speaking_speed?: number
        }
        Update: {
          cognitive_load_profile?: string | null
          created_at?: string | null
          emotional_intensity?: number | null
          id?: string
          pause_density?: number
          profile_name?: string
          pronunciation_style?: string | null
          reinforcement_style?: string | null
          speaking_speed?: number
        }
        Relationships: []
      }
      cme_worker_draining_events: {
        Row: {
          active_jobs_at_start: number | null
          completed_at: string | null
          created_at: string | null
          id: string
          reason: string | null
          started_at: string | null
          worker_id: string
        }
        Insert: {
          active_jobs_at_start?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          started_at?: string | null
          worker_id: string
        }
        Update: {
          active_jobs_at_start?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          started_at?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cme_worker_draining_events_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "cme_worker_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_worker_failures: {
        Row: {
          created_at: string | null
          error_message: string | null
          failure_type: string | null
          id: string
          job_id: string | null
          stack_trace: string | null
          worker_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          failure_type?: string | null
          id?: string
          job_id?: string | null
          stack_trace?: string | null
          worker_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          failure_type?: string | null
          id?: string
          job_id?: string | null
          stack_trace?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_worker_failures_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "cme_worker_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_worker_heartbeats: {
        Row: {
          active_jobs: number | null
          cpu_usage: number | null
          created_at: string | null
          gpu_temperature: number | null
          gpu_usage: number | null
          id: string
          queue_depth: number | null
          ram_usage: number | null
          vram_total_mb: number | null
          vram_used_mb: number | null
          worker_id: string | null
        }
        Insert: {
          active_jobs?: number | null
          cpu_usage?: number | null
          created_at?: string | null
          gpu_temperature?: number | null
          gpu_usage?: number | null
          id?: string
          queue_depth?: number | null
          ram_usage?: number | null
          vram_total_mb?: number | null
          vram_used_mb?: number | null
          worker_id?: string | null
        }
        Update: {
          active_jobs?: number | null
          cpu_usage?: number | null
          created_at?: string | null
          gpu_temperature?: number | null
          gpu_usage?: number | null
          id?: string
          queue_depth?: number | null
          ram_usage?: number | null
          vram_total_mb?: number | null
          vram_used_mb?: number | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_worker_heartbeats_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "cme_worker_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      cme_worker_nodes: {
        Row: {
          cluster_id: string | null
          created_at: string | null
          drain_mode: boolean | null
          gpu_driver: string | null
          gpu_memory_mb: number | null
          gpu_name: string | null
          gpu_utilization_pct: number | null
          hostname: string
          id: string
          is_draining: boolean | null
          last_heartbeat: string | null
          maintenance_mode: boolean | null
          status: Database["public"]["Enums"]["cme_worker_status"] | null
          temperature_c: number | null
          user_id: string | null
          vram_total_mb: number | null
          vram_used_mb: number | null
          worker_version: string | null
        }
        Insert: {
          cluster_id?: string | null
          created_at?: string | null
          drain_mode?: boolean | null
          gpu_driver?: string | null
          gpu_memory_mb?: number | null
          gpu_name?: string | null
          gpu_utilization_pct?: number | null
          hostname: string
          id?: string
          is_draining?: boolean | null
          last_heartbeat?: string | null
          maintenance_mode?: boolean | null
          status?: Database["public"]["Enums"]["cme_worker_status"] | null
          temperature_c?: number | null
          user_id?: string | null
          vram_total_mb?: number | null
          vram_used_mb?: number | null
          worker_version?: string | null
        }
        Update: {
          cluster_id?: string | null
          created_at?: string | null
          drain_mode?: boolean | null
          gpu_driver?: string | null
          gpu_memory_mb?: number | null
          gpu_name?: string | null
          gpu_utilization_pct?: number | null
          hostname?: string
          id?: string
          is_draining?: boolean | null
          last_heartbeat?: string | null
          maintenance_mode?: boolean | null
          status?: Database["public"]["Enums"]["cme_worker_status"] | null
          temperature_c?: number | null
          user_id?: string | null
          vram_total_mb?: number | null
          vram_used_mb?: number | null
          worker_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cme_worker_nodes_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "cme_gpu_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      cognitive_drift_logs: {
        Row: {
          detected_at: string | null
          drift_type: string
          evidence: Json | null
          id: string
          mitigation_action: string | null
          severity: number | null
          user_id: string
        }
        Insert: {
          detected_at?: string | null
          drift_type: string
          evidence?: Json | null
          id?: string
          mitigation_action?: string | null
          severity?: number | null
          user_id: string
        }
        Update: {
          detected_at?: string | null
          drift_type?: string
          evidence?: Json | null
          id?: string
          mitigation_action?: string | null
          severity?: number | null
          user_id?: string
        }
        Relationships: []
      }
      cognitive_rhythm_snapshots: {
        Row: {
          avg_accuracy: number | null
          avg_fatigue_index: number | null
          avg_stress_index: number | null
          day_of_week: number | null
          hour_of_day: number | null
          id: string
          retention_efficiency: number | null
          sample_size: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avg_accuracy?: number | null
          avg_fatigue_index?: number | null
          avg_stress_index?: number | null
          day_of_week?: number | null
          hour_of_day?: number | null
          id?: string
          retention_efficiency?: number | null
          sample_size?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avg_accuracy?: number | null
          avg_fatigue_index?: number | null
          avg_stress_index?: number | null
          day_of_week?: number | null
          hour_of_day?: number | null
          id?: string
          retention_efficiency?: number | null
          sample_size?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cognitive_state_history: {
        Row: {
          created_at: string | null
          friction_index: number
          id: string
          load_index: number
          session_id: string | null
          stress_index: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          friction_index: number
          id?: string
          load_index: number
          session_id?: string | null
          stress_index: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          friction_index?: number
          id?: string
          load_index?: number
          session_id?: string | null
          stress_index?: number
          user_id?: string
        }
        Relationships: []
      }
      cognitive_window_performance: {
        Row: {
          drift_rate: number | null
          fatigue_score: number | null
          hour_window: number | null
          id: string
          replay_rate: number | null
          retention_score: number | null
          sample_size: number | null
          specialty: string | null
          stress_score: number | null
          tutor_dependency: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          drift_rate?: number | null
          fatigue_score?: number | null
          hour_window?: number | null
          id?: string
          replay_rate?: number | null
          retention_score?: number | null
          sample_size?: number | null
          specialty?: string | null
          stress_score?: number | null
          tutor_dependency?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          drift_rate?: number | null
          fatigue_score?: number | null
          hour_window?: number | null
          id?: string
          replay_rate?: number | null
          retention_score?: number | null
          sample_size?: number | null
          specialty?: string | null
          stress_score?: number | null
          tutor_dependency?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      content_coverage_audit: {
        Row: {
          banca_coverage_count: number
          computed_at: string
          details: Json
          flashcards_count: number
          id: string
          importance_level: string | null
          materials_count: number
          microtopic_id: string | null
          questions_count: number
          rule_applied: string | null
          scope_level: string
          status: string
          subtopic_id: string | null
        }
        Insert: {
          banca_coverage_count?: number
          computed_at?: string
          details?: Json
          flashcards_count?: number
          id?: string
          importance_level?: string | null
          materials_count?: number
          microtopic_id?: string | null
          questions_count?: number
          rule_applied?: string | null
          scope_level: string
          status: string
          subtopic_id?: string | null
        }
        Update: {
          banca_coverage_count?: number
          computed_at?: string
          details?: Json
          flashcards_count?: number
          id?: string
          importance_level?: string | null
          materials_count?: number
          microtopic_id?: string | null
          questions_count?: number
          rule_applied?: string | null
          scope_level?: string
          status?: string
          subtopic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_coverage_audit_microtopic_id_fkey"
            columns: ["microtopic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_microtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_coverage_audit_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_coverage_audit_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["subtopic_id"]
          },
          {
            foreignKeyName: "content_coverage_audit_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_subtopic_question_density"
            referencedColumns: ["subtopic_id"]
          },
        ]
      }
      content_gap_reports: {
        Row: {
          computed_at: string
          created_at: string
          difficulty_gaps: Json | null
          id: string
          image_type: string
          missing_diagnoses: Json | null
          next_batch_recommendation: Json | null
          priority_mode: string
          report_json: Json
          saturated_diagnoses: Json | null
          weakness_influenced: Json | null
        }
        Insert: {
          computed_at?: string
          created_at?: string
          difficulty_gaps?: Json | null
          id?: string
          image_type: string
          missing_diagnoses?: Json | null
          next_batch_recommendation?: Json | null
          priority_mode?: string
          report_json?: Json
          saturated_diagnoses?: Json | null
          weakness_influenced?: Json | null
        }
        Update: {
          computed_at?: string
          created_at?: string
          difficulty_gaps?: Json | null
          id?: string
          image_type?: string
          missing_diagnoses?: Json | null
          next_batch_recommendation?: Json | null
          priority_mode?: string
          report_json?: Json
          saturated_diagnoses?: Json | null
          weakness_influenced?: Json | null
        }
        Relationships: []
      }
      coverage_boost_events: {
        Row: {
          boost_breakdown: Json
          clicked: boolean
          clicked_at: string | null
          coverage_boost_applied: number
          coverage_boost_level: string | null
          coverage_boost_match_method: string | null
          coverage_boost_reason: string | null
          coverage_boost_score: number
          created_at: string
          executed: boolean
          executed_at: string | null
          id: string
          recommendation_id: string | null
          recommendation_type: string | null
          specialty: string | null
          specialty_id: string | null
          subtopic: string | null
          subtopic_id: string | null
          topic: string | null
          topic_id: string | null
          user_id: string
        }
        Insert: {
          boost_breakdown?: Json
          clicked?: boolean
          clicked_at?: string | null
          coverage_boost_applied?: number
          coverage_boost_level?: string | null
          coverage_boost_match_method?: string | null
          coverage_boost_reason?: string | null
          coverage_boost_score?: number
          created_at?: string
          executed?: boolean
          executed_at?: string | null
          id?: string
          recommendation_id?: string | null
          recommendation_type?: string | null
          specialty?: string | null
          specialty_id?: string | null
          subtopic?: string | null
          subtopic_id?: string | null
          topic?: string | null
          topic_id?: string | null
          user_id: string
        }
        Update: {
          boost_breakdown?: Json
          clicked?: boolean
          clicked_at?: string | null
          coverage_boost_applied?: number
          coverage_boost_level?: string | null
          coverage_boost_match_method?: string | null
          coverage_boost_reason?: string | null
          coverage_boost_score?: number
          created_at?: string
          executed?: boolean
          executed_at?: string | null
          id?: string
          recommendation_id?: string | null
          recommendation_type?: string | null
          specialty?: string | null
          specialty_id?: string | null
          subtopic?: string | null
          subtopic_id?: string | null
          topic?: string | null
          topic_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cronograma_config: {
        Row: {
          created_at: string | null
          dias_revisao: Json | null
          id: string
          max_revisoes_dia: number | null
          meta_questoes_dia: number | null
          meta_revisoes_semana: number | null
          mostrar_concluidos: boolean | null
          pesos_algoritmo: Json | null
          revisoes_extras_ativas: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dias_revisao?: Json | null
          id?: string
          max_revisoes_dia?: number | null
          meta_questoes_dia?: number | null
          meta_revisoes_semana?: number | null
          mostrar_concluidos?: boolean | null
          pesos_algoritmo?: Json | null
          revisoes_extras_ativas?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          dias_revisao?: Json | null
          id?: string
          max_revisoes_dia?: number | null
          meta_questoes_dia?: number | null
          meta_revisoes_semana?: number | null
          mostrar_concluidos?: boolean | null
          pesos_algoritmo?: Json | null
          revisoes_extras_ativas?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      curriculum_aliases: {
        Row: {
          active: boolean
          alias: string
          created_at: string
          id: string
          normalized_alias: string
          notes: string | null
          source: string
          specialty_id: string | null
          subtopic_id: string | null
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          alias: string
          created_at?: string
          id?: string
          normalized_alias: string
          notes?: string | null
          source?: string
          specialty_id?: string | null
          subtopic_id?: string | null
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          alias?: string
          created_at?: string
          id?: string
          normalized_alias?: string
          notes?: string | null
          source?: string
          specialty_id?: string | null
          subtopic_id?: string | null
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_aliases_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "curriculum_specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_aliases_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["specialty_id"]
          },
          {
            foreignKeyName: "curriculum_aliases_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_aliases_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["subtopic_id"]
          },
          {
            foreignKeyName: "curriculum_aliases_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_subtopic_question_density"
            referencedColumns: ["subtopic_id"]
          },
          {
            foreignKeyName: "curriculum_aliases_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_aliases_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["topic_id"]
          },
        ]
      }
      curriculum_matrix: {
        Row: {
          ativo: boolean
          created_at: string
          descricao_curta: string | null
          dificuldade_base: number
          especialidade: string
          gatilhos_clinicos: string[]
          id: string
          incidencia_geral: string
          integra_com_osce: boolean
          integra_com_pratica: boolean
          integra_com_revisao_fsrs: boolean
          palavras_chave: string[]
          peso_banca_enare: number
          peso_banca_sus_sp: number
          peso_banca_unicamp: number
          peso_banca_unifesp: number
          peso_banca_usp: number
          pre_requisitos: string[]
          prioridade_base: number
          subtema: string
          tema: string
          tipo_cobranca: string[]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao_curta?: string | null
          dificuldade_base?: number
          especialidade: string
          gatilhos_clinicos?: string[]
          id?: string
          incidencia_geral?: string
          integra_com_osce?: boolean
          integra_com_pratica?: boolean
          integra_com_revisao_fsrs?: boolean
          palavras_chave?: string[]
          peso_banca_enare?: number
          peso_banca_sus_sp?: number
          peso_banca_unicamp?: number
          peso_banca_unifesp?: number
          peso_banca_usp?: number
          pre_requisitos?: string[]
          prioridade_base?: number
          subtema: string
          tema: string
          tipo_cobranca?: string[]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao_curta?: string | null
          dificuldade_base?: number
          especialidade?: string
          gatilhos_clinicos?: string[]
          id?: string
          incidencia_geral?: string
          integra_com_osce?: boolean
          integra_com_pratica?: boolean
          integra_com_revisao_fsrs?: boolean
          palavras_chave?: string[]
          peso_banca_enare?: number
          peso_banca_sus_sp?: number
          peso_banca_unicamp?: number
          peso_banca_unifesp?: number
          peso_banca_usp?: number
          pre_requisitos?: string[]
          prioridade_base?: number
          subtema?: string
          tema?: string
          tipo_cobranca?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      curriculum_microtopics: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          metadata: Json
          nome: string
          ordem: number
          slug: string | null
          subtopic_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          metadata?: Json
          nome: string
          ordem?: number
          slug?: string | null
          subtopic_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          metadata?: Json
          nome?: string
          ordem?: number
          slug?: string | null
          subtopic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_microtopics_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_microtopics_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["subtopic_id"]
          },
          {
            foreignKeyName: "curriculum_microtopics_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_subtopic_question_density"
            referencedColumns: ["subtopic_id"]
          },
        ]
      }
      curriculum_prerequisites: {
        Row: {
          created_at: string
          id: string
          prerequisite_subtopic_id: string
          subtopic_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          prerequisite_subtopic_id: string
          subtopic_id: string
        }
        Update: {
          created_at?: string
          id?: string
          prerequisite_subtopic_id?: string
          subtopic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_prerequisites_prerequisite_subtopic_id_fkey"
            columns: ["prerequisite_subtopic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_prerequisites_prerequisite_subtopic_id_fkey"
            columns: ["prerequisite_subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["subtopic_id"]
          },
          {
            foreignKeyName: "curriculum_prerequisites_prerequisite_subtopic_id_fkey"
            columns: ["prerequisite_subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_subtopic_question_density"
            referencedColumns: ["subtopic_id"]
          },
          {
            foreignKeyName: "curriculum_prerequisites_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_prerequisites_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["subtopic_id"]
          },
          {
            foreignKeyName: "curriculum_prerequisites_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_subtopic_question_density"
            referencedColumns: ["subtopic_id"]
          },
        ]
      }
      curriculum_specialties: {
        Row: {
          ativo: boolean
          ciclo: string
          created_at: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          ciclo?: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          ciclo?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      curriculum_subtopics: {
        Row: {
          ativo: boolean
          created_at: string
          descricao_curta: string | null
          dificuldade_base: number | null
          gatilhos_clinicos: string[] | null
          id: string
          incidencia_geral: string | null
          integra_com_osce: boolean | null
          integra_com_pratica: boolean | null
          integra_com_revisao_fsrs: boolean | null
          nome: string
          palavras_chave: string[] | null
          prioridade_base: number | null
          tipo_cobranca: string[] | null
          topic_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao_curta?: string | null
          dificuldade_base?: number | null
          gatilhos_clinicos?: string[] | null
          id?: string
          incidencia_geral?: string | null
          integra_com_osce?: boolean | null
          integra_com_pratica?: boolean | null
          integra_com_revisao_fsrs?: boolean | null
          nome: string
          palavras_chave?: string[] | null
          prioridade_base?: number | null
          tipo_cobranca?: string[] | null
          topic_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao_curta?: string | null
          dificuldade_base?: number | null
          gatilhos_clinicos?: string[] | null
          id?: string
          incidencia_geral?: string | null
          integra_com_osce?: boolean | null
          integra_com_pratica?: boolean | null
          integra_com_revisao_fsrs?: boolean | null
          nome?: string
          palavras_chave?: string[] | null
          prioridade_base?: number | null
          tipo_cobranca?: string[] | null
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_subtopics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_subtopics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["topic_id"]
          },
        ]
      }
      curriculum_topics: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          specialty_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          specialty_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          specialty_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_topics_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "curriculum_specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_topics_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["specialty_id"]
          },
        ]
      }
      curriculum_weights: {
        Row: {
          banca: string
          created_at: string
          frequency_score: number | null
          id: string
          importance_level: string | null
          incidence_weight: number | null
          notes: string | null
          peso: number
          subtopic_id: string
        }
        Insert: {
          banca: string
          created_at?: string
          frequency_score?: number | null
          id?: string
          importance_level?: string | null
          incidence_weight?: number | null
          notes?: string | null
          peso?: number
          subtopic_id: string
        }
        Update: {
          banca?: string
          created_at?: string
          frequency_score?: number | null
          id?: string
          importance_level?: string | null
          incidence_weight?: number | null
          notes?: string | null
          peso?: number
          subtopic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_weights_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_weights_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["subtopic_id"]
          },
          {
            foreignKeyName: "curriculum_weights_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_subtopic_question_density"
            referencedColumns: ["subtopic_id"]
          },
        ]
      }
      daily_generation_log: {
        Row: {
          created_at: string
          id: string
          questions_generated: number
          run_date: string
          specialties_processed: Json
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          questions_generated?: number
          run_date?: string
          specialties_processed?: Json
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          questions_generated?: number
          run_date?: string
          specialties_processed?: Json
          status?: string
        }
        Relationships: []
      }
      daily_plan_tasks: {
        Row: {
          action_type: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          daily_plan_id: string
          description: string | null
          estimated_minutes: number | null
          id: string
          ordem: number
          priority: string | null
          quantity: number | null
          specialty: string | null
          subtopic: string | null
          task_type: string
          title: string
          topic: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_type?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          daily_plan_id: string
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          ordem?: number
          priority?: string | null
          quantity?: number | null
          specialty?: string | null
          subtopic?: string | null
          task_type?: string
          title: string
          topic?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_type?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          daily_plan_id?: string
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          ordem?: number
          priority?: string | null
          quantity?: number | null
          specialty?: string | null
          subtopic?: string | null
          task_type?: string
          title?: string
          topic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_plan_tasks_daily_plan_id_fkey"
            columns: ["daily_plan_id"]
            isOneToOne: false
            referencedRelation: "daily_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_plans: {
        Row: {
          approval_score: number | null
          chance_score: number | null
          completed_blocks: Json
          completed_count: number
          content_lock: boolean | null
          created_at: string | null
          diagnosis_summary: string | null
          heavy_recovery_active: boolean | null
          heavy_recovery_phase: number | null
          id: string
          objective: string | null
          phase: string | null
          plan_date: string
          plan_json: Json
          prep_index: number | null
          recovery_mode: boolean | null
          request_hash: string | null
          total_blocks: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approval_score?: number | null
          chance_score?: number | null
          completed_blocks?: Json
          completed_count?: number
          content_lock?: boolean | null
          created_at?: string | null
          diagnosis_summary?: string | null
          heavy_recovery_active?: boolean | null
          heavy_recovery_phase?: number | null
          id?: string
          objective?: string | null
          phase?: string | null
          plan_date?: string
          plan_json?: Json
          prep_index?: number | null
          recovery_mode?: boolean | null
          request_hash?: string | null
          total_blocks?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approval_score?: number | null
          chance_score?: number | null
          completed_blocks?: Json
          completed_count?: number
          content_lock?: boolean | null
          created_at?: string | null
          diagnosis_summary?: string | null
          heavy_recovery_active?: boolean | null
          heavy_recovery_phase?: number | null
          id?: string
          objective?: string | null
          phase?: string | null
          plan_date?: string
          plan_json?: Json
          prep_index?: number | null
          recovery_mode?: boolean | null
          request_hash?: string | null
          total_blocks?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      dashboard_card_diagnostics: {
        Row: {
          card_name: string
          created_at: string | null
          data_count: number | null
          error_message: string | null
          id: string
          status: string
          user_id: string | null
        }
        Insert: {
          card_name: string
          created_at?: string | null
          data_count?: number | null
          error_message?: string | null
          id?: string
          status: string
          user_id?: string | null
        }
        Update: {
          card_name?: string
          created_at?: string | null
          data_count?: number | null
          error_message?: string | null
          id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      dashboard_snapshots: {
        Row: {
          approval_score: number | null
          chance_score: number | null
          created_at: string
          current_objective: string | null
          id: string
          mission_id: string | null
          pending_reviews: number | null
          prep_index: number | null
          snapshot_json: Json
          updated_at: string
          user_id: string
          weak_points_json: Json | null
        }
        Insert: {
          approval_score?: number | null
          chance_score?: number | null
          created_at?: string
          current_objective?: string | null
          id?: string
          mission_id?: string | null
          pending_reviews?: number | null
          prep_index?: number | null
          snapshot_json?: Json
          updated_at?: string
          user_id: string
          weak_points_json?: Json | null
        }
        Update: {
          approval_score?: number | null
          chance_score?: number | null
          created_at?: string
          current_objective?: string | null
          id?: string
          mission_id?: string | null
          pending_reviews?: number | null
          prep_index?: number | null
          snapshot_json?: Json
          updated_at?: string
          user_id?: string
          weak_points_json?: Json | null
        }
        Relationships: []
      }
      data_retention_policies: {
        Row: {
          action: string | null
          created_at: string | null
          id: string
          last_run_at: string | null
          retention_days: number
          table_name: string
          updated_at: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          id?: string
          last_run_at?: string | null
          retention_days: number
          table_name: string
          updated_at?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          id?: string
          last_run_at?: string | null
          retention_days?: number
          table_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      desempenho_questoes: {
        Row: {
          created_at: string
          data_registro: string
          id: string
          nivel_confianca: string | null
          observacoes: string | null
          questoes_erradas: number
          questoes_feitas: number
          revisao_id: string | null
          taxa_acerto: number
          tema_id: string
          tempo_gasto: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          data_registro?: string
          id?: string
          nivel_confianca?: string | null
          observacoes?: string | null
          questoes_erradas?: number
          questoes_feitas?: number
          revisao_id?: string | null
          taxa_acerto?: number
          tema_id: string
          tempo_gasto?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          data_registro?: string
          id?: string
          nivel_confianca?: string | null
          observacoes?: string | null
          questoes_erradas?: number
          questoes_feitas?: number
          revisao_id?: string | null
          taxa_acerto?: number
          tema_id?: string
          tempo_gasto?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "desempenho_questoes_revisao_id_fkey"
            columns: ["revisao_id"]
            isOneToOne: false
            referencedRelation: "revisoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desempenho_questoes_tema_id_fkey"
            columns: ["tema_id"]
            isOneToOne: false
            referencedRelation: "temas_estudados"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_results: {
        Row: {
          completed_at: string
          created_at: string
          id: string
          results_json: Json | null
          score: number
          total_questions: number
          user_id: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          id?: string
          results_json?: Json | null
          score?: number
          total_questions?: number
          user_id: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          id?: string
          results_json?: Json | null
          score?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: []
      }
      diagnostic_sessions: {
        Row: {
          areas_evaluated: Json
          correct_count: number
          created_at: string
          cycle: string
          finished_at: string | null
          id: string
          score: number
          started_at: string
          total_questions: number
          user_id: string
        }
        Insert: {
          areas_evaluated?: Json
          correct_count?: number
          created_at?: string
          cycle?: string
          finished_at?: string | null
          id?: string
          score?: number
          started_at?: string
          total_questions?: number
          user_id: string
        }
        Update: {
          areas_evaluated?: Json
          correct_count?: number
          created_at?: string
          cycle?: string
          finished_at?: string | null
          id?: string
          score?: number
          started_at?: string
          total_questions?: number
          user_id?: string
        }
        Relationships: []
      }
      diagnostic_topic_results: {
        Row: {
          accuracy: number
          avg_time_seconds: number | null
          correct: number
          created_at: string
          id: string
          session_id: string
          topic: string
          total: number
          user_id: string
        }
        Insert: {
          accuracy?: number
          avg_time_seconds?: number | null
          correct?: number
          created_at?: string
          id?: string
          session_id: string
          topic: string
          total?: number
          user_id: string
        }
        Update: {
          accuracy?: number
          avg_time_seconds?: number | null
          correct?: number
          created_at?: string
          id?: string
          session_id?: string
          topic?: string
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_topic_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      discursive_attempts: {
        Row: {
          ai_correction: Json | null
          created_at: string
          finished_at: string | null
          id: string
          max_score: number | null
          question_text: string
          score: number | null
          specialty: string
          status: string
          student_answer: string | null
          user_id: string
        }
        Insert: {
          ai_correction?: Json | null
          created_at?: string
          finished_at?: string | null
          id?: string
          max_score?: number | null
          question_text: string
          score?: number | null
          specialty: string
          status?: string
          student_answer?: string | null
          user_id: string
        }
        Update: {
          ai_correction?: Json | null
          created_at?: string
          finished_at?: string | null
          id?: string
          max_score?: number | null
          question_text?: string
          score?: number | null
          specialty?: string
          status?: string
          student_answer?: string | null
          user_id?: string
        }
        Relationships: []
      }
      domain_areas: {
        Row: {
          created_at: string
          domain_id: string
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          ordem: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain_id: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          ordem?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain_id?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          ordem?: number | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_areas_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_topics: {
        Row: {
          area_id: string
          created_at: string
          description: string | null
          difficulty_base: number | null
          id: string
          is_active: boolean | null
          name: string
          ordem: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          area_id: string
          created_at?: string
          description?: string | null
          difficulty_base?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          ordem?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          area_id?: string
          created_at?: string
          description?: string | null
          difficulty_base?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          ordem?: number | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_topics_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "domain_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          config_json: Json | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          config_json?: Json | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          config_json?: Json | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      editorial_audit_trail: {
        Row: {
          batch_id: string | null
          corrected_at: string
          correction_type: string
          created_at: string
          editorial_score: number | null
          id: string
          question_id: string
          reason: string
          version_after: Json | null
          version_before: Json | null
        }
        Insert: {
          batch_id?: string | null
          corrected_at?: string
          correction_type: string
          created_at?: string
          editorial_score?: number | null
          id?: string
          question_id: string
          reason: string
          version_after?: Json | null
          version_before?: Json | null
        }
        Update: {
          batch_id?: string | null
          corrected_at?: string
          correction_type?: string
          created_at?: string
          editorial_score?: number | null
          id?: string
          question_id?: string
          reason?: string
          version_after?: Json | null
          version_before?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "editorial_audit_trail_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "multimodal_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      educational_memory: {
        Row: {
          access_count: number | null
          aggregation_id: string | null
          archived: boolean | null
          conversation_id: string | null
          created_at: string | null
          difficulty_level: string | null
          estimated_duration: number | null
          favorite: boolean | null
          generated_summary: string | null
          id: string
          last_accessed_at: string | null
          memory_score: number | null
          metadata: Json | null
          session_id: string | null
          short_summary: string | null
          source_type: string
          status: string | null
          subject: string | null
          subtitle: string | null
          subtopic: string | null
          tags: string[] | null
          teaching_style: string | null
          thumbnail_url: string | null
          title: string
          topic: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_count?: number | null
          aggregation_id?: string | null
          archived?: boolean | null
          conversation_id?: string | null
          created_at?: string | null
          difficulty_level?: string | null
          estimated_duration?: number | null
          favorite?: boolean | null
          generated_summary?: string | null
          id?: string
          last_accessed_at?: string | null
          memory_score?: number | null
          metadata?: Json | null
          session_id?: string | null
          short_summary?: string | null
          source_type: string
          status?: string | null
          subject?: string | null
          subtitle?: string | null
          subtopic?: string | null
          tags?: string[] | null
          teaching_style?: string | null
          thumbnail_url?: string | null
          title: string
          topic?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_count?: number | null
          aggregation_id?: string | null
          archived?: boolean | null
          conversation_id?: string | null
          created_at?: string | null
          difficulty_level?: string | null
          estimated_duration?: number | null
          favorite?: boolean | null
          generated_summary?: string | null
          id?: string
          last_accessed_at?: string | null
          memory_score?: number | null
          metadata?: Json | null
          session_id?: string | null
          short_summary?: string | null
          source_type?: string
          status?: string | null
          subject?: string | null
          subtitle?: string | null
          subtopic?: string | null
          tags?: string[] | null
          teaching_style?: string | null
          thumbnail_url?: string | null
          title?: string
          topic?: string | null
          updated_at?: string | null
          user_id?: string
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
      enazizi_progress: {
        Row: {
          created_at: string
          estado_atual: number
          historico_estudo: Json
          id: string
          pontuacao_discursiva: number | null
          questoes_respondidas: number
          taxa_acerto: number
          tema_atual: string | null
          temas_fracos: Json
          ultima_interacao: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estado_atual?: number
          historico_estudo?: Json
          id?: string
          pontuacao_discursiva?: number | null
          questoes_respondidas?: number
          taxa_acerto?: number
          tema_atual?: string | null
          temas_fracos?: Json
          ultima_interacao?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          estado_atual?: number
          historico_estudo?: Json
          id?: string
          pontuacao_discursiva?: number | null
          questoes_respondidas?: number
          taxa_acerto?: number
          tema_atual?: string | null
          temas_fracos?: Json
          ultima_interacao?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      error_bank: {
        Row: {
          categoria_erro: string | null
          conteudo: string | null
          created_at: string
          dificuldade: number | null
          dominado: boolean | null
          dominado_em: string | null
          id: string
          motivo_erro: string | null
          subtema: string | null
          subtema_norm: string | null
          tema: string
          tema_norm: string | null
          tipo_questao: string
          updated_at: string
          user_id: string
          vezes_errado: number
        }
        Insert: {
          categoria_erro?: string | null
          conteudo?: string | null
          created_at?: string
          dificuldade?: number | null
          dominado?: boolean | null
          dominado_em?: string | null
          id?: string
          motivo_erro?: string | null
          subtema?: string | null
          subtema_norm?: string | null
          tema: string
          tema_norm?: string | null
          tipo_questao?: string
          updated_at?: string
          user_id: string
          vezes_errado?: number
        }
        Update: {
          categoria_erro?: string | null
          conteudo?: string | null
          created_at?: string
          dificuldade?: number | null
          dominado?: boolean | null
          dominado_em?: string | null
          id?: string
          motivo_erro?: string | null
          subtema?: string | null
          subtema_norm?: string | null
          tema?: string
          tema_norm?: string | null
          tipo_questao?: string
          updated_at?: string
          user_id?: string
          vezes_errado?: number
        }
        Relationships: []
      }
      error_log: {
        Row: {
          component_stack: string | null
          context: Json | null
          created_at: string
          error_message: string | null
          id: string
          severity: string | null
          stack_trace: string | null
          user_id: string | null
        }
        Insert: {
          component_stack?: string | null
          context?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          severity?: string | null
          stack_trace?: string | null
          user_id?: string | null
        }
        Update: {
          component_stack?: string | null
          context?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          severity?: string | null
          stack_trace?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      exam_auto_reconcile_policies: {
        Row: {
          auto_apply_low: boolean | null
          block_critical: boolean | null
          exam_key: string
          id: string
          min_confidence_threshold: number | null
          require_approval_high: boolean | null
          require_approval_medium: boolean | null
          updated_at: string | null
        }
        Insert: {
          auto_apply_low?: boolean | null
          block_critical?: boolean | null
          exam_key: string
          id?: string
          min_confidence_threshold?: number | null
          require_approval_high?: boolean | null
          require_approval_medium?: boolean | null
          updated_at?: string | null
        }
        Update: {
          auto_apply_low?: boolean | null
          block_critical?: boolean | null
          exam_key?: string
          id?: string
          min_confidence_threshold?: number | null
          require_approval_high?: boolean | null
          require_approval_medium?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      exam_banks: {
        Row: {
          banca: string
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          source_tag: string
          specialty: string | null
          time_limit_minutes: number | null
          total_questions: number | null
          year: number
        }
        Insert: {
          banca: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          source_tag: string
          specialty?: string | null
          time_limit_minutes?: number | null
          total_questions?: number | null
          year: number
        }
        Update: {
          banca?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          source_tag?: string
          specialty?: string | null
          time_limit_minutes?: number | null
          total_questions?: number | null
          year?: number
        }
        Relationships: []
      }
      exam_blueprint_versions: {
        Row: {
          blueprint_json: Json
          confidence_avg: number | null
          created_at: string | null
          created_by: string | null
          exam_key: string
          id: string
          is_active: boolean | null
          version_label: string
        }
        Insert: {
          blueprint_json: Json
          confidence_avg?: number | null
          created_at?: string | null
          created_by?: string | null
          exam_key: string
          id?: string
          is_active?: boolean | null
          version_label: string
        }
        Update: {
          blueprint_json?: Json
          confidence_avg?: number | null
          created_at?: string | null
          created_by?: string | null
          exam_key?: string
          id?: string
          is_active?: boolean | null
          version_label?: string
        }
        Relationships: []
      }
      exam_blueprints: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          effective_weight: number | null
          exam_key: string
          id: string
          is_active: boolean | null
          last_recalculated_at: string | null
          sample_size: number | null
          specialty: string
          topic: string
          updated_at: string | null
          version: string
          weight: number
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          effective_weight?: number | null
          exam_key: string
          id?: string
          is_active?: boolean | null
          last_recalculated_at?: string | null
          sample_size?: number | null
          specialty: string
          topic: string
          updated_at?: string | null
          version?: string
          weight?: number
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          effective_weight?: number | null
          exam_key?: string
          id?: string
          is_active?: boolean | null
          last_recalculated_at?: string | null
          sample_size?: number | null
          specialty?: string
          topic?: string
          updated_at?: string | null
          version?: string
          weight?: number
        }
        Relationships: []
      }
      exam_clinical_audits: {
        Row: {
          audit_notes: string | null
          audited_at: string | null
          created_at: string | null
          distractor_quality_score: number | null
          exam_key: string
          exam_style_score: number | null
          explanation_quality_score: number | null
          final_quality_score: number | null
          id: string
          is_approved: boolean | null
          medical_accuracy_score: number | null
          question_hash: string
          specialty: string
          topic: string
        }
        Insert: {
          audit_notes?: string | null
          audited_at?: string | null
          created_at?: string | null
          distractor_quality_score?: number | null
          exam_key: string
          exam_style_score?: number | null
          explanation_quality_score?: number | null
          final_quality_score?: number | null
          id?: string
          is_approved?: boolean | null
          medical_accuracy_score?: number | null
          question_hash: string
          specialty: string
          topic: string
        }
        Update: {
          audit_notes?: string | null
          audited_at?: string | null
          created_at?: string | null
          distractor_quality_score?: number | null
          exam_key?: string
          exam_style_score?: number | null
          explanation_quality_score?: number | null
          final_quality_score?: number | null
          id?: string
          is_approved?: boolean | null
          medical_accuracy_score?: number | null
          question_hash?: string
          specialty?: string
          topic?: string
        }
        Relationships: []
      }
      exam_drift_logs: {
        Row: {
          delta: number | null
          detected_at: string | null
          exam_key: string
          id: string
          new_weight: number | null
          old_weight: number | null
          reason: string | null
          severity: string | null
          source_version: string | null
          topic: string
        }
        Insert: {
          delta?: number | null
          detected_at?: string | null
          exam_key: string
          id?: string
          new_weight?: number | null
          old_weight?: number | null
          reason?: string | null
          severity?: string | null
          source_version?: string | null
          topic: string
        }
        Update: {
          delta?: number | null
          detected_at?: string | null
          exam_key?: string
          id?: string
          new_weight?: number | null
          old_weight?: number | null
          reason?: string | null
          severity?: string | null
          source_version?: string | null
          topic?: string
        }
        Relationships: []
      }
      exam_health_history: {
        Row: {
          confidence_avg: number | null
          exam_key: string
          freshness_score: number | null
          health_score: number | null
          id: string
          recorded_at: string | null
          sample_adequacy_score: number | null
          stability_score: number | null
          status: string | null
        }
        Insert: {
          confidence_avg?: number | null
          exam_key: string
          freshness_score?: number | null
          health_score?: number | null
          id?: string
          recorded_at?: string | null
          sample_adequacy_score?: number | null
          stability_score?: number | null
          status?: string | null
        }
        Update: {
          confidence_avg?: number | null
          exam_key?: string
          freshness_score?: number | null
          health_score?: number | null
          id?: string
          recorded_at?: string | null
          sample_adequacy_score?: number | null
          stability_score?: number | null
          status?: string | null
        }
        Relationships: []
      }
      exam_question_usage: {
        Row: {
          answered_correctly: boolean | null
          confidence_level: string | null
          id: string
          question_id: string
          response_time_seconds: number | null
          simulado_id: string | null
          used_at: string
          user_id: string
        }
        Insert: {
          answered_correctly?: boolean | null
          confidence_level?: string | null
          id?: string
          question_id: string
          response_time_seconds?: number | null
          simulado_id?: string | null
          used_at?: string
          user_id: string
        }
        Update: {
          answered_correctly?: boolean | null
          confidence_level?: string | null
          id?: string
          question_id?: string
          response_time_seconds?: number | null
          simulado_id?: string | null
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_question_usage_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "medical_image_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_raw_data: {
        Row: {
          created_at: string | null
          exam_key: string
          exam_year: number
          id: string
          occurrence_count: number | null
          specialty: string
          topic: string
        }
        Insert: {
          created_at?: string | null
          exam_key: string
          exam_year: number
          id?: string
          occurrence_count?: number | null
          specialty: string
          topic: string
        }
        Update: {
          created_at?: string | null
          exam_key?: string
          exam_year?: number
          id?: string
          occurrence_count?: number | null
          specialty?: string
          topic?: string
        }
        Relationships: []
      }
      exam_reconciliation_logs: {
        Row: {
          confidence_after: number | null
          confidence_before: number | null
          created_at: string | null
          exam_key: string
          id: string
          new_version: string
          old_version: string | null
          sample_size: number
          smoothing_factor: number
          triggered_by: string | null
        }
        Insert: {
          confidence_after?: number | null
          confidence_before?: number | null
          created_at?: string | null
          exam_key: string
          id?: string
          new_version: string
          old_version?: string | null
          sample_size: number
          smoothing_factor: number
          triggered_by?: string | null
        }
        Update: {
          confidence_after?: number | null
          confidence_before?: number | null
          created_at?: string | null
          exam_key?: string
          id?: string
          new_version?: string
          old_version?: string | null
          sample_size?: number
          smoothing_factor?: number
          triggered_by?: string | null
        }
        Relationships: []
      }
      exam_sessions: {
        Row: {
          answers_json: Json | null
          created_at: string
          finished_at: string | null
          id: string
          organization_id: string | null
          results_json: Json | null
          score: number | null
          started_at: string
          status: string
          time_limit_minutes: number
          title: string
          total_questions: number
          user_id: string
        }
        Insert: {
          answers_json?: Json | null
          created_at?: string
          finished_at?: string | null
          id?: string
          organization_id?: string | null
          results_json?: Json | null
          score?: number | null
          started_at?: string
          status?: string
          time_limit_minutes?: number
          title?: string
          total_questions?: number
          user_id: string
        }
        Update: {
          answers_json?: Json | null
          created_at?: string
          finished_at?: string | null
          id?: string
          organization_id?: string | null
          results_json?: Json | null
          score?: number | null
          started_at?: string
          status?: string
          time_limit_minutes?: number
          title?: string
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      external_exam_sources: {
        Row: {
          created_at: string
          created_by: string | null
          error_message: string | null
          exam_info: string | null
          extracted_questions_count: number
          id: string
          permission_type: string
          processing_status: string
          source_type: string
          source_url: string
          specialty: string | null
          title: string
          year: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          exam_info?: string | null
          extracted_questions_count?: number
          id?: string
          permission_type?: string
          processing_status?: string
          source_type?: string
          source_url: string
          specialty?: string | null
          title: string
          year?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          exam_info?: string | null
          extracted_questions_count?: number
          id?: string
          permission_type?: string
          processing_status?: string
          source_type?: string
          source_url?: string
          specialty?: string | null
          title?: string
          year?: number | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          created_at: string | null
          description: string | null
          gradual_rollout_percentage: number | null
          id: string
          metadata: Json | null
          name: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          gradual_rollout_percentage?: number | null
          id?: string
          metadata?: Json | null
          name: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          gradual_rollout_percentage?: number | null
          id?: string
          metadata?: Json | null
          name?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      flashcards: {
        Row: {
          answer: string
          content_version: number
          created_at: string
          difficulty: number | null
          explanation: string | null
          generation_method: string | null
          id: string
          is_global: boolean
          metadata: Json
          microtopic_id: string | null
          organization_id: string | null
          question: string
          reviewed_by_human: boolean
          source: string | null
          source_map_id: string | null
          specialty_id: string | null
          subtopic_id: string | null
          topic: string | null
          user_id: string
        }
        Insert: {
          answer: string
          content_version?: number
          created_at?: string
          difficulty?: number | null
          explanation?: string | null
          generation_method?: string | null
          id?: string
          is_global?: boolean
          metadata?: Json
          microtopic_id?: string | null
          organization_id?: string | null
          question: string
          reviewed_by_human?: boolean
          source?: string | null
          source_map_id?: string | null
          specialty_id?: string | null
          subtopic_id?: string | null
          topic?: string | null
          user_id: string
        }
        Update: {
          answer?: string
          content_version?: number
          created_at?: string
          difficulty?: number | null
          explanation?: string | null
          generation_method?: string | null
          id?: string
          is_global?: boolean
          metadata?: Json
          microtopic_id?: string | null
          organization_id?: string | null
          question?: string
          reviewed_by_human?: boolean
          source?: string | null
          source_map_id?: string | null
          specialty_id?: string | null
          subtopic_id?: string | null
          topic?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_microtopic_id_fkey"
            columns: ["microtopic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_microtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_source_map_id_fkey"
            columns: ["source_map_id"]
            isOneToOne: false
            referencedRelation: "mental_maps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "curriculum_specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["specialty_id"]
          },
          {
            foreignKeyName: "flashcards_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["subtopic_id"]
          },
          {
            foreignKeyName: "flashcards_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_subtopic_question_density"
            referencedColumns: ["subtopic_id"]
          },
        ]
      }
      fsrs_cards: {
        Row: {
          card_ref_id: string
          card_type: string
          created_at: string
          difficulty: number
          due: string
          elapsed_days: number
          id: string
          lapses: number
          last_review: string | null
          reps: number
          scheduled_days: number
          stability: number
          state: number
          updated_at: string
          user_id: string
        }
        Insert: {
          card_ref_id: string
          card_type?: string
          created_at?: string
          difficulty?: number
          due?: string
          elapsed_days?: number
          id?: string
          lapses?: number
          last_review?: string | null
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          card_ref_id?: string
          card_type?: string
          created_at?: string
          difficulty?: number
          due?: string
          elapsed_days?: number
          id?: string
          lapses?: number
          last_review?: string | null
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fsrs_review_log: {
        Row: {
          card_id: string
          elapsed_days: number | null
          id: string
          rating: number
          review_duration_ms: number | null
          reviewed_at: string
          scheduled_days: number | null
          user_id: string
        }
        Insert: {
          card_id: string
          elapsed_days?: number | null
          id?: string
          rating: number
          review_duration_ms?: number | null
          reviewed_at?: string
          scheduled_days?: number | null
          user_id: string
        }
        Update: {
          card_id?: string
          elapsed_days?: number | null
          id?: string
          rating?: number
          review_duration_ms?: number | null
          reviewed_at?: string
          scheduled_days?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fsrs_review_log_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "fsrs_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      gap_fill_logs: {
        Row: {
          assets_created: number | null
          created_at: string | null
          details: Json | null
          diagnoses_processed: string[] | null
          error_details: string[] | null
          errors: number | null
          execution_time_ms: number | null
          gaps_detected: number | null
          gaps_planned: number | null
          id: string
          image_type: string
          questions_generated: number | null
          status: string | null
        }
        Insert: {
          assets_created?: number | null
          created_at?: string | null
          details?: Json | null
          diagnoses_processed?: string[] | null
          error_details?: string[] | null
          errors?: number | null
          execution_time_ms?: number | null
          gaps_detected?: number | null
          gaps_planned?: number | null
          id?: string
          image_type: string
          questions_generated?: number | null
          status?: string | null
        }
        Update: {
          assets_created?: number | null
          created_at?: string | null
          details?: Json | null
          diagnoses_processed?: string[] | null
          error_details?: string[] | null
          errors?: number | null
          execution_time_ms?: number | null
          gaps_detected?: number | null
          gaps_planned?: number | null
          id?: string
          image_type?: string
          questions_generated?: number | null
          status?: string | null
        }
        Relationships: []
      }
      gap_fill_state: {
        Row: {
          current_image_type: string | null
          id: number
          is_running: boolean | null
          last_run_at: string | null
          total_gaps_filled: number | null
          total_runs: number | null
          updated_at: string | null
        }
        Insert: {
          current_image_type?: string | null
          id?: number
          is_running?: boolean | null
          last_run_at?: string | null
          total_gaps_filled?: number | null
          total_runs?: number | null
          updated_at?: string | null
        }
        Update: {
          current_image_type?: string | null
          id?: number
          is_running?: boolean | null
          last_run_at?: string | null
          total_gaps_filled?: number | null
          total_runs?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      generated_content_log: {
        Row: {
          cache_hit: boolean
          content_hash: string
          content_type: string
          cost_units: number
          created_at: string
          id: string
          model_used: string | null
          request_payload: Json | null
          response_payload: Json | null
          source_endpoint: string
          subtopic: string | null
          theme: string
          user_id: string
        }
        Insert: {
          cache_hit?: boolean
          content_hash: string
          content_type: string
          cost_units?: number
          created_at?: string
          id?: string
          model_used?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          source_endpoint: string
          subtopic?: string | null
          theme: string
          user_id: string
        }
        Update: {
          cache_hit?: boolean
          content_hash?: string
          content_type?: string
          cost_units?: number
          created_at?: string
          id?: string
          model_used?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          source_endpoint?: string
          subtopic?: string | null
          theme?: string
          user_id?: string
        }
        Relationships: []
      }
      generation_jobs: {
        Row: {
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          processed_batches: number
          processed_specialties: Json
          progress_pct: number
          remaining_specialties: Json
          result_json: Json
          started_by: string | null
          status: string
          total_batches: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_type?: string
          last_error?: string | null
          processed_batches?: number
          processed_specialties?: Json
          progress_pct?: number
          remaining_specialties?: Json
          result_json?: Json
          started_by?: string | null
          status?: string
          total_batches?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_type?: string
          last_error?: string | null
          processed_batches?: number
          processed_specialties?: Json
          progress_pct?: number
          remaining_specialties?: Json
          result_json?: Json
          started_by?: string | null
          status?: string
          total_batches?: number
          updated_at?: string
        }
        Relationships: []
      }
      governance_audit_logs: {
        Row: {
          action: string
          content_id: string
          created_at: string | null
          from_status: string | null
          id: string
          metadata: Json | null
          to_status: string | null
          user_id: string
        }
        Insert: {
          action: string
          content_id: string
          created_at?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json | null
          to_status?: string | null
          user_id: string
        }
        Update: {
          action?: string
          content_id?: string
          created_at?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json | null
          to_status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_audit_logs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "master_content_library"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_logs: {
        Row: {
          action_type: string
          admin_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          severity: string | null
          target_table: string | null
          user_agent: string | null
        }
        Insert: {
          action_type: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          severity?: string | null
          target_table?: string | null
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          severity?: string | null
          target_table?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      governance_thresholds: {
        Row: {
          category: string
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          category: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          category?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      granular_generator_runs: {
        Row: {
          ab_bucket: string | null
          banca: string | null
          banca_status: string | null
          batch_count: number | null
          batch_error_rate: number | null
          created_at: string
          duration_ms: number | null
          endpoint: string
          error_message: string | null
          fallback_reason: string | null
          fallback_triggered: boolean
          generated_count: number | null
          generation_mode: string | null
          id: string
          metadata: Json | null
          pipeline_used: string
          requested_count: number | null
          requested_specialties: string[] | null
          status: string
          topic_distribution: Json | null
          user_id: string | null
          user_profile: string | null
        }
        Insert: {
          ab_bucket?: string | null
          banca?: string | null
          banca_status?: string | null
          batch_count?: number | null
          batch_error_rate?: number | null
          created_at?: string
          duration_ms?: number | null
          endpoint: string
          error_message?: string | null
          fallback_reason?: string | null
          fallback_triggered?: boolean
          generated_count?: number | null
          generation_mode?: string | null
          id?: string
          metadata?: Json | null
          pipeline_used: string
          requested_count?: number | null
          requested_specialties?: string[] | null
          status?: string
          topic_distribution?: Json | null
          user_id?: string | null
          user_profile?: string | null
        }
        Update: {
          ab_bucket?: string | null
          banca?: string | null
          banca_status?: string | null
          batch_count?: number | null
          batch_error_rate?: number | null
          created_at?: string
          duration_ms?: number | null
          endpoint?: string
          error_message?: string | null
          fallback_reason?: string | null
          fallback_triggered?: boolean
          generated_count?: number | null
          generation_mode?: string | null
          id?: string
          metadata?: Json | null
          pipeline_used?: string
          requested_count?: number | null
          requested_specialties?: string[] | null
          status?: string
          topic_distribution?: Json | null
          user_id?: string | null
          user_profile?: string | null
        }
        Relationships: []
      }
      hallucination_reports: {
        Row: {
          content_id: string | null
          created_at: string | null
          description: string
          id: string
          issue_type: string
          original_text: string | null
          prompt_version_id: string | null
          reporter_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          risk_level: string
          status: string
          suggested_correction: string | null
        }
        Insert: {
          content_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          issue_type: string
          original_text?: string | null
          prompt_version_id?: string | null
          reporter_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_level: string
          status?: string
          suggested_correction?: string | null
        }
        Update: {
          content_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          issue_type?: string
          original_text?: string | null
          prompt_version_id?: string | null
          reporter_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_level?: string
          status?: string
          suggested_correction?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hallucination_reports_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "master_content_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hallucination_reports_prompt_version_id_fkey"
            columns: ["prompt_version_id"]
            isOneToOne: false
            referencedRelation: "medical_ai_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hallucination_reports_prompt_version_id_fkey"
            columns: ["prompt_version_id"]
            isOneToOne: false
            referencedRelation: "prompt_performance_analytics"
            referencedColumns: ["prompt_id"]
          },
        ]
      }
      image_curation_log: {
        Row: {
          asset_code: string | null
          asset_id: string | null
          classification: Json | null
          created_at: string
          diagnosis: string
          download_status: string | null
          id: string
          image_type: string
          issues: Json | null
          notes: string | null
          search_queries: Json | null
          selected_source: Json | null
          storage_path: string | null
          thumbnail_path: string | null
        }
        Insert: {
          asset_code?: string | null
          asset_id?: string | null
          classification?: Json | null
          created_at?: string
          diagnosis: string
          download_status?: string | null
          id?: string
          image_type: string
          issues?: Json | null
          notes?: string | null
          search_queries?: Json | null
          selected_source?: Json | null
          storage_path?: string | null
          thumbnail_path?: string | null
        }
        Update: {
          asset_code?: string | null
          asset_id?: string | null
          classification?: Json | null
          created_at?: string
          diagnosis?: string
          download_status?: string | null
          id?: string
          image_type?: string
          issues?: Json | null
          notes?: string | null
          search_queries?: Json | null
          selected_source?: Json | null
          storage_path?: string | null
          thumbnail_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "image_curation_log_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "medical_image_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      image_question_audit_log: {
        Row: {
          created_at: string
          id: string
          new_status: string
          payload_summary: Json | null
          previous_status: string | null
          question_id: string
          reason: string | null
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          new_status: string
          payload_summary?: Json | null
          previous_status?: string | null
          question_id: string
          reason?: string | null
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          new_status?: string
          payload_summary?: Json | null
          previous_status?: string | null
          question_id?: string
          reason?: string | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      import_priority_config: {
        Row: {
          created_at: string
          diagnosis_rankings: Json
          difficulty_targets: Json
          id: string
          image_type: string
          is_active: boolean
          max_assets_per_diagnosis: number
          min_assets_per_diagnosis: number
          priority_mode: string
          updated_at: string
          weight_exam_relevance: number
          weight_inventory_gap: number
          weight_student_weakness: number
        }
        Insert: {
          created_at?: string
          diagnosis_rankings?: Json
          difficulty_targets?: Json
          id?: string
          image_type: string
          is_active?: boolean
          max_assets_per_diagnosis?: number
          min_assets_per_diagnosis?: number
          priority_mode?: string
          updated_at?: string
          weight_exam_relevance?: number
          weight_inventory_gap?: number
          weight_student_weakness?: number
        }
        Update: {
          created_at?: string
          diagnosis_rankings?: Json
          difficulty_targets?: Json
          id?: string
          image_type?: string
          is_active?: boolean
          max_assets_per_diagnosis?: number
          min_assets_per_diagnosis?: number
          priority_mode?: string
          updated_at?: string
          weight_exam_relevance?: number
          weight_inventory_gap?: number
          weight_student_weakness?: number
        }
        Relationships: []
      }
      incident_acknowledgements: {
        Row: {
          alert_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          user_id: string | null
        }
        Insert: {
          alert_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          user_id?: string | null
        }
        Update: {
          alert_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_acknowledgements_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "incident_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_alerts: {
        Row: {
          alert_channel: string | null
          assigned_to: string | null
          event_id: string | null
          id: string
          notified_at: string | null
          resolved_at: string | null
          status: string | null
        }
        Insert: {
          alert_channel?: string | null
          assigned_to?: string | null
          event_id?: string | null
          id?: string
          notified_at?: string | null
          resolved_at?: string | null
          status?: string | null
        }
        Update: {
          alert_channel?: string | null
          assigned_to?: string | null
          event_id?: string | null
          id?: string
          notified_at?: string | null
          resolved_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_alerts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "incident_events"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_correlations: {
        Row: {
          confidence_score: number | null
          correlated_incident_id: string | null
          correlation_type: string
          created_at: string | null
          id: string
          incident_id: string | null
          metadata: Json | null
        }
        Insert: {
          confidence_score?: number | null
          correlated_incident_id?: string | null
          correlation_type: string
          created_at?: string | null
          id?: string
          incident_id?: string | null
          metadata?: Json | null
        }
        Update: {
          confidence_score?: number | null
          correlated_incident_id?: string | null
          correlation_type?: string
          created_at?: string | null
          id?: string
          incident_id?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_correlations_correlated_incident_id_fkey"
            columns: ["correlated_incident_id"]
            isOneToOne: false
            referencedRelation: "admin_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_correlations_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "admin_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          payload: string | null
          severity: string
          source: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          payload?: string | null
          severity: string
          source: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          payload?: string | null
          severity?: string
          source?: string
        }
        Relationships: []
      }
      ingestion_log: {
        Row: {
          banca: string | null
          created_at: string
          created_by: string | null
          duplicates_skipped: number
          errors: number
          id: string
          permission_type: string
          questions_found: number
          questions_inserted: number
          questions_updated: number
          source_name: string
          source_type: string
          source_url: string | null
          status: string
          year: number | null
        }
        Insert: {
          banca?: string | null
          created_at?: string
          created_by?: string | null
          duplicates_skipped?: number
          errors?: number
          id?: string
          permission_type?: string
          questions_found?: number
          questions_inserted?: number
          questions_updated?: number
          source_name: string
          source_type?: string
          source_url?: string | null
          status?: string
          year?: number | null
        }
        Update: {
          banca?: string | null
          created_at?: string
          created_by?: string | null
          duplicates_skipped?: number
          errors?: number
          id?: string
          permission_type?: string
          questions_found?: number
          questions_inserted?: number
          questions_updated?: number
          source_name?: string
          source_type?: string
          source_url?: string | null
          status?: string
          year?: number | null
        }
        Relationships: []
      }
      ingestion_pipeline_runs: {
        Row: {
          finished_at: string | null
          id: string
          logs: string | null
          run_type: string
          source_id: string | null
          started_at: string | null
          stats: Json | null
          status: string | null
        }
        Insert: {
          finished_at?: string | null
          id?: string
          logs?: string | null
          run_type: string
          source_id?: string | null
          started_at?: string | null
          stats?: Json | null
          status?: string | null
        }
        Update: {
          finished_at?: string | null
          id?: string
          logs?: string | null
          run_type?: string
          source_id?: string | null
          started_at?: string | null
          stats?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_pipeline_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "official_exam_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_members: {
        Row: {
          id: string
          institution_id: string
          is_active: boolean | null
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          institution_id: string
          is_active?: boolean | null
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          institution_id?: string
          is_active?: boolean | null
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_members_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          logo_url: string | null
          max_users: number | null
          name: string
          settings_json: Json | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          max_users?: number | null
          name: string
          settings_json?: Json | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          max_users?: number | null
          name?: string
          settings_json?: Json | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      intervention_penalties: {
        Row: {
          created_at: string
          id: string
          intervention_type: string
          last_interaction_at: string
          penalty_level: number
          penalty_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intervention_type: string
          last_interaction_at?: string
          penalty_level?: number
          penalty_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intervention_type?: string
          last_interaction_at?: string
          penalty_level?: number
          penalty_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      intervention_policies: {
        Row: {
          cooldown_minutes: number | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          max_per_day: number | null
          max_per_session: number | null
          min_confidence_score: number | null
          name: string
          severity_level: string | null
          trigger_type: string
        }
        Insert: {
          cooldown_minutes?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_per_day?: number | null
          max_per_session?: number | null
          min_confidence_score?: number | null
          name: string
          severity_level?: string | null
          trigger_type: string
        }
        Update: {
          cooldown_minutes?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_per_day?: number | null
          max_per_session?: number | null
          min_confidence_score?: number | null
          name?: string
          severity_level?: string | null
          trigger_type?: string
        }
        Relationships: []
      }
      intervention_user_profiles: {
        Row: {
          clicked_count: number
          conversion_rate: number
          created_at: string
          ctr: number
          id: string
          intervention_type: string
          last_event_at: string | null
          profile_score: number
          resolved_count: number
          shown_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          clicked_count?: number
          conversion_rate?: number
          created_at?: string
          ctr?: number
          id?: string
          intervention_type: string
          last_event_at?: string | null
          profile_score?: number
          resolved_count?: number
          shown_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          clicked_count?: number
          conversion_rate?: number
          created_at?: string
          ctr?: number
          id?: string
          intervention_type?: string
          last_event_at?: string | null
          profile_score?: number
          resolved_count?: number
          shown_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      knowledge_edges: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          relationship_type: string
          source_node_id: string | null
          strength: number | null
          target_node_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          relationship_type: string
          source_node_id?: string | null
          strength?: number | null
          target_node_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          relationship_type?: string
          source_node_id?: string | null
          strength?: number | null
          target_node_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_nodes: {
        Row: {
          category: string
          code: string
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          name: string
          specialty: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
          specialty: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          specialty?: string
        }
        Relationships: []
      }
      lesson_doubts: {
        Row: {
          created_at: string
          doubt_text: string
          id: string
          lesson_id: string
          resolved: boolean
          segment_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          doubt_text: string
          id?: string
          lesson_id: string
          resolved?: boolean
          segment_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          doubt_text?: string
          id?: string
          lesson_id?: string
          resolved?: boolean
          segment_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_doubts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_doubts_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "lesson_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          current_second: number | null
          id: string
          lesson_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_second?: number | null
          id?: string
          lesson_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_second?: number | null
          id?: string
          lesson_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_ratings: {
        Row: {
          created_at: string | null
          feedback: string | null
          id: string
          lesson_id: string
          rating: number
          updated_at: string | null
          user_id: string
          watched_percentage: number | null
        }
        Insert: {
          created_at?: string | null
          feedback?: string | null
          id?: string
          lesson_id: string
          rating: number
          updated_at?: string | null
          user_id: string
          watched_percentage?: number | null
        }
        Update: {
          created_at?: string | null
          feedback?: string | null
          id?: string
          lesson_id?: string
          rating?: number
          updated_at?: string | null
          user_id?: string
          watched_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_ratings_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "tutor_lesson_memory"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_segments: {
        Row: {
          ai_generated: boolean | null
          created_at: string
          difficulty_score: number | null
          end_second: number | null
          has_flashcards: boolean | null
          has_quiz: boolean | null
          id: string
          key_points: Json | null
          knowledge_node_id: string | null
          lesson_id: string
          ordem: number
          segment_type: string | null
          start_second: number | null
          summary: string | null
          title: string | null
          transcript_segment: string | null
          updated_at: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          created_at?: string
          difficulty_score?: number | null
          end_second?: number | null
          has_flashcards?: boolean | null
          has_quiz?: boolean | null
          id?: string
          key_points?: Json | null
          knowledge_node_id?: string | null
          lesson_id: string
          ordem?: number
          segment_type?: string | null
          start_second?: number | null
          summary?: string | null
          title?: string | null
          transcript_segment?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          created_at?: string
          difficulty_score?: number | null
          end_second?: number | null
          has_flashcards?: boolean | null
          has_quiz?: boolean | null
          id?: string
          key_points?: Json | null
          knowledge_node_id?: string | null
          lesson_id?: string
          ordem?: number
          segment_type?: string | null
          start_second?: number | null
          summary?: string | null
          title?: string | null
          transcript_segment?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_segments_knowledge_node_id_fkey"
            columns: ["knowledge_node_id"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_segments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          audio_url: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          is_active: boolean
          lesson_type: string
          professor_name: string | null
          specialty: string
          subtopic: string | null
          summary_long: string | null
          summary_medium: string | null
          summary_short: string | null
          title: string
          topic: string | null
          transcript: string | null
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          lesson_type?: string
          professor_name?: string | null
          specialty: string
          subtopic?: string | null
          summary_long?: string | null
          summary_medium?: string | null
          summary_short?: string | null
          title: string
          topic?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          lesson_type?: string
          professor_name?: string | null
          specialty?: string
          subtopic?: string | null
          summary_long?: string | null
          summary_medium?: string | null
          summary_short?: string | null
          title?: string
          topic?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      master_content_library: {
        Row: {
          audit_logs: Json | null
          cached_from_id: string | null
          content_hash: string | null
          created_at: string
          created_by: string | null
          discipline: string | null
          double_reviewed: boolean | null
          estimated_cost: number | null
          exam_category: string | null
          export_metadata: Json | null
          exported_at: string | null
          exported_by: string | null
          generated_data: Json | null
          generated_feynman: string | null
          generated_flashcards: Json | null
          generated_mindmap: string | null
          generated_questions: Json | null
          generated_quiz: Json | null
          generated_summary: string | null
          generated_video_script: string | null
          hallucination_count: number | null
          hallucination_risk_score: number | null
          id: string
          impact_score: number | null
          is_gold_standard: boolean | null
          last_error: string | null
          learning_efficiency_rating: number | null
          manual_correction_log: Json | null
          max_retries: number | null
          media_added_at: string | null
          media_added_by: string | null
          media_status: string | null
          metadata: Json | null
          notebooklm_audio_url: string | null
          notebooklm_export_text: string | null
          notebooklm_export_version: string | null
          notebooklm_notes: string | null
          notebooklm_video_url: string | null
          processing_started_at: string | null
          published_at: string | null
          raw_content: string | null
          reliability_score: number | null
          retry_count: number | null
          reviewed_by: string | null
          revision_history: Json | null
          source_type: string
          source_url: string | null
          status: Database["public"]["Enums"]["content_status"] | null
          subtopic: string | null
          target_groups: string[] | null
          title: string
          topic: string | null
          updated_at: string
          visibility: string | null
        }
        Insert: {
          audit_logs?: Json | null
          cached_from_id?: string | null
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          discipline?: string | null
          double_reviewed?: boolean | null
          estimated_cost?: number | null
          exam_category?: string | null
          export_metadata?: Json | null
          exported_at?: string | null
          exported_by?: string | null
          generated_data?: Json | null
          generated_feynman?: string | null
          generated_flashcards?: Json | null
          generated_mindmap?: string | null
          generated_questions?: Json | null
          generated_quiz?: Json | null
          generated_summary?: string | null
          generated_video_script?: string | null
          hallucination_count?: number | null
          hallucination_risk_score?: number | null
          id?: string
          impact_score?: number | null
          is_gold_standard?: boolean | null
          last_error?: string | null
          learning_efficiency_rating?: number | null
          manual_correction_log?: Json | null
          max_retries?: number | null
          media_added_at?: string | null
          media_added_by?: string | null
          media_status?: string | null
          metadata?: Json | null
          notebooklm_audio_url?: string | null
          notebooklm_export_text?: string | null
          notebooklm_export_version?: string | null
          notebooklm_notes?: string | null
          notebooklm_video_url?: string | null
          processing_started_at?: string | null
          published_at?: string | null
          raw_content?: string | null
          reliability_score?: number | null
          retry_count?: number | null
          reviewed_by?: string | null
          revision_history?: Json | null
          source_type: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["content_status"] | null
          subtopic?: string | null
          target_groups?: string[] | null
          title: string
          topic?: string | null
          updated_at?: string
          visibility?: string | null
        }
        Update: {
          audit_logs?: Json | null
          cached_from_id?: string | null
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          discipline?: string | null
          double_reviewed?: boolean | null
          estimated_cost?: number | null
          exam_category?: string | null
          export_metadata?: Json | null
          exported_at?: string | null
          exported_by?: string | null
          generated_data?: Json | null
          generated_feynman?: string | null
          generated_flashcards?: Json | null
          generated_mindmap?: string | null
          generated_questions?: Json | null
          generated_quiz?: Json | null
          generated_summary?: string | null
          generated_video_script?: string | null
          hallucination_count?: number | null
          hallucination_risk_score?: number | null
          id?: string
          impact_score?: number | null
          is_gold_standard?: boolean | null
          last_error?: string | null
          learning_efficiency_rating?: number | null
          manual_correction_log?: Json | null
          max_retries?: number | null
          media_added_at?: string | null
          media_added_by?: string | null
          media_status?: string | null
          metadata?: Json | null
          notebooklm_audio_url?: string | null
          notebooklm_export_text?: string | null
          notebooklm_export_version?: string | null
          notebooklm_notes?: string | null
          notebooklm_video_url?: string | null
          processing_started_at?: string | null
          published_at?: string | null
          raw_content?: string | null
          reliability_score?: number | null
          retry_count?: number | null
          reviewed_by?: string | null
          revision_history?: Json | null
          source_type?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["content_status"] | null
          subtopic?: string | null
          target_groups?: string[] | null
          title?: string
          topic?: string | null
          updated_at?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_content_library_cached_from_id_fkey"
            columns: ["cached_from_id"]
            isOneToOne: false
            referencedRelation: "master_content_library"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_ai_prompts: {
        Row: {
          created_at: string | null
          created_by: string | null
          feynman_prompt: string | null
          flashcard_prompt: string | null
          id: string
          is_active: boolean | null
          prompt_name: string
          prompt_version: string
          quiz_prompt: string | null
          review_prompt: string | null
          specialty: string
          system_prompt: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          feynman_prompt?: string | null
          flashcard_prompt?: string | null
          id?: string
          is_active?: boolean | null
          prompt_name: string
          prompt_version: string
          quiz_prompt?: string | null
          review_prompt?: string | null
          specialty: string
          system_prompt: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          feynman_prompt?: string | null
          flashcard_prompt?: string | null
          id?: string
          is_active?: boolean | null
          prompt_name?: string
          prompt_version?: string
          quiz_prompt?: string | null
          review_prompt?: string | null
          specialty?: string
          system_prompt?: string
        }
        Relationships: []
      }
      medical_benchmarks: {
        Row: {
          avg_retention_fsrs: number | null
          avg_review_time_seconds: number | null
          benchmark_date: string | null
          content_id: string | null
          error_rate: number | null
          id: string
          metadata: Json | null
          sample_size_students: number | null
          simulation_performance_score: number | null
          specialty: string
          tenant_id: string
        }
        Insert: {
          avg_retention_fsrs?: number | null
          avg_review_time_seconds?: number | null
          benchmark_date?: string | null
          content_id?: string | null
          error_rate?: number | null
          id?: string
          metadata?: Json | null
          sample_size_students?: number | null
          simulation_performance_score?: number | null
          specialty: string
          tenant_id: string
        }
        Update: {
          avg_retention_fsrs?: number | null
          avg_review_time_seconds?: number | null
          benchmark_date?: string | null
          content_id?: string | null
          error_rate?: number | null
          id?: string
          metadata?: Json | null
          sample_size_students?: number | null
          simulation_performance_score?: number | null
          specialty?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_benchmarks_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "master_content_library"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_chronicles: {
        Row: {
          content: string
          created_at: string
          difficulty: string
          id: string
          osce_payload: Json | null
          specialty: string
          structured_data: Json | null
          subtopic: string | null
          topic: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          difficulty?: string
          id?: string
          osce_payload?: Json | null
          specialty: string
          structured_data?: Json | null
          subtopic?: string | null
          topic: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          difficulty?: string
          id?: string
          osce_payload?: Json | null
          specialty?: string
          structured_data?: Json | null
          subtopic?: string | null
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      medical_content_scores: {
        Row: {
          approved: boolean | null
          clinical_safety_score: number | null
          clinical_utility_score: number | null
          content_id: string
          created_at: string | null
          depth_score: number | null
          exam_utility_score: number | null
          feynman_quality_score: number | null
          final_score: number | null
          flashcard_quality_score: number | null
          guideline_adherence_score: number | null
          hallucination_risk_score: number | null
          id: string
          pedagogical_clarity_score: number | null
          quiz_quality_score: number | null
          reliability_score: number | null
          review_notes: string | null
          reviewer_id: string
          scientific_accuracy_score: number | null
        }
        Insert: {
          approved?: boolean | null
          clinical_safety_score?: number | null
          clinical_utility_score?: number | null
          content_id: string
          created_at?: string | null
          depth_score?: number | null
          exam_utility_score?: number | null
          feynman_quality_score?: number | null
          final_score?: number | null
          flashcard_quality_score?: number | null
          guideline_adherence_score?: number | null
          hallucination_risk_score?: number | null
          id?: string
          pedagogical_clarity_score?: number | null
          quiz_quality_score?: number | null
          reliability_score?: number | null
          review_notes?: string | null
          reviewer_id: string
          scientific_accuracy_score?: number | null
        }
        Update: {
          approved?: boolean | null
          clinical_safety_score?: number | null
          clinical_utility_score?: number | null
          content_id?: string
          created_at?: string | null
          depth_score?: number | null
          exam_utility_score?: number | null
          feynman_quality_score?: number | null
          final_score?: number | null
          flashcard_quality_score?: number | null
          guideline_adherence_score?: number | null
          hallucination_risk_score?: number | null
          id?: string
          pedagogical_clarity_score?: number | null
          quiz_quality_score?: number | null
          reliability_score?: number | null
          review_notes?: string | null
          reviewer_id?: string
          scientific_accuracy_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_content_scores_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "master_content_library"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_domain_map: {
        Row: {
          avg_difficulty: number
          clinical_cases_score: number
          correct_answers: number
          created_at: string
          domain_score: number
          errors_count: number
          id: string
          last_studied_at: string | null
          questions_answered: number
          reviews_count: number
          specialty: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_difficulty?: number
          clinical_cases_score?: number
          correct_answers?: number
          created_at?: string
          domain_score?: number
          errors_count?: number
          id?: string
          last_studied_at?: string | null
          questions_answered?: number
          reviews_count?: number
          specialty: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_difficulty?: number
          clinical_cases_score?: number
          correct_answers?: number
          created_at?: string
          domain_score?: number
          errors_count?: number
          id?: string
          last_studied_at?: string | null
          questions_answered?: number
          reviews_count?: number
          specialty?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      medical_image_assets: {
        Row: {
          access_type: string | null
          ai_confidence: number | null
          ai_type: string | null
          ai_validated: boolean | null
          asset_code: string
          asset_origin: string
          clinical_confidence: number
          clinical_findings: Json
          clinical_validation_notes: string | null
          created_at: string
          curation_notes: string | null
          diagnosis: string
          diagnostic_confidence_score: number | null
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          distractors: Json
          duplicate_group_key: string | null
          hash_integrity: string | null
          id: string
          image_type: Database["public"]["Enums"]["medical_image_type"]
          image_url: string
          incidence_weight: number
          integrity_status: string | null
          is_active: boolean
          license_type: string
          multimodal_ready: boolean | null
          quality_gate_passed: boolean | null
          question_generated: boolean
          rejection_reason: string | null
          review_status: Database["public"]["Enums"]["image_review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          source_domain: string | null
          source_reference: string | null
          source_url: string | null
          specialty: string
          subtopic: string
          thumbnail_url: string | null
          tri_a: number
          tri_b: number
          tri_c: number
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_level: string | null
          version: number
          visual_coherence_score: number | null
        }
        Insert: {
          access_type?: string | null
          ai_confidence?: number | null
          ai_type?: string | null
          ai_validated?: boolean | null
          asset_code: string
          asset_origin?: string
          clinical_confidence?: number
          clinical_findings?: Json
          clinical_validation_notes?: string | null
          created_at?: string
          curation_notes?: string | null
          diagnosis: string
          diagnostic_confidence_score?: number | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          distractors?: Json
          duplicate_group_key?: string | null
          hash_integrity?: string | null
          id?: string
          image_type: Database["public"]["Enums"]["medical_image_type"]
          image_url: string
          incidence_weight?: number
          integrity_status?: string | null
          is_active?: boolean
          license_type?: string
          multimodal_ready?: boolean | null
          quality_gate_passed?: boolean | null
          question_generated?: boolean
          rejection_reason?: string | null
          review_status?: Database["public"]["Enums"]["image_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_domain?: string | null
          source_reference?: string | null
          source_url?: string | null
          specialty: string
          subtopic: string
          thumbnail_url?: string | null
          tri_a?: number
          tri_b?: number
          tri_c?: number
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_level?: string | null
          version?: number
          visual_coherence_score?: number | null
        }
        Update: {
          access_type?: string | null
          ai_confidence?: number | null
          ai_type?: string | null
          ai_validated?: boolean | null
          asset_code?: string
          asset_origin?: string
          clinical_confidence?: number
          clinical_findings?: Json
          clinical_validation_notes?: string | null
          created_at?: string
          curation_notes?: string | null
          diagnosis?: string
          diagnostic_confidence_score?: number | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          distractors?: Json
          duplicate_group_key?: string | null
          hash_integrity?: string | null
          id?: string
          image_type?: Database["public"]["Enums"]["medical_image_type"]
          image_url?: string
          incidence_weight?: number
          integrity_status?: string | null
          is_active?: boolean
          license_type?: string
          multimodal_ready?: boolean | null
          quality_gate_passed?: boolean | null
          question_generated?: boolean
          rejection_reason?: string | null
          review_status?: Database["public"]["Enums"]["image_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_domain?: string | null
          source_reference?: string | null
          source_url?: string | null
          specialty?: string
          subtopic?: string
          thumbnail_url?: string | null
          tri_a?: number
          tri_b?: number
          tri_c?: number
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_level?: string | null
          version?: number
          visual_coherence_score?: number | null
        }
        Relationships: []
      }
      medical_image_attempts: {
        Row: {
          asset_id: string | null
          correct: boolean
          created_at: string
          id: string
          image_id: string | null
          image_type: string | null
          question_id: string | null
          selected_index: number
          time_seconds: number | null
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          correct: boolean
          created_at?: string
          id?: string
          image_id?: string | null
          image_type?: string | null
          question_id?: string | null
          selected_index: number
          time_seconds?: number | null
          user_id: string
        }
        Update: {
          asset_id?: string | null
          correct?: boolean
          created_at?: string
          id?: string
          image_id?: string | null
          image_type?: string | null
          question_id?: string | null
          selected_index?: number
          time_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_image_attempts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "medical_image_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_image_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "medical_image_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_image_question_audit: {
        Row: {
          action_type: string
          actor: string
          asset_id: string | null
          created_at: string
          id: string
          new_payload: Json | null
          notes: string | null
          old_payload: Json | null
          question_id: string | null
        }
        Insert: {
          action_type: string
          actor: string
          asset_id?: string | null
          created_at?: string
          id?: string
          new_payload?: Json | null
          notes?: string | null
          old_payload?: Json | null
          question_id?: string | null
        }
        Update: {
          action_type?: string
          actor?: string
          asset_id?: string | null
          created_at?: string
          id?: string
          new_payload?: Json | null
          notes?: string | null
          old_payload?: Json | null
          question_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_image_question_audit_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "medical_image_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_image_question_audit_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "medical_image_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_image_questions: {
        Row: {
          asset_id: string
          batch_id: string | null
          correct_index: number
          created_at: string
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          discussion: Json | null
          editorial_grade: string | null
          editorial_score: number | null
          exam_style: string
          exam_tips: string[] | null
          explanation: string
          hard_validation_reasons: string[] | null
          hard_validation_score: number | null
          id: string
          is_batch_protected: boolean | null
          language_code: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          option_e: string | null
          pitfalls: string[] | null
          question_code: string
          question_mode: string | null
          rationale_map: Json | null
          senior_audit_score: number | null
          statement: string
          status: Database["public"]["Enums"]["image_question_status"]
          tri_a: number
          tri_b: number
          tri_c: number
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          asset_id: string
          batch_id?: string | null
          correct_index: number
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          discussion?: Json | null
          editorial_grade?: string | null
          editorial_score?: number | null
          exam_style?: string
          exam_tips?: string[] | null
          explanation: string
          hard_validation_reasons?: string[] | null
          hard_validation_score?: number | null
          id?: string
          is_batch_protected?: boolean | null
          language_code?: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          option_e?: string | null
          pitfalls?: string[] | null
          question_code: string
          question_mode?: string | null
          rationale_map?: Json | null
          senior_audit_score?: number | null
          statement: string
          status?: Database["public"]["Enums"]["image_question_status"]
          tri_a?: number
          tri_b?: number
          tri_c?: number
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          asset_id?: string
          batch_id?: string | null
          correct_index?: number
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          discussion?: Json | null
          editorial_grade?: string | null
          editorial_score?: number | null
          exam_style?: string
          exam_tips?: string[] | null
          explanation?: string
          hard_validation_reasons?: string[] | null
          hard_validation_score?: number | null
          id?: string
          is_batch_protected?: boolean | null
          language_code?: string
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          option_e?: string | null
          pitfalls?: string[] | null
          question_code?: string
          question_mode?: string | null
          rationale_map?: Json | null
          senior_audit_score?: number | null
          statement?: string
          status?: Database["public"]["Enums"]["image_question_status"]
          tri_a?: number
          tri_b?: number
          tri_c?: number
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_image_questions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "medical_image_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_image_questions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "multimodal_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_images: {
        Row: {
          category: string
          correct_index: number
          created_at: string
          created_by: string | null
          diagnosis: string
          difficulty: number
          explanation: string | null
          id: string
          image_source: string | null
          image_url: string
          is_active: boolean
          options: Json
          subcategory: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          category?: string
          correct_index?: number
          created_at?: string
          created_by?: string | null
          diagnosis: string
          difficulty?: number
          explanation?: string | null
          id?: string
          image_source?: string | null
          image_url: string
          is_active?: boolean
          options?: Json
          subcategory?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          category?: string
          correct_index?: number
          created_at?: string
          created_by?: string | null
          diagnosis?: string
          difficulty?: number
          explanation?: string | null
          id?: string
          image_source?: string | null
          image_url?: string
          is_active?: boolean
          options?: Json
          subcategory?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      medical_prompt_execution_logs: {
        Row: {
          cache_status: string | null
          content_id: string | null
          created_at: string | null
          error_message: string | null
          estimated_cost: number | null
          hallucination_risk: string | null
          id: string
          input_tokens: number | null
          json_validation_status: string | null
          latency_ms: number | null
          model: string | null
          output_tokens: number | null
          prompt_id: string | null
          prompt_version: string | null
          specialty: string | null
          status: string | null
        }
        Insert: {
          cache_status?: string | null
          content_id?: string | null
          created_at?: string | null
          error_message?: string | null
          estimated_cost?: number | null
          hallucination_risk?: string | null
          id?: string
          input_tokens?: number | null
          json_validation_status?: string | null
          latency_ms?: number | null
          model?: string | null
          output_tokens?: number | null
          prompt_id?: string | null
          prompt_version?: string | null
          specialty?: string | null
          status?: string | null
        }
        Update: {
          cache_status?: string | null
          content_id?: string | null
          created_at?: string | null
          error_message?: string | null
          estimated_cost?: number | null
          hallucination_risk?: string | null
          id?: string
          input_tokens?: number | null
          json_validation_status?: string | null
          latency_ms?: number | null
          model?: string | null
          output_tokens?: number | null
          prompt_id?: string | null
          prompt_version?: string | null
          specialty?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_prompt_execution_logs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "master_content_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_prompt_execution_logs_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "medical_ai_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_prompt_execution_logs_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompt_performance_analytics"
            referencedColumns: ["prompt_id"]
          },
        ]
      }
      medical_terms: {
        Row: {
          aliases: string[] | null
          created_at: string | null
          definition_json: Json | null
          id: string
          specialty: string | null
          term: string
          updated_at: string | null
        }
        Insert: {
          aliases?: string[] | null
          created_at?: string | null
          definition_json?: Json | null
          id?: string
          specialty?: string | null
          term: string
          updated_at?: string | null
        }
        Update: {
          aliases?: string[] | null
          created_at?: string | null
          definition_json?: Json | null
          id?: string
          specialty?: string | null
          term?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      mental_maps: {
        Row: {
          content_json: Json
          created_at: string
          difficulty: string | null
          flashcards_count: number
          id: string
          questions_count: number
          source_topic: string | null
          source_type: string | null
          specialty: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_json?: Json
          created_at?: string
          difficulty?: string | null
          flashcards_count?: number
          id?: string
          questions_count?: number
          source_topic?: string | null
          source_type?: string | null
          specialty?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_json?: Json
          created_at?: string
          difficulty?: string | null
          flashcards_count?: number
          id?: string
          questions_count?: number
          source_topic?: string | null
          source_type?: string | null
          specialty?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mentor_theme_plan_progress: {
        Row: {
          correct_answers: number
          created_at: string
          id: string
          plan_id: string
          questions_answered: number
          status: string
          study_time_minutes: number
          topic_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          correct_answers?: number
          created_at?: string
          id?: string
          plan_id: string
          questions_answered?: number
          status?: string
          study_time_minutes?: number
          topic_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          correct_answers?: number
          created_at?: string
          id?: string
          plan_id?: string
          questions_answered?: number
          status?: string
          study_time_minutes?: number
          topic_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_theme_plan_progress_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "mentor_theme_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_theme_plan_progress_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "mentor_theme_plan_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_theme_plan_targets: {
        Row: {
          created_at: string
          id: string
          plan_id: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_id: string
          target_id: string
          target_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_theme_plan_targets_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "mentor_theme_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_theme_plan_topics: {
        Row: {
          created_at: string
          id: string
          plan_id: string
          priority: number
          subtopic: string | null
          topic: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_id: string
          priority?: number
          subtopic?: string | null
          topic: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_id?: string
          priority?: number
          subtopic?: string | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_theme_plan_topics_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "mentor_theme_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_theme_plans: {
        Row: {
          created_at: string
          description: string | null
          exam_date: string | null
          id: string
          name: string
          professor_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          exam_date?: string | null
          id?: string
          name: string
          professor_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          exam_date?: string | null
          id?: string
          name?: string
          professor_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      mnemonic_agent_logs: {
        Row: {
          agent_name: string
          created_at: string
          duration_ms: number | null
          error_message: string | null
          execution_order: number
          id: string
          input_json: Json
          output_json: Json
          request_id: string
          result_id: string | null
          score: number | null
          status: string
          user_id: string
        }
        Insert: {
          agent_name: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          execution_order?: number
          id?: string
          input_json?: Json
          output_json?: Json
          request_id: string
          result_id?: string | null
          score?: number | null
          status?: string
          user_id: string
        }
        Update: {
          agent_name?: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          execution_order?: number
          id?: string
          input_json?: Json
          output_json?: Json
          request_id?: string
          result_id?: string | null
          score?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mnemonic_agent_logs_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "mnemonic_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mnemonic_agent_logs_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "mnemonic_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mnemonic_agent_logs_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "v_mnemonic_latest_results"
            referencedColumns: ["id"]
          },
        ]
      }
      mnemonic_assets: {
        Row: {
          content_type: string
          created_at: string
          hash: string
          id: string
          image_prompt_original: string | null
          image_prompt_refined: string | null
          image_url: string | null
          impact_score: number | null
          items_json: Json
          items_map_json: Json
          medical_score: number
          mnemonic: string
          pedagogical_score: number
          phrase: string
          quality_score: number
          review_question: string | null
          scene_description: string | null
          source_reference: string | null
          subtopic: string | null
          topic: string
          updated_at: string
          verdict: string
          visual_audit_summary: string | null
          visual_regeneration_count: number | null
          visual_score: number | null
        }
        Insert: {
          content_type: string
          created_at?: string
          hash: string
          id?: string
          image_prompt_original?: string | null
          image_prompt_refined?: string | null
          image_url?: string | null
          impact_score?: number | null
          items_json: Json
          items_map_json: Json
          medical_score?: number
          mnemonic: string
          pedagogical_score?: number
          phrase: string
          quality_score?: number
          review_question?: string | null
          scene_description?: string | null
          source_reference?: string | null
          subtopic?: string | null
          topic: string
          updated_at?: string
          verdict?: string
          visual_audit_summary?: string | null
          visual_regeneration_count?: number | null
          visual_score?: number | null
        }
        Update: {
          content_type?: string
          created_at?: string
          hash?: string
          id?: string
          image_prompt_original?: string | null
          image_prompt_refined?: string | null
          image_url?: string | null
          impact_score?: number | null
          items_json?: Json
          items_map_json?: Json
          medical_score?: number
          mnemonic?: string
          pedagogical_score?: number
          phrase?: string
          quality_score?: number
          review_question?: string | null
          scene_description?: string | null
          source_reference?: string | null
          subtopic?: string | null
          topic?: string
          updated_at?: string
          verdict?: string
          visual_audit_summary?: string | null
          visual_regeneration_count?: number | null
          visual_score?: number | null
        }
        Relationships: []
      }
      mnemonic_favorites: {
        Row: {
          created_at: string
          id: string
          result_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          result_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          result_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mnemonic_favorites_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "mnemonic_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mnemonic_favorites_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "v_mnemonic_latest_results"
            referencedColumns: ["id"]
          },
        ]
      }
      mnemonic_feedback: {
        Row: {
          comentario: string | null
          created_at: string
          id: string
          rating_general: number | null
          rating_medical: number | null
          rating_pedagogical: number | null
          request_id: string | null
          result_id: string | null
          user_id: string
          utility_score: number | null
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          id?: string
          rating_general?: number | null
          rating_medical?: number | null
          rating_pedagogical?: number | null
          request_id?: string | null
          result_id?: string | null
          user_id: string
          utility_score?: number | null
        }
        Update: {
          comentario?: string | null
          created_at?: string
          id?: string
          rating_general?: number | null
          rating_medical?: number | null
          rating_pedagogical?: number | null
          request_id?: string | null
          result_id?: string | null
          user_id?: string
          utility_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mnemonic_feedback_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "mnemonic_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mnemonic_feedback_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "mnemonic_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mnemonic_feedback_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "v_mnemonic_latest_results"
            referencedColumns: ["id"]
          },
        ]
      }
      mnemonic_requests: {
        Row: {
          created_at: string
          estilo: string | null
          id: string
          idioma: string | null
          publico: string | null
          source: string | null
          status: string
          tema: string
          termos_json: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estilo?: string | null
          id?: string
          idioma?: string | null
          publico?: string | null
          source?: string | null
          status?: string
          tema: string
          termos_json?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          estilo?: string | null
          id?: string
          idioma?: string | null
          publico?: string | null
          source?: string | null
          status?: string
          tema?: string
          termos_json?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mnemonic_results: {
        Row: {
          alertas_json: Json
          aprovado: boolean
          aprovado_medico: boolean
          aprovado_pedagogico: boolean
          associacoes_json: Json
          associacoes_visuais_json: Json
          cena_visual: string | null
          created_at: string
          explicacao_didatica: string | null
          explicacao_tecnica: string | null
          frase_mnemonica: string
          id: string
          image_url: string | null
          is_latest: boolean
          prompt_imagem: string | null
          request_id: string
          score_final: number
          score_linguistico: number | null
          score_medico: number
          score_pedagogico: number
          sigla: string
          tema: string
          updated_at: string
          user_id: string
          versao: number
        }
        Insert: {
          alertas_json?: Json
          aprovado?: boolean
          aprovado_medico?: boolean
          aprovado_pedagogico?: boolean
          associacoes_json?: Json
          associacoes_visuais_json?: Json
          cena_visual?: string | null
          created_at?: string
          explicacao_didatica?: string | null
          explicacao_tecnica?: string | null
          frase_mnemonica: string
          id?: string
          image_url?: string | null
          is_latest?: boolean
          prompt_imagem?: string | null
          request_id: string
          score_final?: number
          score_linguistico?: number | null
          score_medico?: number
          score_pedagogico?: number
          sigla: string
          tema: string
          updated_at?: string
          user_id: string
          versao?: number
        }
        Update: {
          alertas_json?: Json
          aprovado?: boolean
          aprovado_medico?: boolean
          aprovado_pedagogico?: boolean
          associacoes_json?: Json
          associacoes_visuais_json?: Json
          cena_visual?: string | null
          created_at?: string
          explicacao_didatica?: string | null
          explicacao_tecnica?: string | null
          frase_mnemonica?: string
          id?: string
          image_url?: string | null
          is_latest?: boolean
          prompt_imagem?: string | null
          request_id?: string
          score_final?: number
          score_linguistico?: number | null
          score_medico?: number
          score_pedagogico?: number
          sigla?: string
          tema?: string
          updated_at?: string
          user_id?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "mnemonic_results_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "mnemonic_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      module_sessions: {
        Row: {
          created_at: string
          id: string
          module_key: string
          session_data: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_key: string
          session_data?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module_key?: string
          session_data?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      multimodal_audit_logs: {
        Row: {
          action: string
          created_at: string | null
          created_by: string | null
          error_message: string | null
          id: string
          latency_ms: number | null
          module: string
          payload: Json | null
          response: Json | null
          status: string
        }
        Insert: {
          action: string
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          module: string
          payload?: Json | null
          response?: Json | null
          status: string
        }
        Update: {
          action?: string
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          module?: string
          payload?: Json | null
          response?: Json | null
          status?: string
        }
        Relationships: []
      }
      multimodal_batches: {
        Row: {
          avg_editorial_score: number | null
          batch_code: string
          consolidated_at: string
          created_at: string
          id: string
          modalities_covered: string[] | null
          notes: string | null
          status: string
          total_auto_corrected: number
          total_questions: number
          updated_at: string
        }
        Insert: {
          avg_editorial_score?: number | null
          batch_code: string
          consolidated_at?: string
          created_at?: string
          id?: string
          modalities_covered?: string[] | null
          notes?: string | null
          status?: string
          total_auto_corrected?: number
          total_questions?: number
          updated_at?: string
        }
        Update: {
          avg_editorial_score?: number | null
          batch_code?: string
          consolidated_at?: string
          created_at?: string
          id?: string
          modalities_covered?: string[] | null
          notes?: string | null
          status?: string
          total_auto_corrected?: number
          total_questions?: number
          updated_at?: string
        }
        Relationships: []
      }
      multimodal_health_status: {
        Row: {
          id: string
          last_check_at: string | null
          last_error: string | null
          metadata: Json | null
          module_name: string
          status: string
        }
        Insert: {
          id?: string
          last_check_at?: string | null
          last_error?: string | null
          metadata?: Json | null
          module_name: string
          status: string
        }
        Update: {
          id?: string
          last_check_at?: string | null
          last_error?: string | null
          metadata?: Json | null
          module_name?: string
          status?: string
        }
        Relationships: []
      }
      multimodal_safety_log: {
        Row: {
          asset_code: string | null
          asset_id: string | null
          asset_origin: string | null
          block_reason: string
          clinical_confidence: number | null
          created_at: string
          fallback_used: boolean | null
          id: string
          integrity_status: string | null
          review_status: string | null
        }
        Insert: {
          asset_code?: string | null
          asset_id?: string | null
          asset_origin?: string | null
          block_reason: string
          clinical_confidence?: number | null
          created_at?: string
          fallback_used?: boolean | null
          id?: string
          integrity_status?: string | null
          review_status?: string | null
        }
        Update: {
          asset_code?: string | null
          asset_id?: string | null
          asset_origin?: string | null
          block_reason?: string
          clinical_confidence?: number | null
          created_at?: string
          fallback_used?: boolean | null
          id?: string
          integrity_status?: string | null
          review_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "multimodal_safety_log_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "medical_image_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      notebooklm_export_logs: {
        Row: {
          content_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          status: string
          user_id: string | null
        }
        Insert: {
          content_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          status: string
          user_id?: string | null
        }
        Update: {
          content_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notebooklm_export_logs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "master_content_library"
            referencedColumns: ["id"]
          },
        ]
      }
      notebooklm_notebooks: {
        Row: {
          audio_url: string | null
          avg_completion_rate: number | null
          content_id: string | null
          created_at: string | null
          exported_by: string | null
          id: string
          media_status: string | null
          notebook_title: string
          notebook_url: string | null
          notes_url: string | null
          specialty: string | null
          total_views: number | null
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          audio_url?: string | null
          avg_completion_rate?: number | null
          content_id?: string | null
          created_at?: string | null
          exported_by?: string | null
          id?: string
          media_status?: string | null
          notebook_title: string
          notebook_url?: string | null
          notes_url?: string | null
          specialty?: string | null
          total_views?: number | null
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          audio_url?: string | null
          avg_completion_rate?: number | null
          content_id?: string | null
          created_at?: string | null
          exported_by?: string | null
          id?: string
          media_status?: string | null
          notebook_title?: string
          notebook_url?: string | null
          notes_url?: string | null
          specialty?: string | null
          total_views?: number | null
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notebooklm_notebooks_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "master_content_library"
            referencedColumns: ["id"]
          },
        ]
      }
      notebooklm_usage_logs: {
        Row: {
          action: string
          completion_rate: number | null
          content_id: string | null
          created_at: string | null
          id: string
          media_type: string | null
          playback_time: number | null
          user_id: string | null
        }
        Insert: {
          action: string
          completion_rate?: number | null
          content_id?: string | null
          created_at?: string | null
          id?: string
          media_type?: string | null
          playback_time?: number | null
          user_id?: string | null
        }
        Update: {
          action?: string
          completion_rate?: number | null
          content_id?: string | null
          created_at?: string | null
          id?: string
          media_type?: string | null
          playback_time?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notebooklm_usage_logs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "master_content_library"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          priority: number | null
          sent_at: string | null
          status: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          priority?: number | null
          sent_at?: string | null
          status?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          priority?: number | null
          sent_at?: string | null
          status?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      official_exam_files: {
        Row: {
          checksum_sha256: string | null
          created_at: string | null
          file_name: string
          file_url: string
          id: string
          metadata: Json | null
          source_id: string | null
          status: string | null
          storage_path: string | null
          updated_at: string | null
        }
        Insert: {
          checksum_sha256?: string | null
          created_at?: string | null
          file_name: string
          file_url: string
          id?: string
          metadata?: Json | null
          source_id?: string | null
          status?: string | null
          storage_path?: string | null
          updated_at?: string | null
        }
        Update: {
          checksum_sha256?: string | null
          created_at?: string | null
          file_name?: string
          file_url?: string
          id?: string
          metadata?: Json | null
          source_id?: string | null
          status?: string | null
          storage_path?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "official_exam_files_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "official_exam_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      official_exam_questions: {
        Row: {
          alternativas: Json
          confidence_score: number | null
          created_at: string | null
          disciplina: string | null
          enunciado: string
          file_id: string | null
          id: string
          metadata: Json | null
          question_number: number | null
          resposta: string
        }
        Insert: {
          alternativas: Json
          confidence_score?: number | null
          created_at?: string | null
          disciplina?: string | null
          enunciado: string
          file_id?: string | null
          id?: string
          metadata?: Json | null
          question_number?: number | null
          resposta: string
        }
        Update: {
          alternativas?: Json
          confidence_score?: number | null
          created_at?: string | null
          disciplina?: string | null
          enunciado?: string
          file_id?: string | null
          id?: string
          metadata?: Json | null
          question_number?: number | null
          resposta?: string
        }
        Relationships: [
          {
            foreignKeyName: "official_exam_questions_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "official_exam_files"
            referencedColumns: ["id"]
          },
        ]
      }
      official_exam_sources: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          url: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      operational_digests: {
        Row: {
          content: Json | null
          created_at: string | null
          digest_type: string
          id: string
          period_end: string | null
          period_start: string | null
          status: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          digest_type: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          status?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          digest_type?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          status?: string | null
        }
        Relationships: []
      }
      operational_playbooks: {
        Row: {
          created_at: string | null
          id: string
          incident_type: string
          mitigation_strategy: string | null
          steps: Json
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          incident_type: string
          mitigation_strategy?: string | null
          steps: Json
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          incident_type?: string
          mitigation_strategy?: string | null
          steps?: Json
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      orchestrator_outcomes: {
        Row: {
          created_at: string
          decision_id: string | null
          error_reduction: number | null
          exploration: boolean | null
          followed: boolean | null
          id: string
          improvement_delta: number | null
          measured_at: string
          modality: string | null
          next_action: string
          outcome: string | null
          phase: string | null
          post_signals: Json | null
          pre_signals: Json | null
          retention_delta: number | null
          subtopic: string | null
          time_to_follow_seconds: number | null
          topic: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          decision_id?: string | null
          error_reduction?: number | null
          exploration?: boolean | null
          followed?: boolean | null
          id?: string
          improvement_delta?: number | null
          measured_at?: string
          modality?: string | null
          next_action: string
          outcome?: string | null
          phase?: string | null
          post_signals?: Json | null
          pre_signals?: Json | null
          retention_delta?: number | null
          subtopic?: string | null
          time_to_follow_seconds?: number | null
          topic?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          decision_id?: string | null
          error_reduction?: number | null
          exploration?: boolean | null
          followed?: boolean | null
          id?: string
          improvement_delta?: number | null
          measured_at?: string
          modality?: string | null
          next_action?: string
          outcome?: string | null
          phase?: string | null
          post_signals?: Json | null
          pre_signals?: Json | null
          retention_delta?: number | null
          subtopic?: string | null
          time_to_follow_seconds?: number | null
          topic?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orchestrator_outcomes_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "assistant_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      orchestrator_rule_weights: {
        Row: {
          baseline_weight: number
          category: string | null
          cooldown_minutes: number | null
          created_at: string
          current_weight: number
          failure_count: number
          last_adjusted_at: string | null
          notes: string | null
          rule_id: string
          rule_name: string
          success_count: number
          updated_at: string
        }
        Insert: {
          baseline_weight?: number
          category?: string | null
          cooldown_minutes?: number | null
          created_at?: string
          current_weight?: number
          failure_count?: number
          last_adjusted_at?: string | null
          notes?: string | null
          rule_id: string
          rule_name: string
          success_count?: number
          updated_at?: string
        }
        Update: {
          baseline_weight?: number
          category?: string | null
          cooldown_minutes?: number | null
          created_at?: string
          current_weight?: number
          failure_count?: number
          last_adjusted_at?: string | null
          notes?: string | null
          rule_id?: string
          rule_name?: string
          success_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      pedagogical_insights: {
        Row: {
          error_rate: number | null
          evolution_trend: string | null
          id: string
          last_updated_at: string | null
          predicted_approval_rate: number | null
          retention_score: number | null
          topic_id: string | null
          user_id: string | null
        }
        Insert: {
          error_rate?: number | null
          evolution_trend?: string | null
          id?: string
          last_updated_at?: string | null
          predicted_approval_rate?: number | null
          retention_score?: number | null
          topic_id?: string | null
          user_id?: string | null
        }
        Update: {
          error_rate?: number | null
          evolution_trend?: string | null
          id?: string
          last_updated_at?: string | null
          predicted_approval_rate?: number | null
          retention_score?: number | null
          topic_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pedagogical_reviews: {
        Row: {
          adherence_to_guidelines_score: number | null
          clarity_score: number | null
          clinical_safety_score: number | null
          comments: string | null
          content_id: string | null
          correction_count: number | null
          depth_score: number | null
          didactic_score: number | null
          exam_utility_score: number | null
          feynman_quality_score: number | null
          flashcards_quality_score: number | null
          hallucination_risk: string | null
          id: string
          notebooklm_script_quality_score: number | null
          precision_score: number | null
          quality_label: string | null
          quiz_quality_score: number | null
          reliability_score: number | null
          review_type: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          scientific_accuracy_score: number | null
          score: number | null
          specific_specialist_id: string | null
        }
        Insert: {
          adherence_to_guidelines_score?: number | null
          clarity_score?: number | null
          clinical_safety_score?: number | null
          comments?: string | null
          content_id?: string | null
          correction_count?: number | null
          depth_score?: number | null
          didactic_score?: number | null
          exam_utility_score?: number | null
          feynman_quality_score?: number | null
          flashcards_quality_score?: number | null
          hallucination_risk?: string | null
          id?: string
          notebooklm_script_quality_score?: number | null
          precision_score?: number | null
          quality_label?: string | null
          quiz_quality_score?: number | null
          reliability_score?: number | null
          review_type?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          scientific_accuracy_score?: number | null
          score?: number | null
          specific_specialist_id?: string | null
        }
        Update: {
          adherence_to_guidelines_score?: number | null
          clarity_score?: number | null
          clinical_safety_score?: number | null
          comments?: string | null
          content_id?: string | null
          correction_count?: number | null
          depth_score?: number | null
          didactic_score?: number | null
          exam_utility_score?: number | null
          feynman_quality_score?: number | null
          flashcards_quality_score?: number | null
          hallucination_risk?: string | null
          id?: string
          notebooklm_script_quality_score?: number | null
          precision_score?: number | null
          quality_label?: string | null
          quiz_quality_score?: number | null
          reliability_score?: number | null
          review_type?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          scientific_accuracy_score?: number | null
          score?: number | null
          specific_specialist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedagogical_reviews_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "master_content_library"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_by_topic: {
        Row: {
          accuracy: number
          average_response_time_ms: number | null
          correct_questions: number
          created_at: string
          id: string
          last_activity_at: string | null
          specialty: string
          subtopic: string | null
          topic: string
          total_questions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy?: number
          average_response_time_ms?: number | null
          correct_questions?: number
          created_at?: string
          id?: string
          last_activity_at?: string | null
          specialty: string
          subtopic?: string | null
          topic: string
          total_questions?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy?: number
          average_response_time_ms?: number | null
          correct_questions?: number
          created_at?: string
          id?: string
          last_activity_at?: string | null
          specialty?: string
          subtopic?: string | null
          topic?: string
          total_questions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      performance_predictions: {
        Row: {
          approval_probability: number
          created_at: string
          details_json: Json | null
          estimated_ranking: number | null
          estimated_score: number
          id: string
          predicted_at: string
          trend: string | null
          user_id: string
        }
        Insert: {
          approval_probability?: number
          created_at?: string
          details_json?: Json | null
          estimated_ranking?: number | null
          estimated_score?: number
          id?: string
          predicted_at?: string
          trend?: string | null
          user_id: string
        }
        Update: {
          approval_probability?: number
          created_at?: string
          details_json?: Json | null
          estimated_ranking?: number | null
          estimated_score?: number
          id?: string
          predicted_at?: string
          trend?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pipeline_alerts: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string | null
          details: Json | null
          id: string
          message: string
          run_id: string | null
          severity: string
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string | null
          details?: Json | null
          id?: string
          message: string
          run_id?: string | null
          severity?: string
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          message?: string
          run_id?: string | null
          severity?: string
        }
        Relationships: []
      }
      pipeline_lock: {
        Row: {
          dataset_type: string | null
          id: number
          is_running: boolean
          started_at: string | null
          updated_at: string
        }
        Insert: {
          dataset_type?: string | null
          id?: number
          is_running?: boolean
          started_at?: string | null
          updated_at?: string
        }
        Update: {
          dataset_type?: string | null
          id?: number
          is_running?: boolean
          started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_logs: {
        Row: {
          assets_created: number
          assets_validated: number
          batch_size: number
          created_at: string
          dataset_type: string
          error_details: Json | null
          errors: number
          execution_time_ms: number | null
          id: string
          items_processed: number
          mode: string
          questions_generated: number
        }
        Insert: {
          assets_created?: number
          assets_validated?: number
          batch_size?: number
          created_at?: string
          dataset_type: string
          error_details?: Json | null
          errors?: number
          execution_time_ms?: number | null
          id?: string
          items_processed?: number
          mode?: string
          questions_generated?: number
        }
        Update: {
          assets_created?: number
          assets_validated?: number
          batch_size?: number
          created_at?: string
          dataset_type?: string
          error_details?: Json | null
          errors?: number
          execution_time_ms?: number | null
          id?: string
          items_processed?: number
          mode?: string
          questions_generated?: number
        }
        Relationships: []
      }
      pipeline_progress: {
        Row: {
          created_at: string
          dataset_type: string
          id: string
          last_processed_id: string | null
          last_processed_index: number
          last_run_at: string | null
          status: string
          total_generated: number
          total_processed: number
          total_validated: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          dataset_type: string
          id?: string
          last_processed_id?: string | null
          last_processed_index?: number
          last_run_at?: string | null
          status?: string
          total_generated?: number
          total_processed?: number
          total_validated?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          dataset_type?: string
          id?: string
          last_processed_id?: string | null
          last_processed_index?: number
          last_run_at?: string | null
          status?: string
          total_generated?: number
          total_processed?: number
          total_validated?: number
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          features_json: Json | null
          id: string
          name: string
          price: number
        }
        Insert: {
          created_at?: string
          features_json?: Json | null
          id?: string
          name: string
          price?: number
        }
        Update: {
          created_at?: string
          features_json?: Json | null
          id?: string
          name?: string
          price?: number
        }
        Relationships: []
      }
      platform_config: {
        Row: {
          id: number
          telegram_chat_id: string | null
          telegram_group_link: string | null
          updated_at: string
        }
        Insert: {
          id: number
          telegram_chat_id?: string | null
          telegram_group_link?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          telegram_chat_id?: string | null
          telegram_group_link?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      practical_exam_results: {
        Row: {
          case_summary: string | null
          created_at: string
          difficulty: string
          feedback_json: Json
          final_score: number
          id: string
          scores_json: Json
          specialty: string
          steps_json: Json
          time_total_seconds: number
          user_id: string
        }
        Insert: {
          case_summary?: string | null
          created_at?: string
          difficulty?: string
          feedback_json?: Json
          final_score?: number
          id?: string
          scores_json?: Json
          specialty: string
          steps_json?: Json
          time_total_seconds?: number
          user_id: string
        }
        Update: {
          case_summary?: string | null
          created_at?: string
          difficulty?: string
          feedback_json?: Json
          final_score?: number
          id?: string
          scores_json?: Json
          specialty?: string
          steps_json?: Json
          time_total_seconds?: number
          user_id?: string
        }
        Relationships: []
      }
      practice_attempts: {
        Row: {
          correct: boolean
          created_at: string
          event_hash: string | null
          id: string
          question_id: string
          user_id: string
        }
        Insert: {
          correct: boolean
          created_at?: string
          event_hash?: string | null
          id?: string
          question_id: string
          user_id: string
        }
        Update: {
          correct?: boolean
          created_at?: string
          event_hash?: string | null
          id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_bank"
            referencedColumns: ["id"]
          },
        ]
      }
      professor_plan_daily_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          plan_id: string
          planned_date: string
          source: string
          status: string
          task_hash: string | null
          task_payload: Json
          task_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          plan_id: string
          planned_date: string
          source?: string
          status?: string
          task_hash?: string | null
          task_payload?: Json
          task_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          plan_id?: string
          planned_date?: string
          source?: string
          status?: string
          task_hash?: string | null
          task_payload?: Json
          task_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professor_plan_daily_tasks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "professor_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      professor_plan_linked_resources: {
        Row: {
          created_at: string
          id: string
          plan_id: string
          resource_id: string
          resource_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_id: string
          resource_id: string
          resource_type: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_id?: string
          resource_id?: string
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "professor_plan_linked_resources_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "professor_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      professor_plan_progress: {
        Row: {
          completed_tasks: number
          current_week: number
          id: string
          last_activity_at: string | null
          overdue_tasks: number
          pending_tasks: number
          plan_id: string
          progress_percent: number
          updated_at: string
          user_id: string
          weekly_goal_status: string
        }
        Insert: {
          completed_tasks?: number
          current_week?: number
          id?: string
          last_activity_at?: string | null
          overdue_tasks?: number
          pending_tasks?: number
          plan_id: string
          progress_percent?: number
          updated_at?: string
          user_id: string
          weekly_goal_status?: string
        }
        Update: {
          completed_tasks?: number
          current_week?: number
          id?: string
          last_activity_at?: string | null
          overdue_tasks?: number
          pending_tasks?: number
          plan_id?: string
          progress_percent?: number
          updated_at?: string
          user_id?: string
          weekly_goal_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "professor_plan_progress_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "professor_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      professor_plan_recalculations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          plan_id: string
          reason: string | null
          recalculation_type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          plan_id: string
          reason?: string | null
          recalculation_type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          plan_id?: string
          reason?: string | null
          recalculation_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professor_plan_recalculations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "professor_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      professor_plan_subtopics: {
        Row: {
          created_at: string
          id: string
          plan_id: string
          sort_order: number | null
          subtopic_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_id: string
          sort_order?: number | null
          subtopic_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_id?: string
          sort_order?: number | null
          subtopic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professor_plan_subtopics_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "professor_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professor_plan_subtopics_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professor_plan_subtopics_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["subtopic_id"]
          },
          {
            foreignKeyName: "professor_plan_subtopics_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_subtopic_question_density"
            referencedColumns: ["subtopic_id"]
          },
        ]
      }
      professor_plan_targets: {
        Row: {
          class_id: string | null
          created_at: string
          id: string
          plan_id: string
          user_id: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          id?: string
          plan_id: string
          user_id?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string
          id?: string
          plan_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professor_plan_targets_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "professor_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      professor_plans: {
        Row: {
          created_at: string
          created_by: string
          exam_date: string | null
          id: string
          intensity: string
          name: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          exam_date?: string | null
          id?: string
          intensity?: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          exam_date?: string | null
          id?: string
          intensity?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      professor_turma_students: {
        Row: {
          created_at: string | null
          student_id: string
          turma_id: string
        }
        Insert: {
          created_at?: string | null
          student_id: string
          turma_id: string
        }
        Update: {
          created_at?: string | null
          student_id?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professor_turma_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professor_turma_students_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "professor_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      professor_turmas: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          professor_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          professor_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          professor_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professor_turmas_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          created_at: string
          daily_study_hours: number | null
          display_name: string | null
          domain_id: string | null
          email: string | null
          exam_date: string | null
          experience_reset_at: string | null
          faculdade: string | null
          full_name: string | null
          has_completed_diagnostic: boolean | null
          id: string
          is_blocked: boolean
          last_onboarding_step: number | null
          last_study_plan_reset_at: string | null
          onboarding_version: number
          organization_id: string | null
          periodo: number | null
          phone: string | null
          role: string | null
          status: string
          study_mode: string | null
          target_exam: string | null
          target_exams: string[] | null
          target_specialty: string | null
          updated_at: string
          user_id: string
          user_type: string
          whatsapp_daily_bi: boolean
          whatsapp_opt_out: boolean
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          created_at?: string
          daily_study_hours?: number | null
          display_name?: string | null
          domain_id?: string | null
          email?: string | null
          exam_date?: string | null
          experience_reset_at?: string | null
          faculdade?: string | null
          full_name?: string | null
          has_completed_diagnostic?: boolean | null
          id?: string
          is_blocked?: boolean
          last_onboarding_step?: number | null
          last_study_plan_reset_at?: string | null
          onboarding_version?: number
          organization_id?: string | null
          periodo?: number | null
          phone?: string | null
          role?: string | null
          status?: string
          study_mode?: string | null
          target_exam?: string | null
          target_exams?: string[] | null
          target_specialty?: string | null
          updated_at?: string
          user_id: string
          user_type?: string
          whatsapp_daily_bi?: boolean
          whatsapp_opt_out?: boolean
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          created_at?: string
          daily_study_hours?: number | null
          display_name?: string | null
          domain_id?: string | null
          email?: string | null
          exam_date?: string | null
          experience_reset_at?: string | null
          faculdade?: string | null
          full_name?: string | null
          has_completed_diagnostic?: boolean | null
          id?: string
          is_blocked?: boolean
          last_onboarding_step?: number | null
          last_study_plan_reset_at?: string | null
          onboarding_version?: number
          organization_id?: string | null
          periodo?: number | null
          phone?: string | null
          role?: string | null
          status?: string
          study_mode?: string | null
          target_exam?: string | null
          target_exams?: string[] | null
          target_specialty?: string | null
          updated_at?: string
          user_id?: string
          user_type?: string
          whatsapp_daily_bi?: boolean
          whatsapp_opt_out?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_auto_fixes: {
        Row: {
          action_taken: string
          created_at: string
          duration_ms: number | null
          event_id: string
          finding_id: string | null
          id: string
          result_after: Json | null
          result_before: Json | null
          success: boolean
        }
        Insert: {
          action_taken: string
          created_at?: string
          duration_ms?: number | null
          event_id: string
          finding_id?: string | null
          id?: string
          result_after?: Json | null
          result_before?: Json | null
          success?: boolean
        }
        Update: {
          action_taken?: string
          created_at?: string
          duration_ms?: number | null
          event_id?: string
          finding_id?: string | null
          id?: string
          result_after?: Json | null
          result_before?: Json | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "qa_auto_fixes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "qa_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_auto_fixes_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "qa_findings"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_escalations: {
        Row: {
          acknowledged: boolean
          created_at: string
          event_id: string
          finding_id: string | null
          hypothesis_primary: string | null
          hypothesis_secondary: string | null
          id: string
          recommended_action: string | null
          report: string
          status: string | null
        }
        Insert: {
          acknowledged?: boolean
          created_at?: string
          event_id: string
          finding_id?: string | null
          hypothesis_primary?: string | null
          hypothesis_secondary?: string | null
          id?: string
          recommended_action?: string | null
          report: string
          status?: string | null
        }
        Update: {
          acknowledged?: boolean
          created_at?: string
          event_id?: string
          finding_id?: string | null
          hypothesis_primary?: string | null
          hypothesis_secondary?: string | null
          id?: string
          recommended_action?: string | null
          report?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_escalations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "qa_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_escalations_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "qa_findings"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_events: {
        Row: {
          causa_provavel: string | null
          created_at: string
          details: Json | null
          error_type: Database["public"]["Enums"]["qa_error_type"]
          id: string
          impacto: string | null
          module: string
          payload: Json | null
          resolved_at: string | null
          run_id: string | null
          severity: Database["public"]["Enums"]["qa_severity"]
          status: Database["public"]["Enums"]["qa_fix_status"]
        }
        Insert: {
          causa_provavel?: string | null
          created_at?: string
          details?: Json | null
          error_type: Database["public"]["Enums"]["qa_error_type"]
          id?: string
          impacto?: string | null
          module: string
          payload?: Json | null
          resolved_at?: string | null
          run_id?: string | null
          severity?: Database["public"]["Enums"]["qa_severity"]
          status?: Database["public"]["Enums"]["qa_fix_status"]
        }
        Update: {
          causa_provavel?: string | null
          created_at?: string
          details?: Json | null
          error_type?: Database["public"]["Enums"]["qa_error_type"]
          id?: string
          impacto?: string | null
          module?: string
          payload?: Json | null
          resolved_at?: string | null
          run_id?: string | null
          severity?: Database["public"]["Enums"]["qa_severity"]
          status?: Database["public"]["Enums"]["qa_fix_status"]
        }
        Relationships: []
      }
      qa_findings: {
        Row: {
          affected_records: number | null
          created_at: string
          description: string | null
          evidence_json: Json | null
          finding_type: string
          id: string
          module: string
          probable_cause: string | null
          qa_run_id: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          affected_records?: number | null
          created_at?: string
          description?: string | null
          evidence_json?: Json | null
          finding_type: string
          id?: string
          module: string
          probable_cause?: string | null
          qa_run_id?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          affected_records?: number | null
          created_at?: string
          description?: string | null
          evidence_json?: Json | null
          finding_type?: string
          id?: string
          module?: string
          probable_cause?: string | null
          qa_run_id?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_findings_qa_run_id_fkey"
            columns: ["qa_run_id"]
            isOneToOne: false
            referencedRelation: "qa_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_revalidations: {
        Row: {
          created_at: string
          details: string | null
          finding_id: string
          fix_id: string | null
          id: string
          passed: boolean
          revalidated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          finding_id: string
          fix_id?: string | null
          id?: string
          passed?: boolean
          revalidated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          finding_id?: string
          fix_id?: string | null
          id?: string
          passed?: boolean
          revalidated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_revalidations_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "qa_findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_revalidations_fix_id_fkey"
            columns: ["fix_id"]
            isOneToOne: false
            referencedRelation: "qa_auto_fixes"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_runs: {
        Row: {
          auto_fix_rate_pct: number | null
          created_at: string
          duration_ms: number | null
          finished_at: string | null
          id: string
          level: number
          modules_checked: Json | null
          previous_comparison: Json | null
          run_type: string
          started_at: string
          status: string
          summary_report: Json | null
          total_corrected: number | null
          total_detected: number | null
          total_escalated: number | null
          total_findings: number | null
          total_partial: number | null
        }
        Insert: {
          auto_fix_rate_pct?: number | null
          created_at?: string
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          level?: number
          modules_checked?: Json | null
          previous_comparison?: Json | null
          run_type?: string
          started_at?: string
          status?: string
          summary_report?: Json | null
          total_corrected?: number | null
          total_detected?: number | null
          total_escalated?: number | null
          total_findings?: number | null
          total_partial?: number | null
        }
        Update: {
          auto_fix_rate_pct?: number | null
          created_at?: string
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          level?: number
          modules_checked?: Json | null
          previous_comparison?: Json | null
          run_type?: string
          started_at?: string
          status?: string
          summary_report?: Json | null
          total_corrected?: number | null
          total_detected?: number | null
          total_escalated?: number | null
          total_findings?: number | null
          total_partial?: number | null
        }
        Relationships: []
      }
      qa_test_results: {
        Row: {
          created_at: string
          details_json: Json | null
          duration_ms: number | null
          error_message: string | null
          id: string
          module_tested: string | null
          run_id: string
          status: string
          suggestion: string | null
          test_name: string
          test_suite: string
        }
        Insert: {
          created_at?: string
          details_json?: Json | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          module_tested?: string | null
          run_id: string
          status?: string
          suggestion?: string | null
          test_name: string
          test_suite: string
        }
        Update: {
          created_at?: string
          details_json?: Json | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          module_tested?: string | null
          run_id?: string
          status?: string
          suggestion?: string | null
          test_name?: string
          test_suite?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_test_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "qa_test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_test_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          failed_tests: number
          finished_at: string | null
          id: string
          passed_tests: number
          run_type: string
          started_at: string
          status: string
          summary_json: Json | null
          total_tests: number
          warning_tests: number
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          failed_tests?: number
          finished_at?: string | null
          id?: string
          passed_tests?: number
          run_type?: string
          started_at?: string
          status?: string
          summary_json?: Json | null
          total_tests?: number
          warning_tests?: number
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          failed_tests?: number
          finished_at?: string | null
          id?: string
          passed_tests?: number
          run_type?: string
          started_at?: string
          status?: string
          summary_json?: Json | null
          total_tests?: number
          warning_tests?: number
        }
        Relationships: []
      }
      question_classification_queue: {
        Row: {
          classification_method: string
          confidence_score: number
          created_at: string
          id: string
          original_subtopic: string | null
          original_topic: string | null
          question_id: string
          reason: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          run_id: string | null
          status: string
          suggested_microtopic_id: string | null
          suggested_specialty_id: string | null
          suggested_subtopic_id: string | null
          suggested_topic_id: string | null
          table_source: string
          updated_at: string
        }
        Insert: {
          classification_method: string
          confidence_score: number
          created_at?: string
          id?: string
          original_subtopic?: string | null
          original_topic?: string | null
          question_id: string
          reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          run_id?: string | null
          status?: string
          suggested_microtopic_id?: string | null
          suggested_specialty_id?: string | null
          suggested_subtopic_id?: string | null
          suggested_topic_id?: string | null
          table_source: string
          updated_at?: string
        }
        Update: {
          classification_method?: string
          confidence_score?: number
          created_at?: string
          id?: string
          original_subtopic?: string | null
          original_topic?: string | null
          question_id?: string
          reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          run_id?: string | null
          status?: string
          suggested_microtopic_id?: string | null
          suggested_specialty_id?: string | null
          suggested_subtopic_id?: string | null
          suggested_topic_id?: string | null
          table_source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_classification_queue_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "question_classification_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_classification_queue_suggested_microtopic_id_fkey"
            columns: ["suggested_microtopic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_microtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_classification_queue_suggested_specialty_id_fkey"
            columns: ["suggested_specialty_id"]
            isOneToOne: false
            referencedRelation: "curriculum_specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_classification_queue_suggested_specialty_id_fkey"
            columns: ["suggested_specialty_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["specialty_id"]
          },
          {
            foreignKeyName: "question_classification_queue_suggested_subtopic_id_fkey"
            columns: ["suggested_subtopic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_classification_queue_suggested_subtopic_id_fkey"
            columns: ["suggested_subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["subtopic_id"]
          },
          {
            foreignKeyName: "question_classification_queue_suggested_subtopic_id_fkey"
            columns: ["suggested_subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_subtopic_question_density"
            referencedColumns: ["subtopic_id"]
          },
          {
            foreignKeyName: "question_classification_queue_suggested_topic_id_fkey"
            columns: ["suggested_topic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_classification_queue_suggested_topic_id_fkey"
            columns: ["suggested_topic_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["topic_id"]
          },
        ]
      }
      question_classification_runs: {
        Row: {
          alias_exact_count: number | null
          batch_size: number
          created_at: string
          deterministic_pct: number | null
          dry_run: boolean
          error_message: string | null
          exact_text_count: number | null
          finished_at: string | null
          heuristic_count: number | null
          heuristic_pct: number | null
          id: string
          method_breakdown: Json
          notes: string | null
          queue_pct: number | null
          skipped_pct: number | null
          started_at: string
          status: string
          table_source: string
          total_applied: number
          total_processed: number
          total_queued_review: number
          total_skipped: number
          triggered_by: string | null
        }
        Insert: {
          alias_exact_count?: number | null
          batch_size: number
          created_at?: string
          deterministic_pct?: number | null
          dry_run?: boolean
          error_message?: string | null
          exact_text_count?: number | null
          finished_at?: string | null
          heuristic_count?: number | null
          heuristic_pct?: number | null
          id?: string
          method_breakdown?: Json
          notes?: string | null
          queue_pct?: number | null
          skipped_pct?: number | null
          started_at?: string
          status?: string
          table_source: string
          total_applied?: number
          total_processed?: number
          total_queued_review?: number
          total_skipped?: number
          triggered_by?: string | null
        }
        Update: {
          alias_exact_count?: number | null
          batch_size?: number
          created_at?: string
          deterministic_pct?: number | null
          dry_run?: boolean
          error_message?: string | null
          exact_text_count?: number | null
          finished_at?: string | null
          heuristic_count?: number | null
          heuristic_pct?: number | null
          id?: string
          method_breakdown?: Json
          notes?: string | null
          queue_pct?: number | null
          skipped_pct?: number | null
          started_at?: string
          status?: string
          table_source?: string
          total_applied?: number
          total_processed?: number
          total_queued_review?: number
          total_skipped?: number
          triggered_by?: string | null
        }
        Relationships: []
      }
      question_generation_run_items: {
        Row: {
          asset_code: string | null
          asset_id: string
          created_at: string
          diagnosis: string | null
          error_message: string | null
          generated_count: number
          id: string
          image_type: string | null
          payload: Json | null
          run_id: string
          status: string
        }
        Insert: {
          asset_code?: string | null
          asset_id: string
          created_at?: string
          diagnosis?: string | null
          error_message?: string | null
          generated_count?: number
          id?: string
          image_type?: string | null
          payload?: Json | null
          run_id: string
          status: string
        }
        Update: {
          asset_code?: string | null
          asset_id?: string
          created_at?: string
          diagnosis?: string | null
          error_message?: string | null
          generated_count?: number
          id?: string
          image_type?: string | null
          payload?: Json | null
          run_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_generation_run_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "question_generation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      question_generation_runs: {
        Row: {
          details: Json | null
          failed_assets: number
          finished_at: string | null
          generated_questions: number
          id: string
          notes: string | null
          processed_assets: number
          run_type: string
          started_at: string
          status: string
          target_assets: number
        }
        Insert: {
          details?: Json | null
          failed_assets?: number
          finished_at?: string | null
          generated_questions?: number
          id?: string
          notes?: string | null
          processed_assets?: number
          run_type: string
          started_at?: string
          status?: string
          target_assets?: number
        }
        Update: {
          details?: Json | null
          failed_assets?: number
          finished_at?: string | null
          generated_questions?: number
          id?: string
          notes?: string | null
          processed_assets?: number
          run_type?: string
          started_at?: string
          status?: string
          target_assets?: number
        }
        Relationships: []
      }
      question_quality_flags: {
        Row: {
          created_at: string
          detected_by: string
          flag_reason: string | null
          flag_type: string
          id: string
          question_id: string
          resolved_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          detected_by?: string
          flag_reason?: string | null
          flag_type?: string
          id?: string
          question_id: string
          resolved_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          detected_by?: string
          flag_reason?: string | null
          flag_type?: string
          id?: string
          question_id?: string
          resolved_at?: string | null
          status?: string
        }
        Relationships: []
      }
      question_topic_links: {
        Row: {
          created_at: string
          id: string
          match_confidence: number | null
          match_method: string | null
          microtopic_id: string | null
          question_id: string
          question_source: string
          subtopic_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          match_confidence?: number | null
          match_method?: string | null
          microtopic_id?: string | null
          question_id: string
          question_source: string
          subtopic_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          match_confidence?: number | null
          match_method?: string | null
          microtopic_id?: string | null
          question_id?: string
          question_source?: string
          subtopic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_topic_links_microtopic_id_fkey"
            columns: ["microtopic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_microtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_topic_links_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_topic_links_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["subtopic_id"]
          },
          {
            foreignKeyName: "question_topic_links_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_subtopic_question_density"
            referencedColumns: ["subtopic_id"]
          },
        ]
      }
      question_topic_map: {
        Row: {
          confidence: number
          created_at: string
          id: string
          mapped_topic_text: string | null
          mapping_source: string | null
          question_id: string
          subtopic_id: string | null
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          id?: string
          mapped_topic_text?: string | null
          mapping_source?: string | null
          question_id: string
          subtopic_id?: string | null
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          mapped_topic_text?: string | null
          mapping_source?: string | null
          question_id?: string
          subtopic_id?: string | null
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_topic_map_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_bank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_topic_map_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_topic_map_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["subtopic_id"]
          },
          {
            foreignKeyName: "question_topic_map_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_subtopic_question_density"
            referencedColumns: ["subtopic_id"]
          },
          {
            foreignKeyName: "question_topic_map_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_topic_map_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["topic_id"]
          },
        ]
      }
      question_usage_logs: {
        Row: {
          answered_correctly: boolean | null
          created_at: string
          id: string
          question_id: string
          response_time_ms: number | null
          selected_answer: number | null
          session_id: string | null
          source_mode: string | null
          user_id: string
        }
        Insert: {
          answered_correctly?: boolean | null
          created_at?: string
          id?: string
          question_id: string
          response_time_ms?: number | null
          selected_answer?: number | null
          session_id?: string | null
          source_mode?: string | null
          user_id: string
        }
        Update: {
          answered_correctly?: boolean | null
          created_at?: string
          id?: string
          question_id?: string
          response_time_ms?: number | null
          selected_answer?: number | null
          session_id?: string | null
          source_mode?: string | null
          user_id?: string
        }
        Relationships: []
      }
      questions_bank: {
        Row: {
          classification_confidence: number | null
          classification_method: string | null
          classification_reviewed_by_human: boolean
          classified_at: string | null
          correct_index: number | null
          created_at: string
          difficulty: number | null
          exam_bank_id: string | null
          explanation: string | null
          id: string
          image_url: string | null
          is_global: boolean | null
          language: string | null
          microtopic_id: string | null
          options: Json | null
          organization_id: string | null
          original_question_id: string | null
          permission_type: string | null
          quality_tier: string
          question_order: number | null
          review_status: string | null
          source: string | null
          source_map_id: string | null
          source_type: string | null
          source_url: string | null
          specialty_id: string | null
          statement: string
          subtopic: string | null
          subtopic_id: string | null
          topic: string | null
          topic_id: string | null
          user_id: string
        }
        Insert: {
          classification_confidence?: number | null
          classification_method?: string | null
          classification_reviewed_by_human?: boolean
          classified_at?: string | null
          correct_index?: number | null
          created_at?: string
          difficulty?: number | null
          exam_bank_id?: string | null
          explanation?: string | null
          id?: string
          image_url?: string | null
          is_global?: boolean | null
          language?: string | null
          microtopic_id?: string | null
          options?: Json | null
          organization_id?: string | null
          original_question_id?: string | null
          permission_type?: string | null
          quality_tier?: string
          question_order?: number | null
          review_status?: string | null
          source?: string | null
          source_map_id?: string | null
          source_type?: string | null
          source_url?: string | null
          specialty_id?: string | null
          statement: string
          subtopic?: string | null
          subtopic_id?: string | null
          topic?: string | null
          topic_id?: string | null
          user_id: string
        }
        Update: {
          classification_confidence?: number | null
          classification_method?: string | null
          classification_reviewed_by_human?: boolean
          classified_at?: string | null
          correct_index?: number | null
          created_at?: string
          difficulty?: number | null
          exam_bank_id?: string | null
          explanation?: string | null
          id?: string
          image_url?: string | null
          is_global?: boolean | null
          language?: string | null
          microtopic_id?: string | null
          options?: Json | null
          organization_id?: string | null
          original_question_id?: string | null
          permission_type?: string | null
          quality_tier?: string
          question_order?: number | null
          review_status?: string | null
          source?: string | null
          source_map_id?: string | null
          source_type?: string | null
          source_url?: string | null
          specialty_id?: string | null
          statement?: string
          subtopic?: string | null
          subtopic_id?: string | null
          topic?: string | null
          topic_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_bank_exam_bank_id_fkey"
            columns: ["exam_bank_id"]
            isOneToOne: false
            referencedRelation: "exam_banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_bank_microtopic_id_fkey"
            columns: ["microtopic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_microtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_bank_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_bank_original_question_id_fkey"
            columns: ["original_question_id"]
            isOneToOne: false
            referencedRelation: "questions_bank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_bank_source_map_id_fkey"
            columns: ["source_map_id"]
            isOneToOne: false
            referencedRelation: "mental_maps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_bank_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "curriculum_specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_bank_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["specialty_id"]
          },
          {
            foreignKeyName: "questions_bank_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_bank_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["subtopic_id"]
          },
          {
            foreignKeyName: "questions_bank_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_subtopic_question_density"
            referencedColumns: ["subtopic_id"]
          },
          {
            foreignKeyName: "questions_bank_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_bank_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["topic_id"]
          },
        ]
      }
      queue_jobs: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          job_type: string
          max_attempts: number
          payload_json: Json
          priority: number
          result_json: Json | null
          scheduled_for: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_type: string
          max_attempts?: number
          payload_json?: Json
          priority?: number
          result_json?: Json | null
          scheduled_for?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_type?: string
          max_attempts?: number
          payload_json?: Json
          priority?: number
          result_json?: Json | null
          scheduled_for?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      queue_results: {
        Row: {
          created_at: string
          id: string
          job_id: string
          result_json: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          result_json?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          result_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "queue_results_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "queue_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          id: string
          metadata: Json | null
          organization_id: string
          page_number: number | null
          section_title: string | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          id?: string
          metadata?: Json | null
          organization_id: string
          page_number?: number | null
          section_title?: string | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          page_number?: number | null
          section_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "rag_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_documents: {
        Row: {
          created_at: string
          error_message: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          is_active: boolean | null
          is_published: boolean | null
          organization_id: string
          published_at: string | null
          replaced_by: string | null
          status: string
          title: string
          updated_at: string
          uploaded_by: string
          version: number | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          is_active?: boolean | null
          is_published?: boolean | null
          organization_id: string
          published_at?: string | null
          replaced_by?: string | null
          status?: string
          title: string
          updated_at?: string
          uploaded_by: string
          version?: number | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          is_active?: boolean | null
          is_published?: boolean | null
          organization_id?: string
          published_at?: string | null
          replaced_by?: string | null
          status?: string
          title?: string
          updated_at?: string
          uploaded_by?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_documents_replaced_by_fkey"
            columns: ["replaced_by"]
            isOneToOne: false
            referencedRelation: "rag_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_embeddings: {
        Row: {
          chunk_id: string
          created_at: string
          embedding: string | null
          id: string
          model: string
          organization_id: string
        }
        Insert: {
          chunk_id: string
          created_at?: string
          embedding?: string | null
          id?: string
          model?: string
          organization_id: string
        }
        Update: {
          chunk_id?: string
          created_at?: string
          embedding?: string | null
          id?: string
          model?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rag_embeddings_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "rag_chunks"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_processing_jobs: {
        Row: {
          created_at: string
          created_by: string
          document_id: string
          error_message: string | null
          finished_at: string | null
          id: string
          logs: Json | null
          organization_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by: string
          document_id: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          logs?: Json | null
          organization_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          document_id?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          logs?: Json | null
          organization_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rag_processing_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "rag_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_publication_logs: {
        Row: {
          action: string
          created_at: string | null
          document_id: string | null
          id: string
          metadata: Json | null
          organization_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          document_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          document_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_publication_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "rag_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_snapshots: {
        Row: {
          consistency_rank: number | null
          consistency_rank_delta: number | null
          consistency_score: number
          created_at: string
          details_json: Json | null
          evolution_rank: number | null
          evolution_rank_delta: number | null
          evolution_score: number
          id: string
          percentile: number | null
          performance_rank: number | null
          performance_rank_delta: number | null
          performance_score: number
          practical_rank: number | null
          practical_rank_delta: number | null
          practical_score: number
          snapshot_date: string
          user_id: string
        }
        Insert: {
          consistency_rank?: number | null
          consistency_rank_delta?: number | null
          consistency_score?: number
          created_at?: string
          details_json?: Json | null
          evolution_rank?: number | null
          evolution_rank_delta?: number | null
          evolution_score?: number
          id?: string
          percentile?: number | null
          performance_rank?: number | null
          performance_rank_delta?: number | null
          performance_score?: number
          practical_rank?: number | null
          practical_rank_delta?: number | null
          practical_score?: number
          snapshot_date?: string
          user_id: string
        }
        Update: {
          consistency_rank?: number | null
          consistency_rank_delta?: number | null
          consistency_score?: number
          created_at?: string
          details_json?: Json | null
          evolution_rank?: number | null
          evolution_rank_delta?: number | null
          evolution_score?: number
          id?: string
          percentile?: number | null
          performance_rank?: number | null
          performance_rank_delta?: number | null
          performance_score?: number
          practical_rank?: number | null
          practical_rank_delta?: number | null
          practical_score?: number
          snapshot_date?: string
          user_id?: string
        }
        Relationships: []
      }
      real_exam_questions: {
        Row: {
          answer_source: string
          classification_confidence: number | null
          classification_method: string | null
          classification_reviewed_by_human: boolean
          classified_at: string | null
          confidence_score: number
          correct_index: number | null
          created_at: string
          difficulty: number
          exam_info: string | null
          explanation: string | null
          id: string
          is_active: boolean
          microtopic_id: string | null
          options: Json
          quality_score: number
          source_url: string
          specialty_id: string | null
          statement: string
          statement_hash: string
          subtopic: string | null
          subtopic_id: string | null
          topic: string
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          answer_source?: string
          classification_confidence?: number | null
          classification_method?: string | null
          classification_reviewed_by_human?: boolean
          classified_at?: string | null
          confidence_score?: number
          correct_index?: number | null
          created_at?: string
          difficulty?: number
          exam_info?: string | null
          explanation?: string | null
          id?: string
          is_active?: boolean
          microtopic_id?: string | null
          options?: Json
          quality_score?: number
          source_url: string
          specialty_id?: string | null
          statement: string
          statement_hash: string
          subtopic?: string | null
          subtopic_id?: string | null
          topic: string
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          answer_source?: string
          classification_confidence?: number | null
          classification_method?: string | null
          classification_reviewed_by_human?: boolean
          classified_at?: string | null
          confidence_score?: number
          correct_index?: number | null
          created_at?: string
          difficulty?: number
          exam_info?: string | null
          explanation?: string | null
          id?: string
          is_active?: boolean
          microtopic_id?: string | null
          options?: Json
          quality_score?: number
          source_url?: string
          specialty_id?: string | null
          statement?: string
          statement_hash?: string
          subtopic?: string | null
          subtopic_id?: string | null
          topic?: string
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "real_exam_questions_microtopic_id_fkey"
            columns: ["microtopic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_microtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "real_exam_questions_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "curriculum_specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "real_exam_questions_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["specialty_id"]
          },
          {
            foreignKeyName: "real_exam_questions_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "real_exam_questions_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["subtopic_id"]
          },
          {
            foreignKeyName: "real_exam_questions_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_subtopic_question_density"
            referencedColumns: ["subtopic_id"]
          },
          {
            foreignKeyName: "real_exam_questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "real_exam_questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["topic_id"]
          },
        ]
      }
      recovery_events: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          payload_json: Json | null
          recovery_run_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          payload_json?: Json | null
          recovery_run_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          payload_json?: Json | null
          recovery_run_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_events_recovery_run_id_fkey"
            columns: ["recovery_run_id"]
            isOneToOne: false
            referencedRelation: "recovery_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_runs: {
        Row: {
          active: boolean
          created_at: string
          ended_at: string | null
          id: string
          mode: string
          phase: number
          reason: string | null
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          ended_at?: string | null
          id?: string
          mode?: string
          phase?: number
          reason?: string | null
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          ended_at?: string | null
          id?: string
          mode?: string
          phase?: number
          reason?: string | null
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          created_at: string
          flashcard_id: string
          id: string
          interval_days: number
          next_review: string
          user_id: string
        }
        Insert: {
          created_at?: string
          flashcard_id: string
          id?: string
          interval_days?: number
          next_review?: string
          user_id: string
        }
        Update: {
          created_at?: string
          flashcard_id?: string
          id?: string
          interval_days?: number
          next_review?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      revisoes: {
        Row: {
          concluida_em: string | null
          created_at: string
          data_revisao: string
          fsrs_card_id: string | null
          id: string
          prioridade: number | null
          risco_esquecimento: string | null
          status: string
          tema_id: string
          tipo_revisao: string
          updated_at: string
          user_id: string
        }
        Insert: {
          concluida_em?: string | null
          created_at?: string
          data_revisao: string
          fsrs_card_id?: string | null
          id?: string
          prioridade?: number | null
          risco_esquecimento?: string | null
          status?: string
          tema_id: string
          tipo_revisao: string
          updated_at?: string
          user_id: string
        }
        Update: {
          concluida_em?: string | null
          created_at?: string
          data_revisao?: string
          fsrs_card_id?: string | null
          id?: string
          prioridade?: number | null
          risco_esquecimento?: string | null
          status?: string
          tema_id?: string
          tipo_revisao?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revisoes_fsrs_card_id_fkey"
            columns: ["fsrs_card_id"]
            isOneToOne: false
            referencedRelation: "fsrs_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revisoes_tema_id_fkey"
            columns: ["tema_id"]
            isOneToOne: false
            referencedRelation: "temas_estudados"
            referencedColumns: ["id"]
          },
        ]
      }
      scraping_runs: {
        Row: {
          banca: string | null
          candidate_blocks_found: number
          created_at: string
          duplicates_found: number
          english_leaked: number
          error_message: string | null
          finished_at: string | null
          id: string
          queries_executed: number
          questions_accepted: number
          questions_extracted: number
          questions_rejected: number
          rejection_reasons: Json
          sources_used: Json
          specialty: string
          started_at: string
          status: string
          urls_tested: number
        }
        Insert: {
          banca?: string | null
          candidate_blocks_found?: number
          created_at?: string
          duplicates_found?: number
          english_leaked?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          queries_executed?: number
          questions_accepted?: number
          questions_extracted?: number
          questions_rejected?: number
          rejection_reasons?: Json
          sources_used?: Json
          specialty: string
          started_at?: string
          status?: string
          urls_tested?: number
        }
        Update: {
          banca?: string | null
          candidate_blocks_found?: number
          created_at?: string
          duplicates_found?: number
          english_leaked?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          queries_executed?: number
          questions_accepted?: number
          questions_extracted?: number
          questions_rejected?: number
          rejection_reasons?: Json
          sources_used?: Json
          specialty?: string
          started_at?: string
          status?: string
          urls_tested?: number
        }
        Relationships: []
      }
      security_audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown
          is_anomaly: boolean | null
          resource: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          is_anomaly?: boolean | null
          resource?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          is_anomaly?: boolean | null
          resource?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      simulado_question_analytics: {
        Row: {
          bank_question_id: string | null
          changed_answer: boolean | null
          correct_answer: number
          created_at: string
          difficulty: string | null
          exam_style: string | null
          id: string
          image_question_id: string | null
          image_type: string | null
          is_correct: boolean
          mode: string
          question_id: string | null
          question_index: number
          response_time_seconds: number | null
          retried_image: boolean | null
          selected_answer: number | null
          simulado_session_id: string | null
          specialty: string | null
          subtopic: string | null
          used_zoom: boolean | null
          user_id: string
          viewed_explanation: boolean | null
        }
        Insert: {
          bank_question_id?: string | null
          changed_answer?: boolean | null
          correct_answer: number
          created_at?: string
          difficulty?: string | null
          exam_style?: string | null
          id?: string
          image_question_id?: string | null
          image_type?: string | null
          is_correct?: boolean
          mode?: string
          question_id?: string | null
          question_index: number
          response_time_seconds?: number | null
          retried_image?: boolean | null
          selected_answer?: number | null
          simulado_session_id?: string | null
          specialty?: string | null
          subtopic?: string | null
          used_zoom?: boolean | null
          user_id: string
          viewed_explanation?: boolean | null
        }
        Update: {
          bank_question_id?: string | null
          changed_answer?: boolean | null
          correct_answer?: number
          created_at?: string
          difficulty?: string | null
          exam_style?: string | null
          id?: string
          image_question_id?: string | null
          image_type?: string | null
          is_correct?: boolean
          mode?: string
          question_id?: string | null
          question_index?: number
          response_time_seconds?: number | null
          retried_image?: boolean | null
          selected_answer?: number | null
          simulado_session_id?: string | null
          specialty?: string | null
          subtopic?: string | null
          used_zoom?: boolean | null
          user_id?: string
          viewed_explanation?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "simulado_question_analytics_simulado_session_id_fkey"
            columns: ["simulado_session_id"]
            isOneToOne: false
            referencedRelation: "exam_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      simulado_selection_runs: {
        Row: {
          banca: string | null
          classification_pct_specialty: number | null
          classification_pct_subtopic: number | null
          classification_pct_topic: number | null
          created_at: string
          duration_ms: number | null
          endpoint: string
          final_count: number | null
          granular_eligible: boolean
          granular_fallback_reason: string | null
          id: string
          metadata: Json
          mode: string | null
          requested_count: number | null
          source_ai_generated: number
          source_fallback: number
          source_image_pipeline: number
          source_pool_structural: number
          source_pool_textual: number
          user_id: string | null
          user_profile: string | null
        }
        Insert: {
          banca?: string | null
          classification_pct_specialty?: number | null
          classification_pct_subtopic?: number | null
          classification_pct_topic?: number | null
          created_at?: string
          duration_ms?: number | null
          endpoint?: string
          final_count?: number | null
          granular_eligible?: boolean
          granular_fallback_reason?: string | null
          id?: string
          metadata?: Json
          mode?: string | null
          requested_count?: number | null
          source_ai_generated?: number
          source_fallback?: number
          source_image_pipeline?: number
          source_pool_structural?: number
          source_pool_textual?: number
          user_id?: string | null
          user_profile?: string | null
        }
        Update: {
          banca?: string | null
          classification_pct_specialty?: number | null
          classification_pct_subtopic?: number | null
          classification_pct_topic?: number | null
          created_at?: string
          duration_ms?: number | null
          endpoint?: string
          final_count?: number | null
          granular_eligible?: boolean
          granular_fallback_reason?: string | null
          id?: string
          metadata?: Json
          mode?: string | null
          requested_count?: number | null
          source_ai_generated?: number
          source_fallback?: number
          source_image_pipeline?: number
          source_pool_structural?: number
          source_pool_textual?: number
          user_id?: string | null
          user_profile?: string | null
        }
        Relationships: []
      }
      simulation_generation_jobs: {
        Row: {
          config: Json
          created_at: string
          error_message: string | null
          failed_questions: number
          generated_questions: number
          id: string
          results: Json
          status: Database["public"]["Enums"]["simulation_job_status"]
          total_questions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          error_message?: string | null
          failed_questions?: number
          generated_questions?: number
          id?: string
          results?: Json
          status?: Database["public"]["Enums"]["simulation_job_status"]
          total_questions: number
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          error_message?: string | null
          failed_questions?: number
          generated_questions?: number
          id?: string
          results?: Json
          status?: Database["public"]["Enums"]["simulation_job_status"]
          total_questions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      simulation_history: {
        Row: {
          audit_score: number | null
          audit_status: string | null
          correct_diagnosis: string | null
          created_at: string
          differential_diagnosis: Json | null
          difficulty: string
          evaluation: Json | null
          final_score: number
          grade: string
          id: string
          ideal_approach: string | null
          ideal_prescription: string | null
          improvements: Json | null
          specialty: string
          strengths: Json | null
          student_got_diagnosis: boolean
          time_total_minutes: number
          user_id: string
          xp_earned: number
        }
        Insert: {
          audit_score?: number | null
          audit_status?: string | null
          correct_diagnosis?: string | null
          created_at?: string
          differential_diagnosis?: Json | null
          difficulty?: string
          evaluation?: Json | null
          final_score?: number
          grade?: string
          id?: string
          ideal_approach?: string | null
          ideal_prescription?: string | null
          improvements?: Json | null
          specialty: string
          strengths?: Json | null
          student_got_diagnosis?: boolean
          time_total_minutes?: number
          user_id: string
          xp_earned?: number
        }
        Update: {
          audit_score?: number | null
          audit_status?: string | null
          correct_diagnosis?: string | null
          created_at?: string
          differential_diagnosis?: Json | null
          difficulty?: string
          evaluation?: Json | null
          final_score?: number
          grade?: string
          id?: string
          ideal_approach?: string | null
          ideal_prescription?: string | null
          improvements?: Json | null
          specialty?: string
          strengths?: Json | null
          student_got_diagnosis?: boolean
          time_total_minutes?: number
          user_id?: string
          xp_earned?: number
        }
        Relationships: []
      }
      simulation_sessions: {
        Row: {
          created_at: string
          difficulty: string
          final_score: number | null
          finished_at: string | null
          id: string
          scenario_id: string | null
          session_data: Json
          session_origin: string
          specialty: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty?: string
          final_score?: number | null
          finished_at?: string | null
          id?: string
          scenario_id?: string | null
          session_data?: Json
          session_origin?: string
          specialty: string
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty?: string
          final_score?: number | null
          finished_at?: string | null
          id?: string
          scenario_id?: string | null
          session_data?: Json
          session_origin?: string
          specialty?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_sessions_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "clinical_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      student_mastery_metrics: {
        Row: {
          clinical_score: number | null
          dependency_factor: number | null
          false_mastery_risk: number | null
          id: string
          last_updated_at: string | null
          node_id: string
          overload_risk: number | null
          retention_projection: number | null
          retention_stability: number | null
          speed_factor: number | null
          theoretical_score: number | null
          transfer_score: number | null
          user_id: string
        }
        Insert: {
          clinical_score?: number | null
          dependency_factor?: number | null
          false_mastery_risk?: number | null
          id?: string
          last_updated_at?: string | null
          node_id: string
          overload_risk?: number | null
          retention_projection?: number | null
          retention_stability?: number | null
          speed_factor?: number | null
          theoretical_score?: number | null
          transfer_score?: number | null
          user_id: string
        }
        Update: {
          clinical_score?: number | null
          dependency_factor?: number | null
          false_mastery_risk?: number | null
          id?: string
          last_updated_at?: string | null
          node_id?: string
          overload_risk?: number | null
          retention_projection?: number | null
          retention_stability?: number | null
          speed_factor?: number | null
          theoretical_score?: number | null
          transfer_score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_mastery_metrics_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      study_action_events: {
        Row: {
          affected_record_id: string | null
          affected_table: string | null
          created_at: string
          error_message: string | null
          id: string
          mission_id: string | null
          origin_module: string
          payload_json: Json | null
          source: string
          status: string
          subtopic: string | null
          task_id: string | null
          task_type: string
          topic: string | null
          user_id: string
        }
        Insert: {
          affected_record_id?: string | null
          affected_table?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          mission_id?: string | null
          origin_module: string
          payload_json?: Json | null
          source?: string
          status?: string
          subtopic?: string | null
          task_id?: string | null
          task_type: string
          topic?: string | null
          user_id: string
        }
        Update: {
          affected_record_id?: string | null
          affected_table?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          mission_id?: string | null
          origin_module?: string
          payload_json?: Json | null
          source?: string
          status?: string
          subtopic?: string | null
          task_id?: string | null
          task_type?: string
          topic?: string | null
          user_id?: string
        }
        Relationships: []
      }
      study_engine_snapshots: {
        Row: {
          approval_score: number | null
          chance_score: number | null
          content_lock: boolean | null
          created_at: string
          heavy_recovery_active: boolean | null
          heavy_recovery_phase: number | null
          id: string
          memory_pressure: number | null
          overdue_reviews: number | null
          pending_reviews: number | null
          phase: string | null
          prep_index: number | null
          recovery_mode: boolean | null
          strong_topics: Json | null
          user_id: string
          weak_topics: Json | null
        }
        Insert: {
          approval_score?: number | null
          chance_score?: number | null
          content_lock?: boolean | null
          created_at?: string
          heavy_recovery_active?: boolean | null
          heavy_recovery_phase?: number | null
          id?: string
          memory_pressure?: number | null
          overdue_reviews?: number | null
          pending_reviews?: number | null
          phase?: string | null
          prep_index?: number | null
          recovery_mode?: boolean | null
          strong_topics?: Json | null
          user_id: string
          weak_topics?: Json | null
        }
        Update: {
          approval_score?: number | null
          chance_score?: number | null
          content_lock?: boolean | null
          created_at?: string
          heavy_recovery_active?: boolean | null
          heavy_recovery_phase?: number | null
          id?: string
          memory_pressure?: number | null
          overdue_reviews?: number | null
          pending_reviews?: number | null
          phase?: string | null
          prep_index?: number | null
          recovery_mode?: boolean | null
          strong_topics?: Json | null
          user_id?: string
          weak_topics?: Json | null
        }
        Relationships: []
      }
      study_goal_monthly: {
        Row: {
          completed_questions: number
          created_at: string
          distribution_snapshot: Json | null
          id: string
          month: number
          target_questions: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          completed_questions?: number
          created_at?: string
          distribution_snapshot?: Json | null
          id?: string
          month: number
          target_questions?: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          completed_questions?: number
          created_at?: string
          distribution_snapshot?: Json | null
          id?: string
          month?: number
          target_questions?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      study_loop_events: {
        Row: {
          created_at: string
          duration_seconds: number | null
          event_type: string
          id: string
          metadata: Json | null
          recommendation_type: string | null
          session_id: string | null
          subtopic: string | null
          target_id: string | null
          theme: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          event_type: string
          id?: string
          metadata?: Json | null
          recommendation_type?: string | null
          session_id?: string | null
          subtopic?: string | null
          target_id?: string | null
          theme?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          event_type?: string
          id?: string
          metadata?: Json | null
          recommendation_type?: string | null
          session_id?: string | null
          subtopic?: string | null
          target_id?: string | null
          theme?: string | null
          user_id?: string
        }
        Relationships: []
      }
      study_materials: {
        Row: {
          ativo: boolean
          content: string
          content_version: number
          created_at: string
          difficulty_level: number | null
          generation_method: string | null
          id: string
          is_global: boolean
          material_type: string
          metadata: Json
          microtopic_id: string | null
          reviewed_by_human: boolean
          source: string | null
          specialty_id: string | null
          subtopic_id: string | null
          summary: string | null
          title: string
          topic_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          content: string
          content_version?: number
          created_at?: string
          difficulty_level?: number | null
          generation_method?: string | null
          id?: string
          is_global?: boolean
          material_type?: string
          metadata?: Json
          microtopic_id?: string | null
          reviewed_by_human?: boolean
          source?: string | null
          specialty_id?: string | null
          subtopic_id?: string | null
          summary?: string | null
          title: string
          topic_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          content?: string
          content_version?: number
          created_at?: string
          difficulty_level?: number | null
          generation_method?: string | null
          id?: string
          is_global?: boolean
          material_type?: string
          metadata?: Json
          microtopic_id?: string | null
          reviewed_by_human?: boolean
          source?: string | null
          specialty_id?: string | null
          subtopic_id?: string | null
          summary?: string | null
          title?: string
          topic_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "study_materials_microtopic_id_fkey"
            columns: ["microtopic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_microtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_materials_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "curriculum_specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_materials_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["specialty_id"]
          },
          {
            foreignKeyName: "study_materials_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_materials_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["subtopic_id"]
          },
          {
            foreignKeyName: "study_materials_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_subtopic_question_density"
            referencedColumns: ["subtopic_id"]
          },
          {
            foreignKeyName: "study_materials_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_materials_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["topic_id"]
          },
        ]
      }
      study_performance: {
        Row: {
          created_at: string
          historico_estudo: Json
          id: string
          pontuacao_discursiva: number | null
          questoes_respondidas: number
          taxa_acerto: number
          tema_atual: string | null
          temas_fracos: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          historico_estudo?: Json
          id?: string
          pontuacao_discursiva?: number | null
          questoes_respondidas?: number
          taxa_acerto?: number
          tema_atual?: string | null
          temas_fracos?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          historico_estudo?: Json
          id?: string
          pontuacao_discursiva?: number | null
          questoes_respondidas?: number
          taxa_acerto?: number
          tema_atual?: string | null
          temas_fracos?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_plans: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          plan_json: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          plan_json?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          plan_json?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      study_tasks: {
        Row: {
          completed: boolean | null
          created_at: string
          id: string
          study_plan_id: string | null
          task_json: Json | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string
          id?: string
          study_plan_id?: string | null
          task_json?: Json | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string
          id?: string
          study_plan_id?: string | null
          task_json?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_tasks_study_plan_id_fkey"
            columns: ["study_plan_id"]
            isOneToOne: false
            referencedRelation: "study_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          organization_id: string | null
          plan_id: string | null
          start_date: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          organization_id?: string | null
          plan_id?: string | null
          start_date?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          organization_id?: string | null
          plan_id?: string | null
          start_date?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      summaries: {
        Row: {
          content: string
          created_at: string
          id: string
          organization_id: string | null
          topic: string
          upload_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          organization_id?: string | null
          topic: string
          upload_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          organization_id?: string | null
          topic?: string
          upload_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "summaries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "summaries_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
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
      system_checklist_runs: {
        Row: {
          created_by: string | null
          finished_at: string | null
          id: string
          results: Json | null
          run_type: string
          started_at: string | null
          status: string
          summary: string | null
        }
        Insert: {
          created_by?: string | null
          finished_at?: string | null
          id?: string
          results?: Json | null
          run_type: string
          started_at?: string | null
          status: string
          summary?: string | null
        }
        Update: {
          created_by?: string | null
          finished_at?: string | null
          id?: string
          results?: Json | null
          run_type?: string
          started_at?: string | null
          status?: string
          summary?: string | null
        }
        Relationships: []
      }
      system_flag_audit: {
        Row: {
          changed_at: string
          changed_by: string | null
          flag_key: string
          id: string
          new_value: boolean
          previous_value: boolean | null
          reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          flag_key: string
          id?: string
          new_value: boolean
          previous_value?: boolean | null
          reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          flag_key?: string
          id?: string
          new_value?: boolean
          previous_value?: boolean | null
          reason?: string | null
        }
        Relationships: []
      }
      system_flags: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          enabled: boolean
          flag_key: string
          id: string
          rollout_mode: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          flag_key: string
          id?: string
          rollout_mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          flag_key?: string
          id?: string
          rollout_mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      system_health_logs: {
        Row: {
          active_users: number | null
          ai_ok: boolean
          avg_ai_response_ms: number | null
          checks_json: Json
          created_at: string
          critical_count: number
          id: string
          info_count: number
          metrics_json: Json
          overall_status: string
          run_date: string
          study_engine_ok: boolean
          total_checks: number | null
          warning_count: number
        }
        Insert: {
          active_users?: number | null
          ai_ok?: boolean
          avg_ai_response_ms?: number | null
          checks_json?: Json
          created_at?: string
          critical_count?: number
          id?: string
          info_count?: number
          metrics_json?: Json
          overall_status?: string
          run_date?: string
          study_engine_ok?: boolean
          total_checks?: number | null
          warning_count?: number
        }
        Update: {
          active_users?: number | null
          ai_ok?: boolean
          avg_ai_response_ms?: number | null
          checks_json?: Json
          created_at?: string
          critical_count?: number
          id?: string
          info_count?: number
          metrics_json?: Json
          overall_status?: string
          run_date?: string
          study_engine_ok?: boolean
          total_checks?: number | null
          warning_count?: number
        }
        Relationships: []
      }
      system_health_reports: {
        Row: {
          alerts: Json
          check_date: string
          created_at: string
          id: string
          total_critical: number
          total_info: number
          total_warning: number
        }
        Insert: {
          alerts?: Json
          check_date?: string
          created_at?: string
          id?: string
          total_critical?: number
          total_info?: number
          total_warning?: number
        }
        Update: {
          alerts?: Json
          check_date?: string
          created_at?: string
          id?: string
          total_critical?: number
          total_info?: number
          total_warning?: number
        }
        Relationships: []
      }
      system_metrics: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          metric_type: string
          metric_value: number
          recorded_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          metric_type: string
          metric_value?: number
          recorded_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          metric_type?: string
          metric_value?: number
          recorded_at?: string
        }
        Relationships: []
      }
      teacher_clinical_case_results: {
        Row: {
          case_id: string
          conversation_history: Json | null
          correct_diagnosis: string | null
          created_at: string
          final_evaluation: Json | null
          final_score: number | null
          finished_at: string | null
          grade: string | null
          id: string
          started_at: string | null
          status: string
          student_got_diagnosis: boolean | null
          student_id: string
          time_total_minutes: number | null
          xp_earned: number | null
        }
        Insert: {
          case_id: string
          conversation_history?: Json | null
          correct_diagnosis?: string | null
          created_at?: string
          final_evaluation?: Json | null
          final_score?: number | null
          finished_at?: string | null
          grade?: string | null
          id?: string
          started_at?: string | null
          status?: string
          student_got_diagnosis?: boolean | null
          student_id: string
          time_total_minutes?: number | null
          xp_earned?: number | null
        }
        Update: {
          case_id?: string
          conversation_history?: Json | null
          correct_diagnosis?: string | null
          created_at?: string
          final_evaluation?: Json | null
          final_score?: number | null
          finished_at?: string | null
          grade?: string | null
          id?: string
          started_at?: string | null
          status?: string
          student_got_diagnosis?: boolean | null
          student_id?: string
          time_total_minutes?: number | null
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_clinical_case_results_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "teacher_clinical_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_clinical_cases: {
        Row: {
          case_prompt: Json
          created_at: string
          difficulty: string
          faculdade_filter: string | null
          id: string
          periodo_filter: number | null
          professor_id: string
          specialty: string
          status: string
          time_limit_minutes: number
          title: string
          updated_at: string
        }
        Insert: {
          case_prompt?: Json
          created_at?: string
          difficulty?: string
          faculdade_filter?: string | null
          id?: string
          periodo_filter?: number | null
          professor_id: string
          specialty: string
          status?: string
          time_limit_minutes?: number
          title?: string
          updated_at?: string
        }
        Update: {
          case_prompt?: Json
          created_at?: string
          difficulty?: string
          faculdade_filter?: string | null
          id?: string
          periodo_filter?: number | null
          professor_id?: string
          specialty?: string
          status?: string
          time_limit_minutes?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_simulado_assignments: {
        Row: {
          assigned_at: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          simulado_id: string | null
          target_id: string | null
          target_type: string
          trace_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          simulado_id?: string | null
          target_id?: string | null
          target_type: string
          trace_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          simulado_id?: string | null
          target_id?: string | null
          target_type?: string
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_simulado_assignments_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "teacher_simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_simulado_interventions: {
        Row: {
          content: Json | null
          created_at: string | null
          id: string
          review_id: string | null
          status: string | null
          student_id: string | null
          type: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          id?: string
          review_id?: string | null
          status?: string | null
          student_id?: string | null
          type?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          id?: string
          review_id?: string | null
          status?: string | null
          student_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_simulado_interventions_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "teacher_simulado_student_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_simulado_questions: {
        Row: {
          correct_index: number
          created_at: string
          difficulty_level: string | null
          explanation: string | null
          id: string
          options: string[]
          order_index: number | null
          simulado_id: string
          statement: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          correct_index: number
          created_at?: string
          difficulty_level?: string | null
          explanation?: string | null
          id?: string
          options: string[]
          order_index?: number | null
          simulado_id: string
          statement: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          correct_index?: number
          created_at?: string
          difficulty_level?: string | null
          explanation?: string | null
          id?: string
          options?: string[]
          order_index?: number | null
          simulado_id?: string
          statement?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_simulado_questions_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "teacher_simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_simulado_results: {
        Row: {
          answers_json: Json | null
          created_at: string
          finished_at: string | null
          id: string
          score: number | null
          simulado_id: string
          started_at: string | null
          status: string
          student_id: string
          total_questions: number
        }
        Insert: {
          answers_json?: Json | null
          created_at?: string
          finished_at?: string | null
          id?: string
          score?: number | null
          simulado_id: string
          started_at?: string | null
          status?: string
          student_id: string
          total_questions?: number
        }
        Update: {
          answers_json?: Json | null
          created_at?: string
          finished_at?: string | null
          id?: string
          score?: number | null
          simulado_id?: string
          started_at?: string | null
          status?: string
          student_id?: string
          total_questions?: number
        }
        Relationships: [
          {
            foreignKeyName: "teacher_simulado_results_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "teacher_simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_simulado_status_history: {
        Row: {
          changed_by: string | null
          created_at: string | null
          id: string
          new_status: string | null
          old_status: string | null
          reason: string | null
          simulado_id: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          reason?: string | null
          simulado_id?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          reason?: string | null
          simulado_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_simulado_status_history_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "teacher_simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_simulado_student_reviews: {
        Row: {
          accuracy: number | null
          created_at: string | null
          id: string
          intervention_status: string | null
          professor_comment: string | null
          professor_id: string | null
          score: number | null
          simulado_id: string | null
          student_id: string | null
          time_spent_seconds: number | null
          tutor_recommendation: string | null
          updated_at: string | null
          weak_topics: Json | null
          wrong_questions: Json | null
        }
        Insert: {
          accuracy?: number | null
          created_at?: string | null
          id?: string
          intervention_status?: string | null
          professor_comment?: string | null
          professor_id?: string | null
          score?: number | null
          simulado_id?: string | null
          student_id?: string | null
          time_spent_seconds?: number | null
          tutor_recommendation?: string | null
          updated_at?: string | null
          weak_topics?: Json | null
          wrong_questions?: Json | null
        }
        Update: {
          accuracy?: number | null
          created_at?: string | null
          id?: string
          intervention_status?: string | null
          professor_comment?: string | null
          professor_id?: string | null
          score?: number | null
          simulado_id?: string | null
          student_id?: string | null
          time_spent_seconds?: number | null
          tutor_recommendation?: string | null
          updated_at?: string | null
          weak_topics?: Json | null
          wrong_questions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_simulado_student_reviews_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "teacher_simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_simulado_submissions: {
        Row: {
          ai_recommendations: Json | null
          answers: Json
          correct_count: number | null
          created_at: string | null
          id: string
          professor_comment: string | null
          score: number | null
          simulado_id: string | null
          status: string | null
          student_id: string | null
          time_spent_seconds: number | null
          updated_at: string | null
          wrong_count: number | null
        }
        Insert: {
          ai_recommendations?: Json | null
          answers?: Json
          correct_count?: number | null
          created_at?: string | null
          id?: string
          professor_comment?: string | null
          score?: number | null
          simulado_id?: string | null
          status?: string | null
          student_id?: string | null
          time_spent_seconds?: number | null
          updated_at?: string | null
          wrong_count?: number | null
        }
        Update: {
          ai_recommendations?: Json | null
          answers?: Json
          correct_count?: number | null
          created_at?: string | null
          id?: string
          professor_comment?: string | null
          score?: number | null
          simulado_id?: string | null
          status?: string | null
          student_id?: string | null
          time_spent_seconds?: number | null
          updated_at?: string | null
          wrong_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_simulado_submissions_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "teacher_simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_simulado_trace_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          execution_time_ms: number | null
          id: string
          payload: Json | null
          status: string
          step_name: string
          teacher_id: string
          trace_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          payload?: Json | null
          status: string
          step_name: string
          teacher_id: string
          trace_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          payload?: Json | null
          status?: string
          step_name?: string
          teacher_id?: string
          trace_id?: string
        }
        Relationships: []
      }
      teacher_simulados: {
        Row: {
          allow_retake: boolean | null
          answer_key_policy: string | null
          archived_at: string | null
          auto_assign: boolean | null
          client_request_id: string | null
          created_at: string
          description: string | null
          end_at: string | null
          exam_board: string | null
          faculdade_filter: string | null
          faculdade_filters: string[] | null
          feedback_policy: string | null
          feedback_released: boolean | null
          id: string
          max_attempts: number | null
          periodo_filter: number | null
          periodo_filters: number[] | null
          professor_id: string
          published_at: string | null
          questions_json: Json
          scheduled_at: string | null
          start_at: string | null
          status: string
          time_limit_minutes: number
          title: string
          topics: string[]
          total_questions: number
          trace_id: string | null
          updated_at: string
        }
        Insert: {
          allow_retake?: boolean | null
          answer_key_policy?: string | null
          archived_at?: string | null
          auto_assign?: boolean | null
          client_request_id?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          exam_board?: string | null
          faculdade_filter?: string | null
          faculdade_filters?: string[] | null
          feedback_policy?: string | null
          feedback_released?: boolean | null
          id?: string
          max_attempts?: number | null
          periodo_filter?: number | null
          periodo_filters?: number[] | null
          professor_id: string
          published_at?: string | null
          questions_json?: Json
          scheduled_at?: string | null
          start_at?: string | null
          status?: string
          time_limit_minutes?: number
          title?: string
          topics?: string[]
          total_questions?: number
          trace_id?: string | null
          updated_at?: string
        }
        Update: {
          allow_retake?: boolean | null
          answer_key_policy?: string | null
          archived_at?: string | null
          auto_assign?: boolean | null
          client_request_id?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          exam_board?: string | null
          faculdade_filter?: string | null
          faculdade_filters?: string[] | null
          feedback_policy?: string | null
          feedback_released?: boolean | null
          id?: string
          max_attempts?: number | null
          periodo_filter?: number | null
          periodo_filters?: number[] | null
          professor_id?: string
          published_at?: string | null
          questions_json?: Json
          scheduled_at?: string | null
          start_at?: string | null
          status?: string
          time_limit_minutes?: number
          title?: string
          topics?: string[]
          total_questions?: number
          trace_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      teacher_study_assignment_results: {
        Row: {
          assignment_id: string
          completed_at: string | null
          created_at: string
          id: string
          questions_generated: boolean | null
          started_at: string | null
          status: string
          student_id: string
        }
        Insert: {
          assignment_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          questions_generated?: boolean | null
          started_at?: string | null
          status?: string
          student_id: string
        }
        Update: {
          assignment_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          questions_generated?: boolean | null
          started_at?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_study_assignment_results_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "teacher_study_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_study_assignments: {
        Row: {
          created_at: string
          faculdade_filter: string | null
          id: string
          material_filename: string | null
          material_url: string | null
          periodo_filter: number | null
          professor_id: string
          specialty: string
          status: string
          title: string
          topics_to_cover: string
        }
        Insert: {
          created_at?: string
          faculdade_filter?: string | null
          id?: string
          material_filename?: string | null
          material_url?: string | null
          periodo_filter?: number | null
          professor_id: string
          specialty: string
          status?: string
          title: string
          topics_to_cover: string
        }
        Update: {
          created_at?: string
          faculdade_filter?: string | null
          id?: string
          material_filename?: string | null
          material_url?: string | null
          periodo_filter?: number | null
          professor_id?: string
          specialty?: string
          status?: string
          title?: string
          topics_to_cover?: string
        }
        Relationships: []
      }
      telemetry_events: {
        Row: {
          device_type: string | null
          event_name: string
          id: string
          properties: Json | null
          route: string | null
          screen_size: string | null
          scroll_depth: number | null
          session_id: string
          time_to_first_block: number | null
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          device_type?: string | null
          event_name: string
          id?: string
          properties?: Json | null
          route?: string | null
          screen_size?: string | null
          scroll_depth?: number | null
          session_id: string
          time_to_first_block?: number | null
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          device_type?: string | null
          event_name?: string
          id?: string
          properties?: Json | null
          route?: string | null
          screen_size?: string | null
          scroll_depth?: number | null
          session_id?: string
          time_to_first_block?: number | null
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      temas_estudados: {
        Row: {
          anexos: Json | null
          created_at: string
          data_estudo: string
          dificuldade: string | null
          especialidade: string
          fonte: string | null
          id: string
          observacoes: string | null
          specialty_id: string | null
          status: string | null
          subtopic_id: string | null
          subtopic_match_method: string | null
          subtopico: string | null
          tema: string
          topic_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          anexos?: Json | null
          created_at?: string
          data_estudo?: string
          dificuldade?: string | null
          especialidade: string
          fonte?: string | null
          id?: string
          observacoes?: string | null
          specialty_id?: string | null
          status?: string | null
          subtopic_id?: string | null
          subtopic_match_method?: string | null
          subtopico?: string | null
          tema: string
          topic_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          anexos?: Json | null
          created_at?: string
          data_estudo?: string
          dificuldade?: string | null
          especialidade?: string
          fonte?: string | null
          id?: string
          observacoes?: string | null
          specialty_id?: string | null
          status?: string | null
          subtopic_id?: string | null
          subtopic_match_method?: string | null
          subtopico?: string | null
          tema?: string
          topic_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "temas_estudados_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "curriculum_specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temas_estudados_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["specialty_id"]
          },
          {
            foreignKeyName: "temas_estudados_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temas_estudados_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["subtopic_id"]
          },
          {
            foreignKeyName: "temas_estudados_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "v_subtopic_question_density"
            referencedColumns: ["subtopic_id"]
          },
          {
            foreignKeyName: "temas_estudados_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temas_estudados_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "v_curriculum_coverage_by_banca"
            referencedColumns: ["topic_id"]
          },
        ]
      }
      trajectory_applied_actions: {
        Row: {
          applied_at: string
          completed_at: string | null
          created_at: string
          decision_id: string | null
          id: string
          orchestrator_action: string | null
          outcome: Json | null
          payload: Json
          recommendation_id: string | null
          snapshot_id: string | null
          status: string
          target_module: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_at?: string
          completed_at?: string | null
          created_at?: string
          decision_id?: string | null
          id?: string
          orchestrator_action?: string | null
          outcome?: Json | null
          payload?: Json
          recommendation_id?: string | null
          snapshot_id?: string | null
          status?: string
          target_module?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_at?: string
          completed_at?: string | null
          created_at?: string
          decision_id?: string | null
          id?: string
          orchestrator_action?: string | null
          outcome?: Json | null
          payload?: Json
          recommendation_id?: string | null
          snapshot_id?: string | null
          status?: string
          target_module?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trajectory_applied_actions_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "trajectory_recommendations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trajectory_applied_actions_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "trajectory_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      trajectory_opportunities: {
        Row: {
          created_at: string
          description: string | null
          effort_level: string
          evidence: Json
          id: string
          opportunity_key: string
          potential_gain: number
          snapshot_id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          effort_level?: string
          evidence?: Json
          id?: string
          opportunity_key: string
          potential_gain?: number
          snapshot_id: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          effort_level?: string
          evidence?: Json
          id?: string
          opportunity_key?: string
          potential_gain?: number
          snapshot_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trajectory_opportunities_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "trajectory_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      trajectory_recommendations: {
        Row: {
          badges: string[]
          created_at: string
          description: string | null
          effort_level: string
          expected_impact: number
          id: string
          orchestrator_action: string
          payload: Json
          priority: number
          rationale: string | null
          recommendation_key: string
          snapshot_id: string
          target_module: string
          title: string
          user_id: string
        }
        Insert: {
          badges?: string[]
          created_at?: string
          description?: string | null
          effort_level?: string
          expected_impact?: number
          id?: string
          orchestrator_action: string
          payload?: Json
          priority?: number
          rationale?: string | null
          recommendation_key: string
          snapshot_id: string
          target_module: string
          title: string
          user_id: string
        }
        Update: {
          badges?: string[]
          created_at?: string
          description?: string | null
          effort_level?: string
          expected_impact?: number
          id?: string
          orchestrator_action?: string
          payload?: Json
          priority?: number
          rationale?: string | null
          recommendation_key?: string
          snapshot_id?: string
          target_module?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trajectory_recommendations_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "trajectory_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      trajectory_risk_factors: {
        Row: {
          created_at: string
          description: string | null
          evidence: Json
          id: string
          impact_score: number
          risk_key: string
          severity: string
          snapshot_id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          evidence?: Json
          id?: string
          impact_score?: number
          risk_key: string
          severity?: string
          snapshot_id: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          evidence?: Json
          id?: string
          impact_score?: number
          risk_key?: string
          severity?: string
          snapshot_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trajectory_risk_factors_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "trajectory_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      trajectory_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          engine_version: string
          error_message: string | null
          id: string
          snapshot_id: string | null
          status: string
          trigger_source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          engine_version?: string
          error_message?: string | null
          id?: string
          snapshot_id?: string | null
          status?: string
          trigger_source?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          engine_version?: string
          error_message?: string | null
          id?: string
          snapshot_id?: string | null
          status?: string
          trigger_source?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_trajectory_runs_snapshot"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "trajectory_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      trajectory_scenarios: {
        Row: {
          assumptions: Json
          confidence_score: number
          cost_intensity: number
          created_at: string
          delta_overall: number
          horizon_days: number
          id: string
          projected_backlog: number
          projected_consistency: number
          projected_execution: number
          projected_overall: number
          projected_retention: number
          rationale: string | null
          retention_risk: number
          scenario_type: string
          snapshot_id: string
          user_id: string
        }
        Insert: {
          assumptions?: Json
          confidence_score?: number
          cost_intensity?: number
          created_at?: string
          delta_overall?: number
          horizon_days: number
          id?: string
          projected_backlog?: number
          projected_consistency?: number
          projected_execution?: number
          projected_overall?: number
          projected_retention?: number
          rationale?: string | null
          retention_risk?: number
          scenario_type: string
          snapshot_id: string
          user_id: string
        }
        Update: {
          assumptions?: Json
          confidence_score?: number
          cost_intensity?: number
          created_at?: string
          delta_overall?: number
          horizon_days?: number
          id?: string
          projected_backlog?: number
          projected_consistency?: number
          projected_execution?: number
          projected_overall?: number
          projected_retention?: number
          rationale?: string | null
          retention_risk?: number
          scenario_type?: string
          snapshot_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trajectory_scenarios_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "trajectory_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      trajectory_snapshots: {
        Row: {
          accuracy_last_28d: number | null
          active_days_last_14d: number
          backlog_score: number
          confidence_score: number
          consistency_score: number
          created_at: string
          data_completeness: string
          error_bank_open_count: number
          exam_proximity_days: number | null
          execution_score: number
          fsrs_due_count: number
          fsrs_overdue_count: number
          id: string
          overall_score: number
          questions_last_28d: number
          questions_last_7d: number
          raw_signals: Json
          retention_proxy: number | null
          retention_score: number
          run_id: string | null
          simulado_count_last_28d: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy_last_28d?: number | null
          active_days_last_14d?: number
          backlog_score?: number
          confidence_score?: number
          consistency_score?: number
          created_at?: string
          data_completeness?: string
          error_bank_open_count?: number
          exam_proximity_days?: number | null
          execution_score?: number
          fsrs_due_count?: number
          fsrs_overdue_count?: number
          id?: string
          overall_score?: number
          questions_last_28d?: number
          questions_last_7d?: number
          raw_signals?: Json
          retention_proxy?: number | null
          retention_score?: number
          run_id?: string | null
          simulado_count_last_28d?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy_last_28d?: number | null
          active_days_last_14d?: number
          backlog_score?: number
          confidence_score?: number
          consistency_score?: number
          created_at?: string
          data_completeness?: string
          error_bank_open_count?: number
          exam_proximity_days?: number | null
          execution_score?: number
          fsrs_due_count?: number
          fsrs_overdue_count?: number
          id?: string
          overall_score?: number
          questions_last_28d?: number
          questions_last_7d?: number
          raw_signals?: Json
          retention_proxy?: number | null
          retention_score?: number
          run_id?: string | null
          simulado_count_last_28d?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trajectory_snapshots_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "trajectory_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_context_snapshots: {
        Row: {
          accuracy: number | null
          context_json: Json | null
          created_at: string
          current_goal: string | null
          exam_focus: string | null
          id: string
          main_error: string | null
          mission_id: string | null
          pending_reviews: number | null
          phase: string | null
          tutor_session_id: string | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          context_json?: Json | null
          created_at?: string
          current_goal?: string | null
          exam_focus?: string | null
          id?: string
          main_error?: string | null
          mission_id?: string | null
          pending_reviews?: number | null
          phase?: string | null
          tutor_session_id?: string | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          context_json?: Json | null
          created_at?: string
          current_goal?: string | null
          exam_focus?: string | null
          id?: string
          main_error?: string | null
          mission_id?: string | null
          pending_reviews?: number | null
          phase?: string | null
          tutor_session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_context_snapshots_tutor_session_id_fkey"
            columns: ["tutor_session_id"]
            isOneToOne: false
            referencedRelation: "tutor_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_events: {
        Row: {
          block_type: string | null
          conversation_id: string | null
          created_at: string
          event_type: string
          id: string
          outcome: string | null
          payload: Json
          related_message_id: string | null
          subtopic: string | null
          topic: string | null
          user_id: string
        }
        Insert: {
          block_type?: string | null
          conversation_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          outcome?: string | null
          payload?: Json
          related_message_id?: string | null
          subtopic?: string | null
          topic?: string | null
          user_id: string
        }
        Update: {
          block_type?: string | null
          conversation_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          outcome?: string | null
          payload?: Json
          related_message_id?: string | null
          subtopic?: string | null
          topic?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tutor_ia_telemetry: {
        Row: {
          confidence: number | null
          created_at: string | null
          duration_ms: number | null
          event_type: string
          fallback_used: boolean | null
          id: string
          lesson_id: string | null
          metadata: Json | null
          model_used: string | null
          parse_strategy: string | null
          session_id: string
          topic: string | null
          user_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          duration_ms?: number | null
          event_type: string
          fallback_used?: boolean | null
          id?: string
          lesson_id?: string | null
          metadata?: Json | null
          model_used?: string | null
          parse_strategy?: string | null
          session_id: string
          topic?: string | null
          user_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          duration_ms?: number | null
          event_type?: string
          fallback_used?: boolean | null
          id?: string
          lesson_id?: string | null
          metadata?: Json | null
          model_used?: string | null
          parse_strategy?: string | null
          session_id?: string
          topic?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      tutor_knowledge_memory: {
        Row: {
          answer_summary: string | null
          block_types: string[] | null
          blocks: Json
          created_at: string
          difficulty_level: string | null
          embedding: string | null
          embedding_model: string | null
          embedding_status: string
          embedding_updated_at: string | null
          id: string
          intent: string | null
          last_used_at: string | null
          model_used: string | null
          quality_score: number
          question_normalized: string
          question_original: string
          reuse_count: number
          scope: string
          source: string
          specialty: string | null
          subtopic: string | null
          symptom_keywords: string[] | null
          topic: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          answer_summary?: string | null
          block_types?: string[] | null
          blocks?: Json
          created_at?: string
          difficulty_level?: string | null
          embedding?: string | null
          embedding_model?: string | null
          embedding_status?: string
          embedding_updated_at?: string | null
          id?: string
          intent?: string | null
          last_used_at?: string | null
          model_used?: string | null
          quality_score?: number
          question_normalized: string
          question_original: string
          reuse_count?: number
          scope?: string
          source?: string
          specialty?: string | null
          subtopic?: string | null
          symptom_keywords?: string[] | null
          topic?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          answer_summary?: string | null
          block_types?: string[] | null
          blocks?: Json
          created_at?: string
          difficulty_level?: string | null
          embedding?: string | null
          embedding_model?: string | null
          embedding_status?: string
          embedding_updated_at?: string | null
          id?: string
          intent?: string | null
          last_used_at?: string | null
          model_used?: string | null
          quality_score?: number
          question_normalized?: string
          question_original?: string
          reuse_count?: number
          scope?: string
          source?: string
          specialty?: string | null
          subtopic?: string | null
          symptom_keywords?: string[] | null
          topic?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tutor_lesson_events: {
        Row: {
          actor_id: string | null
          created_at: string | null
          event_type: string
          id: string
          lesson_id: string | null
          metadata: Json | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          lesson_id?: string | null
          metadata?: Json | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          lesson_id?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "tutor_lesson_events_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "tutor_lesson_memory"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_lesson_memory: {
        Row: {
          admin_review_required: boolean | null
          ai_generation_context: Json | null
          cinematic_prompt: Json | null
          created_at: string | null
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          duration: number | null
          estimated_duration_minutes: number | null
          gemini_export: string | null
          generated_from_real_usage: boolean | null
          generation_reason: string | null
          google_vids_export: string | null
          hard_deleted: boolean | null
          hidden_from_student: boolean | null
          id: string
          is_favorite: boolean | null
          is_recommended: boolean | null
          last_structuring_at: string | null
          last_structuring_error: string | null
          metadata: Json | null
          notebooklm_export: string | null
          pedagogical_interest_score: number | null
          pedagogical_quality_score: number | null
          priority: string | null
          production_pipeline_status: string | null
          published_at: string | null
          quality_checklist: Json
          related_error_bank_count: number | null
          related_fsrs_reviews: number | null
          related_questions_count: number | null
          source_session_id: string | null
          status: string
          structured_content: Json | null
          structuring_attempts: number
          study_sessions_count: number | null
          subject: string | null
          subtitle: string | null
          subtopic: string | null
          summary: string | null
          teacher_id: string | null
          thumbnail_url: string | null
          title: string
          topic: string | null
          topic_normalized: string | null
          tutor_messages_count: number | null
          updated_at: string | null
          user_id: string
          user_learning_pattern: Json | null
          video_url: string | null
        }
        Insert: {
          admin_review_required?: boolean | null
          ai_generation_context?: Json | null
          cinematic_prompt?: Json | null
          created_at?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          duration?: number | null
          estimated_duration_minutes?: number | null
          gemini_export?: string | null
          generated_from_real_usage?: boolean | null
          generation_reason?: string | null
          google_vids_export?: string | null
          hard_deleted?: boolean | null
          hidden_from_student?: boolean | null
          id?: string
          is_favorite?: boolean | null
          is_recommended?: boolean | null
          last_structuring_at?: string | null
          last_structuring_error?: string | null
          metadata?: Json | null
          notebooklm_export?: string | null
          pedagogical_interest_score?: number | null
          pedagogical_quality_score?: number | null
          priority?: string | null
          production_pipeline_status?: string | null
          published_at?: string | null
          quality_checklist?: Json
          related_error_bank_count?: number | null
          related_fsrs_reviews?: number | null
          related_questions_count?: number | null
          source_session_id?: string | null
          status?: string
          structured_content?: Json | null
          structuring_attempts?: number
          study_sessions_count?: number | null
          subject?: string | null
          subtitle?: string | null
          subtopic?: string | null
          summary?: string | null
          teacher_id?: string | null
          thumbnail_url?: string | null
          title: string
          topic?: string | null
          topic_normalized?: string | null
          tutor_messages_count?: number | null
          updated_at?: string | null
          user_id: string
          user_learning_pattern?: Json | null
          video_url?: string | null
        }
        Update: {
          admin_review_required?: boolean | null
          ai_generation_context?: Json | null
          cinematic_prompt?: Json | null
          created_at?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          duration?: number | null
          estimated_duration_minutes?: number | null
          gemini_export?: string | null
          generated_from_real_usage?: boolean | null
          generation_reason?: string | null
          google_vids_export?: string | null
          hard_deleted?: boolean | null
          hidden_from_student?: boolean | null
          id?: string
          is_favorite?: boolean | null
          is_recommended?: boolean | null
          last_structuring_at?: string | null
          last_structuring_error?: string | null
          metadata?: Json | null
          notebooklm_export?: string | null
          pedagogical_interest_score?: number | null
          pedagogical_quality_score?: number | null
          priority?: string | null
          production_pipeline_status?: string | null
          published_at?: string | null
          quality_checklist?: Json
          related_error_bank_count?: number | null
          related_fsrs_reviews?: number | null
          related_questions_count?: number | null
          source_session_id?: string | null
          status?: string
          structured_content?: Json | null
          structuring_attempts?: number
          study_sessions_count?: number | null
          subject?: string | null
          subtitle?: string | null
          subtopic?: string | null
          summary?: string | null
          teacher_id?: string | null
          thumbnail_url?: string | null
          title?: string
          topic?: string | null
          topic_normalized?: string | null
          tutor_messages_count?: number | null
          updated_at?: string | null
          user_id?: string
          user_learning_pattern?: Json | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutor_lesson_memory_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "tutor_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_lesson_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          id: string
          last_position: number | null
          lesson_id: string | null
          progress_percent: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          last_position?: number | null
          lesson_id?: string | null
          progress_percent?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          last_position?: number | null
          lesson_id?: string | null
          progress_percent?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "tutor_lesson_memory"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_lessons: {
        Row: {
          cme_pipeline_id: string | null
          cme_status: string | null
          content: Json
          conversation_id: string | null
          created_at: string | null
          error_message: string | null
          generation_status: Database["public"]["Enums"]["lesson_generation_status"]
          id: string
          lesson_type: Database["public"]["Enums"]["lesson_type_enum"]
          session_id: string | null
          source_message_count: number
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cme_pipeline_id?: string | null
          cme_status?: string | null
          content: Json
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          generation_status?: Database["public"]["Enums"]["lesson_generation_status"]
          id?: string
          lesson_type?: Database["public"]["Enums"]["lesson_type_enum"]
          session_id?: string | null
          source_message_count?: number
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cme_pipeline_id?: string | null
          cme_status?: string | null
          content?: Json
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          generation_status?: Database["public"]["Enums"]["lesson_generation_status"]
          id?: string
          lesson_type?: Database["public"]["Enums"]["lesson_type_enum"]
          session_id?: string | null
          source_message_count?: number
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tutor_memory_search_logs: {
        Row: {
          abbreviation_overlap_count: number | null
          created_at: string
          created_new_memory: boolean | null
          duration_ms: number | null
          fallback_tier: string | null
          hybrid_score: number | null
          id: string
          matched_memory_id: string | null
          query: string
          query_normalized: string | null
          reused: boolean | null
          semantic_score: number | null
          symptom_overlap_count: number | null
          threshold_used: number | null
          topic_overlap: boolean | null
          user_id: string | null
        }
        Insert: {
          abbreviation_overlap_count?: number | null
          created_at?: string
          created_new_memory?: boolean | null
          duration_ms?: number | null
          fallback_tier?: string | null
          hybrid_score?: number | null
          id?: string
          matched_memory_id?: string | null
          query: string
          query_normalized?: string | null
          reused?: boolean | null
          semantic_score?: number | null
          symptom_overlap_count?: number | null
          threshold_used?: number | null
          topic_overlap?: boolean | null
          user_id?: string | null
        }
        Update: {
          abbreviation_overlap_count?: number | null
          created_at?: string
          created_new_memory?: boolean | null
          duration_ms?: number | null
          fallback_tier?: string | null
          hybrid_score?: number | null
          id?: string
          matched_memory_id?: string | null
          query?: string
          query_normalized?: string | null
          reused?: boolean | null
          semantic_score?: number | null
          symptom_overlap_count?: number | null
          threshold_used?: number | null
          topic_overlap?: boolean | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutor_memory_search_logs_matched_memory_id_fkey"
            columns: ["matched_memory_id"]
            isOneToOne: false
            referencedRelation: "tutor_knowledge_memory"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          input_context_json: Json | null
          metadata: Json | null
          model_used: string | null
          role: string
          tokens_used: number | null
          tutor_session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          input_context_json?: Json | null
          metadata?: Json | null
          model_used?: string | null
          role?: string
          tokens_used?: number | null
          tutor_session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          input_context_json?: Json | null
          metadata?: Json | null
          model_used?: string | null
          role?: string
          tokens_used?: number | null
          tutor_session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_messages_tutor_session_id_fkey"
            columns: ["tutor_session_id"]
            isOneToOne: false
            referencedRelation: "tutor_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_recommendation_cache: {
        Row: {
          confidence: number | null
          created_at: string | null
          expires_at: string
          id: string
          lesson_data: Json | null
          lesson_id: string | null
          normalized_topic: string
          session_id: string
          user_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          expires_at?: string
          id?: string
          lesson_data?: Json | null
          lesson_id?: string | null
          normalized_topic: string
          session_id: string
          user_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          expires_at?: string
          id?: string
          lesson_data?: Json | null
          lesson_id?: string | null
          normalized_topic?: string
          session_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tutor_sessions: {
        Row: {
          conversation_id: string | null
          created_at: string
          current_phase: string | null
          id: string
          mission_id: string | null
          mode: string
          source_context: string | null
          specialty: string | null
          status: string | null
          subtopic: string | null
          topic: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          current_phase?: string | null
          id?: string
          mission_id?: string | null
          mode?: string
          source_context?: string | null
          specialty?: string | null
          status?: string | null
          subtopic?: string | null
          topic?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          current_phase?: string | null
          id?: string
          mission_id?: string | null
          mode?: string
          source_context?: string | null
          specialty?: string | null
          status?: string | null
          subtopic?: string | null
          topic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_study_tracking: {
        Row: {
          created_at: string | null
          flashcards_generated: number | null
          fsrs_reviews: number | null
          id: string
          interaction_count: number | null
          interest_score: number | null
          last_interaction_at: string | null
          questions_answered: number | null
          related_errors: number | null
          subject: string | null
          subtopic: string | null
          topic: string
          total_study_time: number | null
          tutor_session_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          flashcards_generated?: number | null
          fsrs_reviews?: number | null
          id?: string
          interaction_count?: number | null
          interest_score?: number | null
          last_interaction_at?: string | null
          questions_answered?: number | null
          related_errors?: number | null
          subject?: string | null
          subtopic?: string | null
          topic: string
          total_study_time?: number | null
          tutor_session_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          flashcards_generated?: number | null
          fsrs_reviews?: number | null
          id?: string
          interaction_count?: number | null
          interest_score?: number | null
          last_interaction_at?: string | null
          questions_answered?: number | null
          related_errors?: number | null
          subject?: string | null
          subtopic?: string | null
          topic?: string
          total_study_time?: number | null
          tutor_session_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tutor_v2_audits: {
        Row: {
          blocks_found: string[] | null
          blocks_missing: string[] | null
          cognitive_load: number | null
          created_at: string | null
          detected_gaps: string[] | null
          error_signals: Json | null
          feynman_score: number | null
          hallucination_warning: boolean | null
          id: string
          latency_ms: number | null
          medical_safety_score: number | null
          message_id: string | null
          model_used: string | null
          pedagogical_score: number | null
          phase_0_context: Json | null
          planner_signals: Json | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          blocks_found?: string[] | null
          blocks_missing?: string[] | null
          cognitive_load?: number | null
          created_at?: string | null
          detected_gaps?: string[] | null
          error_signals?: Json | null
          feynman_score?: number | null
          hallucination_warning?: boolean | null
          id?: string
          latency_ms?: number | null
          medical_safety_score?: number | null
          message_id?: string | null
          model_used?: string | null
          pedagogical_score?: number | null
          phase_0_context?: Json | null
          planner_signals?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          blocks_found?: string[] | null
          blocks_missing?: string[] | null
          cognitive_load?: number | null
          created_at?: string | null
          detected_gaps?: string[] | null
          error_signals?: Json | null
          feynman_score?: number | null
          hallucination_warning?: boolean | null
          id?: string
          latency_ms?: number | null
          medical_safety_score?: number | null
          message_id?: string | null
          model_used?: string | null
          pedagogical_score?: number | null
          phase_0_context?: Json | null
          planner_signals?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutor_v2_audits_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "tutor_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_v2_audits_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tutor_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_v2_events: {
        Row: {
          cost: number | null
          created_at: string
          error_code: string | null
          event_type: string
          id: string
          latency_ms: number | null
          metadata: Json | null
          model: string | null
          provider: string | null
          session_id: string | null
          success: boolean | null
          tokens: number | null
          user_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          error_code?: string | null
          event_type: string
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          model?: string | null
          provider?: string | null
          session_id?: string | null
          success?: boolean | null
          tokens?: number | null
          user_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          error_code?: string | null
          event_type?: string
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          model?: string | null
          provider?: string | null
          session_id?: string | null
          success?: boolean | null
          tokens?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_v2_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tutor_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_video_recommendation_telemetry: {
        Row: {
          confidence: number | null
          created_at: string | null
          event_type: string
          id: string
          lesson_id: string | null
          metadata: Json | null
          reason: string | null
          session_id: string | null
          source_table: string | null
          topic: string
          user_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          event_type: string
          id?: string
          lesson_id?: string | null
          metadata?: Json | null
          reason?: string | null
          session_id?: string | null
          source_table?: string | null
          topic: string
          user_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          event_type?: string
          id?: string
          lesson_id?: string | null
          metadata?: Json | null
          reason?: string | null
          session_id?: string | null
          source_table?: string | null
          topic?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutor_video_recommendation_telemetry_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "tutor_lesson_memory"
            referencedColumns: ["id"]
          },
        ]
      }
      uploads: {
        Row: {
          category: string | null
          created_at: string
          extracted_json: Json | null
          extracted_text: string | null
          file_type: string | null
          filename: string
          id: string
          is_active: boolean | null
          is_global: boolean
          is_published: boolean | null
          organization_id: string | null
          status: string | null
          storage_path: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          extracted_json?: Json | null
          extracted_text?: string | null
          file_type?: string | null
          filename: string
          id?: string
          is_active?: boolean | null
          is_global?: boolean
          is_published?: boolean | null
          organization_id?: string | null
          status?: string | null
          storage_path?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          extracted_json?: Json | null
          extracted_text?: string | null
          file_type?: string | null
          filename?: string
          id?: string
          is_active?: boolean | null
          is_global?: boolean
          is_published?: boolean | null
          organization_id?: string | null
          status?: string | null
          storage_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_key: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_key: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_key?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_activity_log: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_engagement_daily: {
        Row: {
          elegant_exits: number | null
          errors_encountered: number | null
          id: string
          loops_abandoned: number | null
          loops_completed: number | null
          loops_started: number | null
          metric_date: string
          questions_answered: number | null
          questions_correct: number | null
          quick_actions_used: number | null
          reinforcements_triggered: number | null
          sessions_count: number | null
          total_study_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          elegant_exits?: number | null
          errors_encountered?: number | null
          id?: string
          loops_abandoned?: number | null
          loops_completed?: number | null
          loops_started?: number | null
          metric_date?: string
          questions_answered?: number | null
          questions_correct?: number | null
          quick_actions_used?: number | null
          reinforcements_triggered?: number | null
          sessions_count?: number | null
          total_study_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          elegant_exits?: number | null
          errors_encountered?: number | null
          id?: string
          loops_abandoned?: number | null
          loops_completed?: number | null
          loops_started?: number | null
          metric_date?: string
          questions_answered?: number | null
          questions_correct?: number | null
          quick_actions_used?: number | null
          reinforcements_triggered?: number | null
          sessions_count?: number | null
          total_study_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_experiment_assignments: {
        Row: {
          assigned_at: string | null
          experiment_id: string
          id: string
          user_id: string
          variant_id: string
        }
        Insert: {
          assigned_at?: string | null
          experiment_id: string
          id?: string
          user_id: string
          variant_id: string
        }
        Update: {
          assigned_at?: string | null
          experiment_id?: string
          id?: string
          user_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_experiment_assignments_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "adaptive_experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          created_at: string
          feedback_text: string
          id: string
          ratings: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback_text: string
          id?: string
          ratings?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          feedback_text?: string
          id?: string
          ratings?: Json
          user_id?: string
        }
        Relationships: []
      }
      user_gamification: {
        Row: {
          created_at: string
          current_streak: number
          freeze_available: number
          id: string
          last_activity_date: string | null
          level: number
          longest_streak: number
          updated_at: string
          user_id: string
          weekly_reset_at: string
          weekly_xp: number
          xp: number
        }
        Insert: {
          created_at?: string
          current_streak?: number
          freeze_available?: number
          id?: string
          last_activity_date?: string | null
          level?: number
          longest_streak?: number
          updated_at?: string
          user_id: string
          weekly_reset_at?: string
          weekly_xp?: number
          xp?: number
        }
        Update: {
          created_at?: string
          current_streak?: number
          freeze_available?: number
          id?: string
          last_activity_date?: string | null
          level?: number
          longest_streak?: number
          updated_at?: string
          user_id?: string
          weekly_reset_at?: string
          weekly_xp?: number
          xp?: number
        }
        Relationships: []
      }
      user_missions: {
        Row: {
          completed_tasks: Json
          completion_sources: Json
          created_at: string
          current_index: number
          current_tasks: Json
          id: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_tasks?: Json
          completion_sources?: Json
          created_at?: string
          current_index?: number
          current_tasks?: Json
          id?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_tasks?: Json
          completion_sources?: Json
          created_at?: string
          current_index?: number
          current_tasks?: Json
          id?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_mnemonic_links: {
        Row: {
          accuracy_after: number | null
          accuracy_before: number | null
          created_at: string
          first_seen_at: string | null
          helped_after_error: boolean | null
          id: string
          improvement_delta: number | null
          last_seen_at: string | null
          mnemonic_asset_id: string
          mnemonic_not_helping: boolean
          next_review_at: string
          times_shown: number
          topic: string
          trigger_source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy_after?: number | null
          accuracy_before?: number | null
          created_at?: string
          first_seen_at?: string | null
          helped_after_error?: boolean | null
          id?: string
          improvement_delta?: number | null
          last_seen_at?: string | null
          mnemonic_asset_id: string
          mnemonic_not_helping?: boolean
          next_review_at?: string
          times_shown?: number
          topic: string
          trigger_source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy_after?: number | null
          accuracy_before?: number | null
          created_at?: string
          first_seen_at?: string | null
          helped_after_error?: boolean | null
          id?: string
          improvement_delta?: number | null
          last_seen_at?: string | null
          mnemonic_asset_id?: string
          mnemonic_not_helping?: boolean
          next_review_at?: string
          times_shown?: number
          topic?: string
          trigger_source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_mnemonic_links_mnemonic_asset_id_fkey"
            columns: ["mnemonic_asset_id"]
            isOneToOne: false
            referencedRelation: "mnemonic_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_module_access: {
        Row: {
          created_at: string
          enabled: boolean
          granted_by: string | null
          id: string
          module_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          granted_by?: string | null
          id?: string
          module_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          granted_by?: string | null
          id?: string
          module_key?: string
          user_id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          current_page: string | null
          last_seen_at: string
          user_id: string
        }
        Insert: {
          current_page?: string | null
          last_seen_at?: string
          user_id: string
        }
        Update: {
          current_page?: string | null
          last_seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_quotas: {
        Row: {
          created_at: string
          extra_questions: number
          extra_transcription_minutes: number
          id: string
          questions_limit: number
          questions_used: number
          reset_at: string
          transcription_minutes_limit: number
          transcription_minutes_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          extra_questions?: number
          extra_transcription_minutes?: number
          id?: string
          questions_limit?: number
          questions_used?: number
          reset_at?: string
          transcription_minutes_limit?: number
          transcription_minutes_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          extra_questions?: number
          extra_transcription_minutes?: number
          id?: string
          questions_limit?: number
          questions_used?: number
          reset_at?: string
          transcription_minutes_limit?: number
          transcription_minutes_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      user_settings: {
        Row: {
          audio_mode_enabled: boolean
          created_at: string
          daily_goal_minutes: number
          id: string
          notifications_enabled: boolean
          study_mode: string
          theme_preferences: Json
          tutor_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_mode_enabled?: boolean
          created_at?: string
          daily_goal_minutes?: number
          id?: string
          notifications_enabled?: boolean
          study_mode?: string
          theme_preferences?: Json
          tutor_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_mode_enabled?: boolean
          created_at?: string
          daily_goal_minutes?: number
          id?: string
          notifications_enabled?: boolean
          study_mode?: string
          theme_preferences?: Json
          tutor_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_topic_profiles: {
        Row: {
          accuracy: number
          confidence_level: string
          correct_answers: number
          created_at: string
          id: string
          last_practiced_at: string | null
          mastery_level: number
          next_review_at: string | null
          review_interval_days: number
          specialty: string
          topic: string
          total_questions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy?: number
          confidence_level?: string
          correct_answers?: number
          created_at?: string
          id?: string
          last_practiced_at?: string | null
          mastery_level?: number
          next_review_at?: string | null
          review_interval_days?: number
          specialty?: string
          topic: string
          total_questions?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy?: number
          confidence_level?: string
          correct_answers?: number
          created_at?: string
          id?: string
          last_practiced_at?: string | null
          mastery_level?: number
          next_review_at?: string | null
          review_interval_days?: number
          specialty?: string
          topic?: string
          total_questions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      video_adaptive_recommendations: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          payload: Json | null
          priority: number | null
          reason: string | null
          recommendation_type: string
          segment_id: string | null
          status: string | null
          user_id: string
          video_lesson_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          payload?: Json | null
          priority?: number | null
          reason?: string | null
          recommendation_type: string
          segment_id?: string | null
          status?: string | null
          user_id: string
          video_lesson_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          payload?: Json | null
          priority?: number | null
          reason?: string | null
          recommendation_type?: string
          segment_id?: string | null
          status?: string | null
          user_id?: string
          video_lesson_id?: string | null
        }
        Relationships: []
      }
      video_cognitive_heatmaps: {
        Row: {
          avg_retention: number | null
          friction_score: number | null
          id: string
          last_updated: string | null
          segment_id: string | null
          total_abandons: number | null
          total_replays: number | null
          total_tutor_opens: number | null
          video_lesson_id: string | null
        }
        Insert: {
          avg_retention?: number | null
          friction_score?: number | null
          id?: string
          last_updated?: string | null
          segment_id?: string | null
          total_abandons?: number | null
          total_replays?: number | null
          total_tutor_opens?: number | null
          video_lesson_id?: string | null
        }
        Update: {
          avg_retention?: number | null
          friction_score?: number | null
          id?: string
          last_updated?: string | null
          segment_id?: string | null
          total_abandons?: number | null
          total_replays?: number | null
          total_tutor_opens?: number | null
          video_lesson_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_cognitive_heatmaps_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "lesson_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_cognitive_heatmaps_video_lesson_id_fkey"
            columns: ["video_lesson_id"]
            isOneToOne: false
            referencedRelation: "ai_video_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      video_lesson_quiz_attempts: {
        Row: {
          answers: Json
          created_at: string
          id: string
          quiz_id: string
          score: number
          total_questions: number
          user_id: string
          video_lesson_id: string
        }
        Insert: {
          answers: Json
          created_at?: string
          id?: string
          quiz_id: string
          score: number
          total_questions: number
          user_id: string
          video_lesson_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          quiz_id?: string
          score?: number
          total_questions?: number
          user_id?: string
          video_lesson_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_lesson_quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "video_lesson_quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_lesson_quiz_attempts_video_lesson_id_fkey"
            columns: ["video_lesson_id"]
            isOneToOne: false
            referencedRelation: "ai_video_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      video_lesson_quizzes: {
        Row: {
          created_at: string
          id: string
          knowledge_node_id: string | null
          questions: Json
          updated_at: string
          video_lesson_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          knowledge_node_id?: string | null
          questions: Json
          updated_at?: string
          video_lesson_id: string
        }
        Update: {
          created_at?: string
          id?: string
          knowledge_node_id?: string | null
          questions?: Json
          updated_at?: string
          video_lesson_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_lesson_quizzes_knowledge_node_id_fkey"
            columns: ["knowledge_node_id"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_lesson_quizzes_video_lesson_id_fkey"
            columns: ["video_lesson_id"]
            isOneToOne: false
            referencedRelation: "ai_video_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      video_lesson_usage_logs: {
        Row: {
          action: string
          completion_rate: number | null
          created_at: string
          id: string
          user_id: string
          video_lesson_id: string
          watched_seconds: number | null
        }
        Insert: {
          action: string
          completion_rate?: number | null
          created_at?: string
          id?: string
          user_id: string
          video_lesson_id: string
          watched_seconds?: number | null
        }
        Update: {
          action?: string
          completion_rate?: number | null
          created_at?: string
          id?: string
          user_id?: string
          video_lesson_id?: string
          watched_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_lesson_usage_logs_video_lesson_id_fkey"
            columns: ["video_lesson_id"]
            isOneToOne: false
            referencedRelation: "ai_video_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      video_rooms: {
        Row: {
          created_at: string
          ended_at: string | null
          faculdade_filter: string | null
          id: string
          invited_students: Json
          meet_link: string | null
          periodo_filter: number | null
          professor_id: string
          room_code: string
          status: string
          telegram_chat_id: string | null
          telegram_group_link: string | null
          title: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          faculdade_filter?: string | null
          id?: string
          invited_students?: Json
          meet_link?: string | null
          periodo_filter?: number | null
          professor_id: string
          room_code: string
          status?: string
          telegram_chat_id?: string | null
          telegram_group_link?: string | null
          title?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          faculdade_filter?: string | null
          id?: string
          invited_students?: Json
          meet_link?: string | null
          periodo_filter?: number | null
          professor_id?: string
          room_code?: string
          status?: string
          telegram_chat_id?: string | null
          telegram_group_link?: string | null
          title?: string
        }
        Relationships: []
      }
      video_segment_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          event_type: string
          id: string
          metadata: Json | null
          segment_id: string | null
          timestamp_seconds: number | null
          user_id: string
          video_lesson_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          event_type: string
          id?: string
          metadata?: Json | null
          segment_id?: string | null
          timestamp_seconds?: number | null
          user_id: string
          video_lesson_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          event_type?: string
          id?: string
          metadata?: Json | null
          segment_id?: string | null
          timestamp_seconds?: number | null
          user_id?: string
          video_lesson_id?: string
        }
        Relationships: []
      }
      video_segment_fsrs: {
        Row: {
          created_at: string
          difficulty: number | null
          due_at: string
          id: string
          lapses: number | null
          last_review: string | null
          reps: number | null
          retrievability: number | null
          segment_id: string
          stability: number | null
          subtopic: string | null
          topic: string | null
          updated_at: string
          user_id: string
          video_lesson_id: string
        }
        Insert: {
          created_at?: string
          difficulty?: number | null
          due_at?: string
          id?: string
          lapses?: number | null
          last_review?: string | null
          reps?: number | null
          retrievability?: number | null
          segment_id: string
          stability?: number | null
          subtopic?: string | null
          topic?: string | null
          updated_at?: string
          user_id: string
          video_lesson_id: string
        }
        Update: {
          created_at?: string
          difficulty?: number | null
          due_at?: string
          id?: string
          lapses?: number | null
          last_review?: string | null
          reps?: number | null
          retrievability?: number | null
          segment_id?: string
          stability?: number | null
          subtopic?: string | null
          topic?: string | null
          updated_at?: string
          user_id?: string
          video_lesson_id?: string
        }
        Relationships: []
      }
      visual_skill_snapshots: {
        Row: {
          accuracy: number
          attempts_count: number
          avg_time_seconds: number | null
          computed_at: string
          confidence_level: string
          correct_count: number
          created_at: string
          id: string
          image_type: string
          recent_window_accuracy: number | null
          score: number
          strongest_area: string | null
          trend: string
          updated_at: string
          user_id: string
          weakest_area: string | null
        }
        Insert: {
          accuracy?: number
          attempts_count?: number
          avg_time_seconds?: number | null
          computed_at?: string
          confidence_level?: string
          correct_count?: number
          created_at?: string
          id?: string
          image_type: string
          recent_window_accuracy?: number | null
          score?: number
          strongest_area?: string | null
          trend?: string
          updated_at?: string
          user_id: string
          weakest_area?: string | null
        }
        Update: {
          accuracy?: number
          attempts_count?: number
          avg_time_seconds?: number | null
          computed_at?: string
          confidence_level?: string
          correct_count?: number
          created_at?: string
          id?: string
          image_type?: string
          recent_window_accuracy?: number | null
          score?: number
          strongest_area?: string | null
          trend?: string
          updated_at?: string
          user_id?: string
          weakest_area?: string | null
        }
        Relationships: []
      }
      weekly_snapshots: {
        Row: {
          approval_score: number | null
          carryover: Json
          completed_tasks: Json
          created_at: string
          id: string
          planned_tasks: Json
          prep_index: number | null
          summary: string | null
          user_id: string
          week_start: string
        }
        Insert: {
          approval_score?: number | null
          carryover?: Json
          completed_tasks?: Json
          created_at?: string
          id?: string
          planned_tasks?: Json
          prep_index?: number | null
          summary?: string | null
          user_id: string
          week_start: string
        }
        Update: {
          approval_score?: number | null
          carryover?: Json
          completed_tasks?: Json
          created_at?: string
          id?: string
          planned_tasks?: Json
          prep_index?: number | null
          summary?: string | null
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      whatsapp_execution_logs: {
        Row: {
          action: string
          created_at: string
          execution_id: string
          id: string
          message: string | null
          metadata_json: Json | null
          queue_item_id: string | null
          status: string
        }
        Insert: {
          action: string
          created_at?: string
          execution_id: string
          id?: string
          message?: string | null
          metadata_json?: Json | null
          queue_item_id?: string | null
          status: string
        }
        Update: {
          action?: string
          created_at?: string
          execution_id?: string
          id?: string
          message?: string | null
          metadata_json?: Json | null
          queue_item_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_execution_logs_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_send_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_execution_logs_queue_item_id_fkey"
            columns: ["queue_item_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_message_log"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_log: {
        Row: {
          admin_user_id: string
          attempts: number
          created_at: string
          delivery_status: string
          error_message: string | null
          execution_id: string | null
          execution_mode: string
          id: string
          message_text: string
          sent_at: string
          target_user_id: string
          updated_at: string
        }
        Insert: {
          admin_user_id: string
          attempts?: number
          created_at?: string
          delivery_status?: string
          error_message?: string | null
          execution_id?: string | null
          execution_mode?: string
          id?: string
          message_text: string
          sent_at?: string
          target_user_id: string
          updated_at?: string
        }
        Update: {
          admin_user_id?: string
          attempts?: number
          created_at?: string
          delivery_status?: string
          error_message?: string | null
          execution_id?: string | null
          execution_mode?: string
          id?: string
          message_text?: string
          sent_at?: string
          target_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_log_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_send_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_send_executions: {
        Row: {
          admin_user_id: string
          created_at: string
          execution_date: string
          finished_at: string | null
          id: string
          mode: string
          started_at: string | null
          status: string
          total_error: number
          total_items: number
          total_sent: number
          total_skipped: number
          updated_at: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          execution_date?: string
          finished_at?: string | null
          id?: string
          mode?: string
          started_at?: string | null
          status?: string
          total_error?: number
          total_items?: number
          total_sent?: number
          total_skipped?: number
          updated_at?: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          execution_date?: string
          finished_at?: string | null
          id?: string
          mode?: string
          started_at?: string | null
          status?: string
          total_error?: number
          total_items?: number
          total_sent?: number
          total_skipped?: number
          updated_at?: string
        }
        Relationships: []
      }
      worker_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          job_id: string | null
          metadata_json: Json | null
          status: string
          worker_name: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          job_id?: string | null
          metadata_json?: Json | null
          status?: string
          worker_name: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          job_id?: string | null
          metadata_json?: Json | null
          status?: string
          worker_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_runs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "queue_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cme_session_aggregation_summary: {
        Row: {
          aggregation_status:
            | Database["public"]["Enums"]["cme_aggregation_status"]
            | null
          blocks_count: number | null
          created_at: string | null
          id: string | null
          render_progress: number | null
          render_status: string | null
          title: string | null
        }
        Relationships: []
      }
      legacy_fsrs_bridge: {
        Row: {
          card_ref_id: string | null
          card_type: string | null
          due: string | null
          id: string | null
          source: string | null
          user_id: string | null
        }
        Relationships: []
      }
      lesson_rating_stats: {
        Row: {
          average_rating: number | null
          five_star_count: number | null
          five_star_percentage: number | null
          lesson_id: string | null
          total_ratings: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_ratings_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "tutor_lesson_memory"
            referencedColumns: ["id"]
          },
        ]
      }
      mnemonic_utility_agg: {
        Row: {
          avg_rating: number | null
          avg_utility: number | null
          feedback_count: number | null
          last_feedback_at: string | null
          negative_count: number | null
          positive_count: number | null
          result_id: string | null
          tema: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mnemonic_feedback_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "mnemonic_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mnemonic_feedback_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "v_mnemonic_latest_results"
            referencedColumns: ["id"]
          },
        ]
      }
      noc_metrics: {
        Row: {
          active_users: number | null
          avg_latency: number | null
          critical_incidents: number | null
          hourly_abandonment: number | null
        }
        Relationships: []
      }
      performance_unified: {
        Row: {
          data_registro: string | null
          questoes_erradas: number | null
          questoes_feitas: number | null
          source: string | null
          source_id: string | null
          subtema: string | null
          taxa_acerto: number | null
          tema: string | null
          user_id: string | null
        }
        Relationships: []
      }
      prompt_performance_analytics: {
        Row: {
          avg_precision: number | null
          avg_scientific_accuracy: number | null
          critical_hallucinations: number | null
          prompt_id: string | null
          prompt_name: string | null
          prompt_version: string | null
          specialty: string | null
          total_generations: number | null
          total_issues: number | null
        }
        Relationships: []
      }
      tutor_health_metrics: {
        Row: {
          avg_latency_ms: number | null
          ctr_pct: number | null
          day: string | null
          error_rate_pct: number | null
          match_rate_pct: number | null
          matches_found: number | null
          total_clicks: number | null
          total_errors: number | null
          total_messages: number | null
        }
        Relationships: []
      }
      v_abandoned_sessions: {
        Row: {
          day: string | null
          entry_route: string | null
          started_at: string | null
          user_id: string | null
          viewport: string | null
        }
        Relationships: []
      }
      v_alias_coverage: {
        Row: {
          alias_key: string | null
          alias_target: string | null
          avg_confidence: number | null
          first_seen: string | null
          last_seen: string | null
          total_matches: number | null
        }
        Relationships: []
      }
      v_banca_question_coverage: {
        Row: {
          banca: string | null
          classificadas_specialty: number | null
          classificadas_subtopic: number | null
          classificadas_topic: number | null
          de_questions_bank: number | null
          de_real_exam: number | null
          pct_classificadas: number | null
          total_questoes: number | null
        }
        Relationships: []
      }
      v_classification_health: {
        Row: {
          generated_at: string | null
          pct_specialty: number | null
          pct_subtopic: number | null
          pct_topic: number | null
          queue_pending: number | null
          total_questions: number | null
          total_runs: number | null
          with_specialty: number | null
          with_subtopic: number | null
          with_topic: number | null
        }
        Relationships: []
      }
      v_curriculum_coverage_by_banca: {
        Row: {
          banca: string | null
          frequency_score: number | null
          has_weight: boolean | null
          importance_level: string | null
          peso: number | null
          specialty_id: string | null
          specialty_nome: string | null
          subtopic_id: string | null
          subtopic_nome: string | null
          topic_id: string | null
          topic_nome: string | null
        }
        Relationships: []
      }
      v_generator_telemetry_summary: {
        Row: {
          ab_bucket: string | null
          avg_batch_error_rate: number | null
          avg_duration_ms: number | null
          banca: string | null
          error_rate_pct: number | null
          error_runs: number | null
          fallback_rate_pct: number | null
          fallback_runs: number | null
          generation_mode: string | null
          last_run_at: string | null
          pipeline_used: string | null
          success_runs: number | null
          total_questions_generated: number | null
          total_runs: number | null
          user_profile: string | null
        }
        Relationships: []
      }
      v_hesitation_by_entry_point: {
        Row: {
          avg_clicks_before: number | null
          avg_route_changes_before: number | null
          avg_seconds_to_action: number | null
          entry_point: string | null
          median_seconds_to_action: number | null
          sessions: number | null
          viewport: string | null
        }
        Relationships: []
      }
      v_hesitation_by_route: {
        Row: {
          avg_clicks_before: number | null
          avg_route_changes_before: number | null
          avg_seconds_to_action: number | null
          median_seconds_to_action: number | null
          route: string | null
          sessions: number | null
          since: string | null
          viewport: string | null
        }
        Relationships: []
      }
      v_mnemonic_latest_results: {
        Row: {
          aprovado: boolean | null
          created_at: string | null
          frase_mnemonica: string | null
          id: string | null
          request_id: string | null
          score_final: number | null
          score_medico: number | null
          score_pedagogico: number | null
          sigla: string | null
          tema: string | null
          user_id: string | null
        }
        Insert: {
          aprovado?: boolean | null
          created_at?: string | null
          frase_mnemonica?: string | null
          id?: string | null
          request_id?: string | null
          score_final?: number | null
          score_medico?: number | null
          score_pedagogico?: number | null
          sigla?: string | null
          tema?: string | null
          user_id?: string | null
        }
        Update: {
          aprovado?: boolean | null
          created_at?: string | null
          frase_mnemonica?: string | null
          id?: string | null
          request_id?: string | null
          score_final?: number | null
          score_medico?: number | null
          score_pedagogico?: number | null
          sigla?: string | null
          tema?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mnemonic_results_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "mnemonic_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      v_mnemonic_user_stats: {
        Row: {
          media_score_final: number | null
          media_score_medico: number | null
          media_score_pedagogico: number | null
          total_aprovados: number | null
          total_resultados: number | null
          ultimo_resultado_em: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_navigation_loops: {
        Row: {
          created_at: string | null
          day: string | null
          entry_point: string | null
          final_route: string | null
          pre_action_clicks: number | null
          pre_action_route_changes: number | null
          seconds_to_action: number | null
          user_id: string | null
          viewport: string | null
        }
        Insert: {
          created_at?: string | null
          day?: never
          entry_point?: string | null
          final_route?: string | null
          pre_action_clicks?: number | null
          pre_action_route_changes?: number | null
          seconds_to_action?: never
          user_id?: string | null
          viewport?: string | null
        }
        Update: {
          created_at?: string | null
          day?: never
          entry_point?: string | null
          final_route?: string | null
          pre_action_clicks?: number | null
          pre_action_route_changes?: number | null
          seconds_to_action?: never
          user_id?: string | null
          viewport?: string | null
        }
        Relationships: []
      }
      v_route_efficiency_ranking: {
        Row: {
          avg_clicks: number | null
          avg_route_changes: number | null
          entry_point: string | null
          friction_score: number | null
          median_seconds: number | null
          route: string | null
          sessions: number | null
        }
        Relationships: []
      }
      v_subtopic_question_density: {
        Row: {
          questions_count: number | null
          specialty_nome: string | null
          subtopic_id: string | null
          subtopic_nome: string | null
          topic_nome: string | null
        }
        Relationships: []
      }
      v_time_to_action_summary: {
        Row: {
          action_kind: string | null
          avg_clicks_before: number | null
          avg_route_changes_before: number | null
          avg_seconds_to_action: number | null
          day: string | null
          entry_point: string | null
          median_seconds_to_action: number | null
          sessions: number | null
          viewport: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_ai_cache_report: {
        Args: { p_window_hours?: number }
        Returns: {
          cost_saved: number
          global_leak_risk: number
          hit_rate: number
          hits: number
          miss: number
          miss_expired: number
          module: string
          tokens_saved: number
          total_calls: number
        }[]
      }
      admin_telemetry_alerts: { Args: { _days?: number }; Returns: Json }
      admin_telemetry_audit: { Args: never; Returns: Json }
      admin_telemetry_baseline: { Args: never; Returns: Json }
      admin_telemetry_cohorts: { Args: { _days?: number }; Returns: Json }
      admin_telemetry_export: {
        Args: { _days?: number; _limit?: number }
        Returns: {
          device_type: string
          event_name: string
          properties: Json
          route: string
          screen_size: string
          session_id: string
          timestamp: string
          user_id: string
        }[]
      }
      admin_telemetry_funnel: {
        Args: { _days?: number }
        Returns: {
          order: number
          stage: string
          value: number
        }[]
      }
      admin_telemetry_heatmap: {
        Args: { _days?: number }
        Returns: {
          click_count: number
          event_name: string
          rage_click_count: number
          route: string
          sessions: number
        }[]
      }
      admin_telemetry_optimization_report: {
        Args: { _days?: number }
        Returns: Json
      }
      admin_telemetry_rca: { Args: { alert_id: string }; Returns: Json }
      admin_telemetry_tutor_quality: { Args: { _days?: number }; Returns: Json }
      admin_telemetry_v2_ai_quality: { Args: { _days: number }; Returns: Json }
      admin_telemetry_v2_pedagogy: { Args: { _days: number }; Returns: Json }
      append_questions_to_job: {
        Args: {
          p_job_id: string
          p_new_questions: Json
          p_status: Database["public"]["Enums"]["simulation_job_status"]
        }
        Returns: undefined
      }
      calculate_blueprint_health: {
        Args: { p_exam_key: string }
        Returns: number
      }
      calculate_cme_media_health_score: {
        Args: { lesson_id: string }
        Returns: number
      }
      check_feature_access: {
        Args: { f_name: string; u_id: string }
        Returns: boolean
      }
      check_function_exists: { Args: { func_name: string }; Returns: boolean }
      check_system_health: { Args: never; Returns: undefined }
      claim_cme_render_job: { Args: { worker_id: string }; Returns: string }
      cleanup_tutor_cache: { Args: never; Returns: undefined }
      compute_content_gaps: { Args: { p_image_type: string }; Returns: Json }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_user_medical_domain_map: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      evaluate_adaptive_intervention: {
        Args: {
          p_friction_score: number
          p_lesson_id: string
          p_metadata?: Json
          p_node_id: string
          p_trigger_type: string
          p_user_id: string
        }
        Returns: string
      }
      execute_data_retention: { Args: never; Returns: undefined }
      generate_incident_rca: { Args: { incident_id: string }; Returns: Json }
      get_active_blueprint: {
        Args: { p_exam_key: string }
        Returns: {
          specialty: string
          topic: string
          weight: number
        }[]
      }
      get_banca_coverage_report: {
        Args: never
        Returns: {
          banca: string
          microtopics_total: number
          pct_specialties: number
          pct_subtopics: number
          pct_topics: number
          peso_medio: number
          specialties_cobertas: number
          specialties_total: number
          status: string
          subtopics_cobertos: number
          subtopics_total: number
          top_gaps_specialties: Json
          topics_cobertos: number
          topics_total: number
        }[]
      }
      get_banca_generator_readiness: {
        Args: never
        Returns: {
          banca: string
          curriculum_status: string
          generator_status: string
          generator_status_reason: string
          highlight: boolean
          pct_questoes_classificadas: number
          pct_subtopics: number
          questions_status: string
          questoes_classificadas: number
          specialties_cobertas: number
          specialties_total: number
          subtopics_cobertos: number
          subtopics_total: number
          topics_cobertos: number
          topics_total: number
          total_questoes: number
        }[]
      }
      get_classmate_profile: {
        Args: { _target_user_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          faculdade: string
          user_id: string
          user_type: string
        }[]
      }
      get_gamification_leaderboard: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          current_streak: number
          display_name: string
          level: number
          user_id: string
          xp: number
        }[]
      }
      get_image_integrity_summary: {
        Args: never
        Returns: {
          avg_confidence: number
          image_type: string
          integrity_issues: number
          is_active: boolean
          review_status: string
          total: number
          unique_images: number
        }[]
      }
      get_login_stats: {
        Args: never
        Returns: {
          alunos: number
          flashcards: number
          questoes: number
        }[]
      }
      get_login_testimonials: {
        Args: never
        Returns: {
          avg_rating: number
          display_name: string
          feedback_text: string
        }[]
      }
      get_rag_health_stats: { Args: never; Returns: Json }
      get_ranking_leaderboard: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          consistency_rank: number
          consistency_score: number
          display_name: string
          evolution_rank: number
          evolution_score: number
          percentile: number
          performance_rank: number
          performance_rank_delta: number
          performance_score: number
          practical_rank: number
          practical_score: number
          snapshot_date: string
          user_id: string
        }[]
      }
      get_simulado_selection_overview: {
        Args: { _days?: number }
        Returns: {
          avg_ai: number
          avg_fallback: number
          avg_image: number
          avg_structural: number
          avg_textual: number
          by_banca: Json
          by_mode: Json
          granular_eligible_pct: number
          top_fallback_reasons: Json
          total_runs: number
        }[]
      }
      granular_classification_readiness: {
        Args: never
        Returns: {
          pct_specialty: number
          pct_subtopic: number
          pct_topic: number
          total_questions: number
          with_specialty_id: number
          with_subtopic_id: number
          with_topic_id: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_lesson_staff: { Args: { _user_id: string }; Returns: boolean }
      list_student_facets_for_professor: {
        Args: never
        Returns: {
          faculdades: string[]
          periodos: number[]
        }[]
      }
      list_students_for_professor: {
        Args: {
          _faculdade?: string
          _limit?: number
          _periodo?: number
          _search?: string
        }
        Returns: {
          avatar_url: string
          display_name: string
          email: string
          faculdade: string
          periodo: number
          user_id: string
        }[]
      }
      log_ai_alert: {
        Args: {
          p_content_id?: string
          p_message: string
          p_metadata?: Json
          p_severity: string
          p_type: string
        }
        Returns: string
      }
      log_multimodal_audit: {
        Args: {
          p_action: string
          p_error?: string
          p_latency_ms: number
          p_module: string
          p_payload: Json
          p_response: Json
          p_status: string
        }
        Returns: undefined
      }
      mark_stale_cme_jobs_failed: { Args: never; Returns: undefined }
      match_rag_chunks: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          content: string
          document_id: string
          id: string
          similarity: number
        }[]
      }
      match_tutor_memory: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
          user_id_filter?: string
        }
        Returns: {
          answer_summary: string
          block_types: string[]
          blocks: Json
          created_at: string
          difficulty_level: string
          id: string
          intent: string
          last_used_at: string
          model_used: string
          quality_score: number
          question_normalized: string
          question_original: string
          reuse_count: number
          scope: string
          similarity: number
          source: string
          specialty: string
          subtopic: string
          topic: string
          updated_at: string
          user_id: string
        }[]
      }
      match_tutor_memory_hybrid: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_abbrev?: string[]
          query_embedding: string
          query_subtopic?: string
          query_symptoms?: string[]
          query_topic?: string
          user_id_filter?: string
        }
        Returns: {
          abbreviation_overlap_count: number
          answer_summary: string
          block_types: string[]
          blocks: Json
          created_at: string
          difficulty_level: string
          hybrid_score: number
          id: string
          intent: string
          last_used_at: string
          model_used: string
          quality_score: number
          question_normalized: string
          question_original: string
          reuse_count: number
          scope: string
          similarity: number
          source: string
          specialty: string
          subtopic: string
          symptom_keywords: string[]
          symptom_overlap_count: number
          topic: string
          topic_overlap: boolean
          updated_at: string
          user_id: string
        }[]
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
      normalize_medical_topic: { Args: { t: string }; Returns: string }
      professor_owns_clinical_case: {
        Args: { _case_id: string; _user_id: string }
        Returns: boolean
      }
      professor_owns_mentor_plan: {
        Args: { _plan_id: string; _user_id: string }
        Returns: boolean
      }
      professor_owns_plan: {
        Args: { _plan_id: string; _user_id: string }
        Returns: boolean
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recalibrate_clinical_profiles: { Args: never; Returns: undefined }
      reconcile_and_smooth_weights: {
        Args: { p_exam_key: string; p_smoothing_factor?: number }
        Returns: undefined
      }
      record_clinical_audit: {
        Args: {
          p_accuracy: number
          p_distractor: number
          p_exam_key: string
          p_explanation: number
          p_hash: string
          p_specialty: string
          p_style: number
          p_topic: string
        }
        Returns: boolean
      }
      refresh_video_cognitive_heatmap: {
        Args: { p_video_lesson_id: string }
        Returns: undefined
      }
      student_has_clinical_case_result: {
        Args: { _case_id: string; _user_id: string }
        Returns: boolean
      }
      student_has_simulado_result: {
        Args: { _simulado_id: string; _user_id: string }
        Returns: boolean
      }
      student_has_study_assignment_result: {
        Args: { _assignment_id: string; _user_id: string }
        Returns: boolean
      }
      sync_cognitive_rhythm: { Args: { p_user_id: string }; Returns: undefined }
      tutor_memory_adjust_quality: {
        Args: { _delta: number; _memory_id: string }
        Returns: undefined
      }
      tutor_memory_increment_reuse: {
        Args: { _memory_id: string }
        Returns: undefined
      }
      unaccent: { Args: { "": string }; Returns: string }
      upsert_error_bank_entry: {
        Args: {
          p_categoria_erro?: string
          p_conteudo?: string
          p_dificuldade?: number
          p_motivo_erro?: string
          p_subtema?: string
          p_tema: string
          p_tipo_questao?: string
          p_user_id: string
        }
        Returns: string
      }
      user_can_read_mentor_plan: {
        Args: { _plan_id: string; _user_id: string }
        Returns: boolean
      }
      user_institution_id: { Args: { _user_id: string }; Returns: string }
      user_is_institution_staff: {
        Args: { _user_id: string }
        Returns: boolean
      }
      user_is_target_of_plan: {
        Args: { _plan_id: string; _user_id: string }
        Returns: boolean
      }
      users_share_institution: {
        Args: { _target_user_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      aggregation_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "waiting_manual_upload"
      ai_content_type:
        | "technical_summary"
        | "feynman_summary"
        | "flashcards"
        | "quiz"
        | "video_script"
        | "commented_questions"
      app_role:
        | "admin"
        | "user"
        | "professor"
        | "coordinator"
        | "institutional_admin"
      cme_aggregation_status:
        | "pending"
        | "aggregating"
        | "blocks_generated"
        | "builder_ready"
        | "rendering"
        | "validating"
        | "ready"
        | "failed"
      cme_block_type:
        | "introduction"
        | "physiology"
        | "clinic"
        | "diagnosis"
        | "treatment"
        | "pharmacology"
        | "case_study"
        | "feynman"
        | "review"
        | "summary"
      cme_incident_severity: "low" | "medium" | "high" | "critical"
      cme_render_status:
        | "queued"
        | "planning"
        | "scene_graph_generation"
        | "rendering"
        | "uploading"
        | "validating"
        | "ready"
        | "failed"
      cme_worker_status: "online" | "offline" | "maintenance" | "draining"
      content_status:
        | "draft"
        | "processing"
        | "review"
        | "approved"
        | "published"
        | "archived"
        | "ai_generated"
        | "pedagogical_review"
        | "scientific_review"
        | "rejected"
        | "failed"
      difficulty_level: "easy" | "medium" | "hard"
      image_question_status:
        | "draft"
        | "validated"
        | "published"
        | "archived"
        | "upgrading"
        | "upgraded"
        | "needs_review"
        | "rejected"
      image_review_status:
        | "draft"
        | "validated"
        | "archived"
        | "needs_review"
        | "blocked_clinical"
        | "experimental_only"
        | "published"
      lesson_generation_status: "queued" | "processing" | "completed" | "failed"
      lesson_type_enum:
        | "resumo"
        | "aula_completa"
        | "revisao"
        | "questoes"
        | "mapa_mental"
      medical_image_type:
        | "ecg"
        | "xray"
        | "ct"
        | "mri"
        | "us"
        | "dermatology"
        | "pathology"
        | "ophthalmology"
        | "endoscopy"
        | "obstetric_trace"
      notification_channel: "in_app" | "email"
      qa_error_type:
        | "IA_QUALIDADE"
        | "IA_JSON_INVALIDO"
        | "IA_RESPOSTA_EM_INGLES"
        | "ENUNCIADO_CURTO"
        | "ALTERNATIVA_FRACA"
        | "CACHE_VAZIO"
        | "CACHE_NAO_POPULADO"
        | "AUTH_401"
        | "AUTH_TOKEN_AUSENTE"
        | "EDGE_TIMEOUT"
        | "EDGE_FALHA_INTERNA"
        | "DADOS_INCONSISTENTES"
        | "DADOS_ORFAOS"
        | "RLS_NEGANDO_ACESSO"
        | "LOG_NAO_REGISTRADO"
        | "MISSAO_INCOERENTE"
        | "TUTOR_GENERICO"
        | "PROGRESSO_NAO_ATUALIZA"
        | "CTA_SEM_ACAO"
        | "PERFORMANCE_BAIXA"
      qa_fix_status:
        | "detectado"
        | "corrigido_automaticamente"
        | "corrigido_com_retry"
        | "corrigido_parcialmente"
        | "falha_persistente"
        | "escalado"
      qa_severity: "critico" | "alto" | "medio" | "baixo"
      simulado_status:
        | "draft"
        | "scheduled"
        | "published"
        | "in_progress"
        | "closed"
        | "corrected"
        | "archived"
        | "paused"
      simulation_job_status:
        | "pending"
        | "processing"
        | "partial"
        | "completed"
        | "failed"
        | "cancelled"
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
      aggregation_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "waiting_manual_upload",
      ],
      ai_content_type: [
        "technical_summary",
        "feynman_summary",
        "flashcards",
        "quiz",
        "video_script",
        "commented_questions",
      ],
      app_role: [
        "admin",
        "user",
        "professor",
        "coordinator",
        "institutional_admin",
      ],
      cme_aggregation_status: [
        "pending",
        "aggregating",
        "blocks_generated",
        "builder_ready",
        "rendering",
        "validating",
        "ready",
        "failed",
      ],
      cme_block_type: [
        "introduction",
        "physiology",
        "clinic",
        "diagnosis",
        "treatment",
        "pharmacology",
        "case_study",
        "feynman",
        "review",
        "summary",
      ],
      cme_incident_severity: ["low", "medium", "high", "critical"],
      cme_render_status: [
        "queued",
        "planning",
        "scene_graph_generation",
        "rendering",
        "uploading",
        "validating",
        "ready",
        "failed",
      ],
      cme_worker_status: ["online", "offline", "maintenance", "draining"],
      content_status: [
        "draft",
        "processing",
        "review",
        "approved",
        "published",
        "archived",
        "ai_generated",
        "pedagogical_review",
        "scientific_review",
        "rejected",
        "failed",
      ],
      difficulty_level: ["easy", "medium", "hard"],
      image_question_status: [
        "draft",
        "validated",
        "published",
        "archived",
        "upgrading",
        "upgraded",
        "needs_review",
        "rejected",
      ],
      image_review_status: [
        "draft",
        "validated",
        "archived",
        "needs_review",
        "blocked_clinical",
        "experimental_only",
        "published",
      ],
      lesson_generation_status: ["queued", "processing", "completed", "failed"],
      lesson_type_enum: [
        "resumo",
        "aula_completa",
        "revisao",
        "questoes",
        "mapa_mental",
      ],
      medical_image_type: [
        "ecg",
        "xray",
        "ct",
        "mri",
        "us",
        "dermatology",
        "pathology",
        "ophthalmology",
        "endoscopy",
        "obstetric_trace",
      ],
      notification_channel: ["in_app", "email"],
      qa_error_type: [
        "IA_QUALIDADE",
        "IA_JSON_INVALIDO",
        "IA_RESPOSTA_EM_INGLES",
        "ENUNCIADO_CURTO",
        "ALTERNATIVA_FRACA",
        "CACHE_VAZIO",
        "CACHE_NAO_POPULADO",
        "AUTH_401",
        "AUTH_TOKEN_AUSENTE",
        "EDGE_TIMEOUT",
        "EDGE_FALHA_INTERNA",
        "DADOS_INCONSISTENTES",
        "DADOS_ORFAOS",
        "RLS_NEGANDO_ACESSO",
        "LOG_NAO_REGISTRADO",
        "MISSAO_INCOERENTE",
        "TUTOR_GENERICO",
        "PROGRESSO_NAO_ATUALIZA",
        "CTA_SEM_ACAO",
        "PERFORMANCE_BAIXA",
      ],
      qa_fix_status: [
        "detectado",
        "corrigido_automaticamente",
        "corrigido_com_retry",
        "corrigido_parcialmente",
        "falha_persistente",
        "escalado",
      ],
      qa_severity: ["critico", "alto", "medio", "baixo"],
      simulado_status: [
        "draft",
        "scheduled",
        "published",
        "in_progress",
        "closed",
        "corrected",
        "archived",
        "paused",
      ],
      simulation_job_status: [
        "pending",
        "processing",
        "partial",
        "completed",
        "failed",
        "cancelled",
      ],
    },
  },
} as const
