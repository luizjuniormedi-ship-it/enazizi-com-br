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
          specialty: string | null
          subtopic: string | null
          topic: string | null
          updated_at: string
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
          specialty?: string | null
          subtopic?: string | null
          topic?: string | null
          updated_at?: string
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
          specialty?: string | null
          subtopic?: string | null
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
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
          id?: string
          input_snapshot?: Json
          justification?: string
          source_module?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          total_blocks?: number
          updated_at?: string | null
          user_id?: string
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
          tema: string
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
          tema: string
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
          tema?: string
          tipo_questao?: string
          updated_at?: string
          user_id?: string
          vezes_errado?: number
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
      flashcards: {
        Row: {
          answer: string
          created_at: string
          id: string
          is_global: boolean
          organization_id: string | null
          question: string
          source_map_id: string | null
          topic: string | null
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          is_global?: boolean
          organization_id?: string | null
          question: string
          source_map_id?: string | null
          topic?: string | null
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          is_global?: boolean
          organization_id?: string | null
          question?: string
          source_map_id?: string | null
          topic?: string | null
          user_id?: string
        }
        Relationships: [
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
      lesson_segments: {
        Row: {
          created_at: string
          end_second: number | null
          id: string
          lesson_id: string
          ordem: number
          start_second: number | null
          title: string | null
          transcript_segment: string | null
        }
        Insert: {
          created_at?: string
          end_second?: number | null
          id?: string
          lesson_id: string
          ordem?: number
          start_second?: number | null
          title?: string | null
          transcript_segment?: string | null
        }
        Update: {
          created_at?: string
          end_second?: number | null
          id?: string
          lesson_id?: string
          ordem?: number
          start_second?: number | null
          title?: string | null
          transcript_segment?: string | null
        }
        Relationships: [
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
          id: string
          question_id: string
          user_id: string
        }
        Insert: {
          correct: boolean
          created_at?: string
          id?: string
          question_id: string
          user_id: string
        }
        Update: {
          correct?: boolean
          created_at?: string
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
          has_completed_diagnostic: boolean | null
          id: string
          is_blocked: boolean
          last_onboarding_step: number | null
          onboarding_version: number
          organization_id: string | null
          periodo: number | null
          phone: string | null
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
          has_completed_diagnostic?: boolean | null
          id?: string
          is_blocked?: boolean
          last_onboarding_step?: number | null
          onboarding_version?: number
          organization_id?: string | null
          periodo?: number | null
          phone?: string | null
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
          has_completed_diagnostic?: boolean | null
          id?: string
          is_blocked?: boolean
          last_onboarding_step?: number | null
          onboarding_version?: number
          organization_id?: string | null
          periodo?: number | null
          phone?: string | null
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
          correct_index: number | null
          created_at: string
          difficulty: number | null
          exam_bank_id: string | null
          explanation: string | null
          id: string
          image_url: string | null
          is_global: boolean | null
          language: string | null
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
          statement: string
          subtopic: string | null
          topic: string | null
          user_id: string
        }
        Insert: {
          correct_index?: number | null
          created_at?: string
          difficulty?: number | null
          exam_bank_id?: string | null
          explanation?: string | null
          id?: string
          image_url?: string | null
          is_global?: boolean | null
          language?: string | null
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
          statement: string
          subtopic?: string | null
          topic?: string | null
          user_id: string
        }
        Update: {
          correct_index?: number | null
          created_at?: string
          difficulty?: number | null
          exam_bank_id?: string | null
          explanation?: string | null
          id?: string
          image_url?: string | null
          is_global?: boolean | null
          language?: string | null
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
          statement?: string
          subtopic?: string | null
          topic?: string | null
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
          confidence_score: number
          correct_index: number | null
          created_at: string
          difficulty: number
          exam_info: string | null
          explanation: string | null
          id: string
          is_active: boolean
          options: Json
          quality_score: number
          source_url: string
          statement: string
          statement_hash: string
          subtopic: string | null
          topic: string
          updated_at: string
        }
        Insert: {
          answer_source?: string
          confidence_score?: number
          correct_index?: number | null
          created_at?: string
          difficulty?: number
          exam_info?: string | null
          explanation?: string | null
          id?: string
          is_active?: boolean
          options?: Json
          quality_score?: number
          source_url: string
          statement: string
          statement_hash: string
          subtopic?: string | null
          topic: string
          updated_at?: string
        }
        Update: {
          answer_source?: string
          confidence_score?: number
          correct_index?: number | null
          created_at?: string
          difficulty?: number
          exam_info?: string | null
          explanation?: string | null
          id?: string
          is_active?: boolean
          options?: Json
          quality_score?: number
          source_url?: string
          statement?: string
          statement_hash?: string
          subtopic?: string | null
          topic?: string
          updated_at?: string
        }
        Relationships: []
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
      simulation_history: {
        Row: {
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
      teacher_simulados: {
        Row: {
          auto_assign: boolean | null
          created_at: string
          description: string | null
          faculdade_filter: string | null
          id: string
          periodo_filter: number | null
          professor_id: string
          questions_json: Json
          scheduled_at: string | null
          status: string
          time_limit_minutes: number
          title: string
          topics: string[]
          total_questions: number
          updated_at: string
        }
        Insert: {
          auto_assign?: boolean | null
          created_at?: string
          description?: string | null
          faculdade_filter?: string | null
          id?: string
          periodo_filter?: number | null
          professor_id: string
          questions_json?: Json
          scheduled_at?: string | null
          status?: string
          time_limit_minutes?: number
          title?: string
          topics?: string[]
          total_questions?: number
          updated_at?: string
        }
        Update: {
          auto_assign?: boolean | null
          created_at?: string
          description?: string | null
          faculdade_filter?: string | null
          id?: string
          periodo_filter?: number | null
          professor_id?: string
          questions_json?: Json
          scheduled_at?: string | null
          status?: string
          time_limit_minutes?: number
          title?: string
          topics?: string[]
          total_questions?: number
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
          status: string | null
          subtopico: string | null
          tema: string
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
          status?: string | null
          subtopico?: string | null
          tema: string
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
          status?: string | null
          subtopico?: string | null
          tema?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      tutor_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          input_context_json: Json | null
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
      uploads: {
        Row: {
          category: string | null
          created_at: string
          extracted_json: Json | null
          extracted_text: string | null
          file_type: string | null
          filename: string
          id: string
          is_global: boolean
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
          is_global?: boolean
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
          is_global?: boolean
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
    }
    Functions: {
      compute_content_gaps: { Args: { p_image_type: string }; Returns: Json }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      professor_owns_clinical_case: {
        Args: { _case_id: string; _user_id: string }
        Returns: boolean
      }
      professor_owns_mentor_plan: {
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
      user_can_read_mentor_plan: {
        Args: { _plan_id: string; _user_id: string }
        Returns: boolean
      }
      user_institution_id: { Args: { _user_id: string }; Returns: string }
      user_is_institution_staff: {
        Args: { _user_id: string }
        Returns: boolean
      }
      users_share_institution: {
        Args: { _target_user_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "professor"
        | "coordinator"
        | "institutional_admin"
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
      app_role: [
        "admin",
        "user",
        "professor",
        "coordinator",
        "institutional_admin",
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
    },
  },
} as const
