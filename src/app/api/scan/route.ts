import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Triggered by a scheduled Make.com scenario hitting this route with a shared secret.
// Pipeline (to implement): fetch RSS feeds -> dedup against seen_articles ->
// AI-extract structured fields -> filter against criteria + investors table -> upsert targets.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.SCAN_WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: state } = await supabase
    .from("scan_state")
    .select("last_scan_date")
    .eq("id", 1)
    .single();

  // TODO: fetch feeds, extract, filter, upsert targets.
  const scannedAt = new Date().toISOString();

  await supabase
    .from("scan_state")
    .update({ last_scan_date: scannedAt })
    .eq("id", 1);

  return NextResponse.json({ ok: true, previousScanDate: state?.last_scan_date ?? null, scannedAt });
}
