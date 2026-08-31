import type { Database as GeneratedDatabase } from "./database.generated";

type IncidentScopedReadFunctions = {
  get_incident_summary: {
    Args: { p_incident_id: string };
    Returns: {
      incident_id: string;
      incident_number: string;
      display_name: string;
      status: string;
      occurred_at: string;
      category: string;
      current_revision_number: number;
      updated_at: string;
    }[];
  };
  list_incident_reports: {
    Args: { p_incident_id: string };
    Returns: {
      report_id: string;
      incident_number: string;
      incident_name: string;
      report_type: string;
      status: string;
      current_revision_number: number;
      updated_at: string;
    }[];
  };
};

/**
 * Generated Supabase types plus forward-only RPCs introduced by migrations in
 * this branch. Regenerate database.generated.ts after the migrations are
 * applied to an isolated local database, then remove this augmentation.
 */
export type Database = Omit<GeneratedDatabase, "api"> & {
  api: Omit<GeneratedDatabase["api"], "Functions"> & {
    Functions: GeneratedDatabase["api"]["Functions"] &
      IncidentScopedReadFunctions;
  };
};
