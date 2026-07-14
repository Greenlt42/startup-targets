import { supabase } from "./supabase";

export const STATUSES = ["new", "contacted", "dismissed"] as const;
export type TargetStatus = (typeof STATUSES)[number];

export const SECTOR_FILTERS = ["deep tech", "climate", "defence", "energy", "biotech", "fintech", "health tech"] as const;

export interface Target {
  id: string;
  company_name: string;
  website: string | null;
  sector: string | null;
  stage: string | null;
  round_size_usd: number | null;
  round_date: string | null;
  investors: string[];
  headcount: number | null;
  location: string | null;
  source_url: string | null;
  source_name: string | null;
  summary: string | null;
  status: TargetStatus;
  contact_name: string | null;
  contact_linkedin_url: string | null;
  created_at: string;
}

export interface TargetFilters {
  status?: TargetStatus;
  sector?: (typeof SECTOR_FILTERS)[number];
}

export async function fetchTargets(filters: TargetFilters): Promise<Target[]> {
  let query = supabase.from("targets").select("*").order("round_date", { ascending: false, nullsFirst: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.sector) query = query.eq("sector", filters.sector);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Target[];
}

export async function fetchStatusCounts(): Promise<Record<TargetStatus, number>> {
  const counts: Record<TargetStatus, number> = { new: 0, contacted: 0, dismissed: 0 };

  const { data, error } = await supabase.from("targets").select("status");
  if (error) throw error;

  for (const row of data ?? []) {
    const status = row.status as TargetStatus;
    if (status in counts) counts[status]++;
  }
  return counts;
}

export async function updateTargetStatus(id: string, status: TargetStatus): Promise<void> {
  const { error } = await supabase.from("targets").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
