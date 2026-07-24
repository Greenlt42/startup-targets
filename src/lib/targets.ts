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
  is_read: boolean;
  contact_name: string | null;
  contact_linkedin_url: string | null;
  created_at: string;
}

export interface TargetFilters {
  status?: TargetStatus;
  sector?: (typeof SECTOR_FILTERS)[number];
  unreadOnly?: boolean;
}

export async function fetchTargets(filters: TargetFilters): Promise<Target[]> {
  let query = supabase.from("targets").select("*").order("round_date", { ascending: false, nullsFirst: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.sector) query = query.eq("sector", filters.sector);
  if (filters.unreadOnly) query = query.eq("is_read", false);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Target[];
}

export interface Counts {
  new: number;
  contacted: number;
  dismissed: number;
  unread: number;
}

export async function fetchCounts(): Promise<Counts> {
  const counts: Counts = { new: 0, contacted: 0, dismissed: 0, unread: 0 };

  const { data, error } = await supabase.from("targets").select("status, is_read");
  if (error) throw error;

  for (const row of data ?? []) {
    const status = row.status as TargetStatus;
    if (status in counts) counts[status as keyof Omit<Counts, "unread">]++;
    if (!row.is_read) counts.unread++;
  }
  return counts;
}

export async function updateTargetStatus(id: string, status: TargetStatus): Promise<void> {
  const updates: { status: TargetStatus; updated_at: string; is_read?: boolean } = {
    status,
    updated_at: new Date().toISOString(),
  };
  // Taking an action on a target means you've obviously reviewed it —
  // reopening back to "new" leaves is_read untouched (still true if it was),
  // since reconsidering something isn't the same as never having seen it.
  if (status === "contacted" || status === "dismissed") updates.is_read = true;

  const { error } = await supabase.from("targets").update(updates).eq("id", id);
  if (error) throw error;
}

export async function updateTargetRead(id: string, isRead: boolean): Promise<void> {
  const { error } = await supabase.from("targets").update({ is_read: isRead, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
