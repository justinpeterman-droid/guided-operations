export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  api: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      append_report_revision: {
        Args: {
          p_base_revision_number: number
          p_idempotency_key_digest: string
          p_narrative: string
          p_reason: string
          p_report_id: string
          p_request_digest: string
        }
        Returns: number
      }
      create_incident: {
        Args: {
          p_category: string
          p_display_name: string
          p_facility_id: string
          p_field_notes: Json
          p_idempotency_key_digest: string
          p_incident_number: string
          p_occurred_at: string
          p_request_digest: string
          p_reviewed_facts: Json
          p_schema_version: number
          p_staff_relationships: Json
        }
        Returns: string
      }
      current_account: {
        Args: never
        Returns: {
          auth_user_id: string
          auth_version: number
          facility_id: string
          must_change_passcode: boolean
          role: string
          shift_code: string
          status: string
        }[]
      }
      finalize_report_draft_candidate: {
        Args: {
          p_candidate_id: string
          p_idempotency_key_digest: string
          p_narrative: string
          p_request_digest: string
        }
        Returns: string
      }
      get_count_sheet: {
        Args: { p_record_id: string }
        Returns: {
          created_at: string
          current_revision_number: number
          payload: Json
          record_id: string
          shift_code: string
          structure: Json
          updated_at: string
          validation: Json
          work_date: string
        }[]
      }
      get_count_sheet_revision: {
        Args: { p_record_id: string; p_revision_number: number }
        Returns: {
          created_at: string
          current_revision_number: number
          payload: Json
          reason: string
          record_id: string
          restored_from_revision_number: number
          revision_number: number
          shift_code: string
          structure: Json
          validation: Json
          work_date: string
        }[]
      }
      get_incident_report_workspace: {
        Args: { p_incident_id: string }
        Returns: {
          category: string
          display_name: string
          incident_id: string
          incident_number: string
          incident_revision_id: string
          reporting_officers: Json
          reviewed_facts: Json
          revision_number: number
          schema_version: number
        }[]
      }
      get_incident_revision: {
        Args: { p_incident_id: string; p_revision_number: number }
        Returns: {
          display_name: string
          incident_id: string
          incident_number: string
          incident_revision_id: string
          reviewed_facts: Json
          revision_number: number
          schema_version: number
        }[]
      }
      get_policy_source_reader: {
        Args: { p_document_version_id: string }
        Returns: {
          byte_size: number
          document_id: string
          document_version_id: string
          effective_on: string
          is_current: boolean
          lifecycle_status: string
          media_type: string
          page_count: number
          source_sha256: string
          stable_key: string
          storage_bucket: string
          storage_path: string
          title: string
          version_label: string
        }[]
      }
      get_report: {
        Args: { p_report_id: string }
        Returns: {
          created_at: string
          incident_id: string
          narrative: string
          report_id: string
          report_revision_id: string
          report_type: string
          revision_number: number
          schema_version: number
          source_incident_revision_id: string
          status: string
        }[]
      }
      get_report_draft_candidate: {
        Args: { p_candidate_id: string }
        Returns: {
          candidate_id: string
          created_at: string
          incident_id: string
          paragraphs: Json
          report_type: string
          reporting_officer_display_name: string
          reporting_staff_member_id: string
          source_fact_ids: string[]
          source_incident_revision_id: string
        }[]
      }
      list_admin_accounts: {
        Args: { p_limit?: number }
        Returns: {
          account_id: string
          display_name: string
          employee_number_hint: string
          must_change_passcode: boolean
          role: string
          shift_code: string
          status: string
          updated_at: string
        }[]
      }
      list_admin_audit_events: {
        Args: { p_limit?: number }
        Returns: {
          event_id: string
          event_type: string
          occurred_at: string
          outcome: string
          target_type: string
        }[]
      }
      list_count_sheet_revisions: {
        Args: { p_record_id: string }
        Returns: {
          created_at: string
          is_current: boolean
          reason: string
          restored_from_revision_number: number
          revision_number: number
          validation: Json
        }[]
      }
      list_count_sheets: {
        Args: { p_work_date: string }
        Returns: {
          current_revision_number: number
          record_id: string
          shift_code: string
          updated_at: string
          validation: Json
          work_date: string
        }[]
      }
      list_incidents: {
        Args: { p_limit?: number }
        Returns: {
          category: string
          current_revision_number: number
          display_name: string
          incident_id: string
          incident_number: string
          occurred_at: string
          status: string
          updated_at: string
        }[]
      }
      list_report_revisions: {
        Args: { p_report_id: string }
        Returns: {
          created_at: string
          is_current: boolean
          reason: string
          restored_from_revision_number: number
          revision_number: number
        }[]
      }
      list_reports: {
        Args: { p_limit?: number }
        Returns: {
          current_revision_number: number
          incident_name: string
          incident_number: string
          report_id: string
          report_type: string
          status: string
          updated_at: string
        }[]
      }
      list_staff_selection: {
        Args: { p_limit?: number }
        Returns: {
          display_name: string
          employee_number_hint: string
          is_current_account: boolean
          shift_code: string
          staff_member_id: string
        }[]
      }
      policy_source_object_is_readable: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      record_count_sheet_print: {
        Args: {
          p_idempotency_key_digest: string
          p_record_id: string
          p_request_digest: string
          p_request_id: string
          p_revision_number: number
        }
        Returns: string
      }
      record_report_print: {
        Args: {
          p_idempotency_key_digest: string
          p_report_id: string
          p_request_digest: string
          p_request_id: string
          p_revision_number: number
        }
        Returns: string
      }
      restore_count_sheet_revision: {
        Args: {
          p_base_revision_number: number
          p_idempotency_key_digest: string
          p_reason: string
          p_record_id: string
          p_request_digest: string
          p_restore_revision_number: number
        }
        Returns: number
      }
      restore_report_revision: {
        Args: {
          p_base_revision_number: number
          p_idempotency_key_digest: string
          p_reason: string
          p_report_id: string
          p_request_digest: string
          p_restore_revision_number: number
        }
        Returns: number
      }
      retrieve_policy_passages: {
        Args: { p_limit?: number; p_question: string }
        Returns: {
          chunk_id: string
          document_id: string
          document_version_id: string
          excerpt: string
          page_end: number
          page_start: number
          relevance_score: number
          section_path: string
          source_sha256: string
          stable_key: string
          title: string
          version_label: string
        }[]
      }
      retrieve_policy_passages_v2: {
        Args: {
          p_approved_document_version_ids?: string[]
          p_limit?: number
          p_question: string
        }
        Returns: {
          chunk_id: string
          document_id: string
          document_version_id: string
          excerpt: string
          page_end: number
          page_start: number
          relevance_score: number
          section_path: string
          source_sha256: string
          stable_key: string
          title: string
          version_label: string
        }[]
      }
      save_count_sheet: {
        Args: {
          p_base_revision_number: number
          p_idempotency_key_digest: string
          p_payload: Json
          p_reason: string
          p_request_digest: string
          p_structure: Json
          p_work_date: string
        }
        Returns: {
          record_id: string
          revision_number: number
        }[]
      }
      store_report_draft_candidate: {
        Args: {
          p_idempotency_key_digest: string
          p_incident_id: string
          p_paragraphs: Json
          p_provider_key: string
          p_report_type: string
          p_reporting_staff_member_id: string
          p_request_digest: string
          p_source_fact_ids: string[]
          p_source_incident_revision_id: string
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
  api: {
    Enums: {},
  },
} as const
