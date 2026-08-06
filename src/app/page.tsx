import {
  fetchTargets,
  fetchCounts,
  SECTOR_FILTERS,
  STATUSES,
  type TargetStatus,
  type Target,
} from "@/lib/targets";
import { setTargetStatus, setTargetRead } from "./actions";
import { CompanyLink } from "./CompanyLink";
import { Accordion } from "./Accordion";

export const dynamic = "force-dynamic";

const STAGE_LABELS: Record<string, string> = {
  "pre-seed": "Pre-seed",
  seed: "Seed",
  "series-a": "Series A",
};

// Filter-nav labels — backend workflow status, unrelated to the read/unread row badge below.
const STATUS_LABELS: Record<TargetStatus, string> = {
  new: "New",
  contacted: "Contacted",
  dismissed: "Dismissed",
};

// Row badge: read state folded into the status progression — new -> read -> contacted/dismissed.
const ROW_STATUS_STYLES = {
  new: { label: "New", color: "var(--status-accent)" },
  read: { label: "Read", color: "var(--status-read)" },
  contacted: { label: "Contacted", color: "var(--status-good)" },
  dismissed: { label: "Dismissed", color: "var(--status-muted)" },
} as const;

function rowStatus(target: Target) {
  if (target.status === "new") return ROW_STATUS_STYLES[target.is_read ? "read" : "new"];
  return ROW_STATUS_STYLES[target.status];
}

function formatMoney(usd: number | null): string {
  if (usd == null) return "—";
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${Math.round(usd / 1_000)}K`;
  return `$${usd}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

// Locations are free text — "City, Country" is one place, but "and" / "/" join distinct
// alternatives ("UK, London and Berlin", "Kenya/Uganda"). Split on those only.
function splitLocations(location: string | null): { key: string; extra: string[] } | null {
  if (!location) return null;
  const parts = location
    .split(/\s+and\s+|\//i)
    .map((p) => p.trim())
    .filter(Boolean);
  return { key: parts[0], extra: parts.slice(1) };
}

function hrefWith(
  current: { status?: string; sector?: string; unread?: boolean },
  changes: { status?: string; sector?: string; unread?: boolean }
): string {
  const merged = { ...current, ...changes };
  const params = new URLSearchParams();
  if (merged.status) params.set("status", merged.status);
  if (merged.sector) params.set("sector", merged.sector);
  if (merged.unread) params.set("unread", "1");
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export default async function Home({
  searchParams,
}: {
  searchParams: { status?: string; sector?: string; unread?: string };
}) {
  const status = STATUSES.includes(searchParams.status as TargetStatus) ? (searchParams.status as TargetStatus) : undefined;
  const sector = SECTOR_FILTERS.includes(searchParams.sector as (typeof SECTOR_FILTERS)[number])
    ? (searchParams.sector as (typeof SECTOR_FILTERS)[number])
    : undefined;
  const unreadOnly = searchParams.unread === "1";

  const [targets, counts] = await Promise.all([fetchTargets({ status, sector, unreadOnly }), fetchCounts()]);
  const total = counts.new + counts.contacted + counts.dismissed;
  const current = { status, sector, unread: unreadOnly };

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 pt-6 sm:pt-10">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Startup Targets
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Newly-funded deep tech, climate, defence, energy, biotech, fintech &amp; health tech startups in the UK and EU with raises less than $50M.
          </p>
        </header>

        <section className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
          <StatTile label="Total" value={total} />
          <StatTile label="Unread" value={counts.unread} accent="var(--status-accent)" />
          <StatTile label="New" value={counts.new} />
          <StatTile label="Contacted" value={counts.contacted} accent="var(--status-good)" />
          <StatTile label="Dismissed" value={counts.dismissed} accent="var(--status-muted)" />
        </section>

        <nav className="flex flex-wrap gap-2 mb-3" aria-label="Filter by read state">
          <FilterPill href={hrefWith(current, { unread: false })} active={!unreadOnly} label="All" />
          <FilterPill href={hrefWith(current, { unread: true })} active={unreadOnly} label="Unread only" />
        </nav>

        <nav className="flex flex-wrap gap-2 mb-3" aria-label="Filter by status">
          <FilterPill href={hrefWith(current, { status: undefined })} active={!status} label="All statuses" />
          {STATUSES.map((s) => (
            <FilterPill key={s} href={hrefWith(current, { status: s })} active={status === s} label={STATUS_LABELS[s]} />
          ))}
        </nav>

        <nav className="flex flex-wrap gap-2 mb-6" aria-label="Filter by sector">
          <FilterPill href={hrefWith(current, { sector: undefined })} active={!sector} label="All sectors" />
          {SECTOR_FILTERS.map((s) => (
            <FilterPill key={s} href={hrefWith(current, { sector: s })} active={sector === s} label={s} />
          ))}
        </nav>
      </div>

      {targets.length === 0 ? (
        <p className="text-sm py-12 text-center px-6 sm:px-10" style={{ color: "var(--text-muted)" }}>
          No targets match this filter yet.
        </p>
      ) : (
        // Edge-to-edge: breaks out of the max-w-6xl wrapper above on purpose, so no rounding/side borders.
        <div className="pb-10" style={{ borderTop: "1px solid var(--border)" }}>
          <div
            className="hidden md:grid gap-x-4 px-6 sm:px-10 py-2.5 text-xs font-medium"
            style={{
              gridTemplateColumns: ROW_GRID,
              color: "var(--text-secondary)",
              borderBottom: "1px solid var(--gridline)",
            }}
          >
            <span>Company</span>
            <span>Location</span>
            <span>Sector</span>
            <span>Stage</span>
            <span>Round</span>
            <span>Status</span>
            <span />
          </div>
          {targets.map((t) => (
            <TargetRow key={t.id} target={t} />
          ))}
        </div>
      )}
    </main>
  );
}

// Company | Location | Sector | Stage | Round | Status, flanked by the expand chevron.
const ROW_GRID = "1.8fr 1fr 0.9fr 0.7fr 1fr 0.9fr 16px";

function StatTile({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-lg p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1" style={{ color: accent ?? "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

function FilterPill({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 rounded px-3 py-1 text-xs capitalize transition-colors focus-visible:outline-none focus-visible:ring-2"
      style={{
        background: active ? "var(--accent)" : "var(--surface-1)",
        color: active ? "#ffffff" : "var(--text-secondary)",
        border: "1px solid var(--border)",
        // @ts-expect-error -- CSS custom property for focus-visible ring color
        "--tw-ring-color": "var(--accent)",
      }}
    >
      {label}
    </a>
  );
}

function SectorTag({ sector }: { sector?: string | null }) {
  return (
    <span className="capitalize" style={{ color: "var(--text-secondary)" }}>
      {sector || "—"}
    </span>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 first:mt-0">
      <h4 className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
        {title}
      </h4>
      <div className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
        {children}
      </div>
    </div>
  );
}

function RoundInfo({ target }: { target: Target }) {
  return (
    <span className="whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
      {formatMoney(target.round_size_usd)}
      {target.round_date && <span style={{ color: "var(--text-muted)" }}> · {formatDate(target.round_date)}</span>}
    </span>
  );
}

function Chevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="chevron-icon justify-self-end shrink-0" style={{ color: "var(--text-muted)" }} aria-hidden="true">
      <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TargetRow({ target }: { target: Target }) {
  const read = target.is_read;
  const loc = splitLocations(target.location);
  const name = target.source_url ? (
    <CompanyLink id={target.id} href={target.source_url} isRead={read}>
      {target.company_name}
    </CompanyLink>
  ) : (
    target.company_name
  );

  return (
    <div style={{ borderBottom: "1px solid var(--gridline)" }}>
      <Accordion
        summary={
          <div className="px-6 sm:px-10 py-3">
            {/* Below md: stacked card-style header */}
            <div className="md:hidden">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                    {name}
                  </div>
                  {loc && (
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      {loc.key}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge target={target} />
                  <Chevron />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
                <SectorTag sector={target.sector} />
                {target.stage && <span style={{ color: "var(--text-secondary)" }}>{STAGE_LABELS[target.stage] ?? target.stage}</span>}
                <RoundInfo target={target} />
              </div>
            </div>

            {/* md and up: table-style grid row */}
            <div className="hidden md:grid items-center gap-x-4 text-sm" style={{ gridTemplateColumns: ROW_GRID }}>
              <div className="font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {name}
              </div>
              <div className="truncate" style={{ color: "var(--text-secondary)" }}>
                {loc?.key ?? "—"}
              </div>
              <SectorTag sector={target.sector} />
              <div style={{ color: "var(--text-secondary)" }}>{target.stage ? STAGE_LABELS[target.stage] ?? target.stage : "—"}</div>
              <RoundInfo target={target} />
              <StatusBadge target={target} />
              <Chevron />
            </div>
          </div>
        }
      >
        <div className="px-6 sm:px-10 pb-4 pt-3">
          {target.summary && <DetailSection title="Company overview">{target.summary}</DetailSection>}
          <DetailSection title="Locations">
            {loc ? (
              <ul className="space-y-0.5">
                <li>{loc.key}</li>
                {loc.extra.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            ) : (
              "—"
            )}
          </DetailSection>
          <DetailSection title="Investors">{target.investors.length > 0 ? target.investors.join(", ") : "—"}</DetailSection>
          <div className="mt-4">
            <TargetActions target={target} read={read} />
          </div>
        </div>
      </Accordion>
    </div>
  );
}

function StatusBadge({ target }: { target: Target }) {
  const { label, color } = rowStatus(target);
  return <span style={{ color }}>{label}</span>;
}

function TargetActions({ target, read }: { target: Target; read: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {read ? (
        <ActionButton action={setTargetRead.bind(null, target.id, false)} label="Mark unread" />
      ) : (
        <ActionButton action={setTargetRead.bind(null, target.id, true)} label="Mark read" />
      )}
      {target.status !== "contacted" && (
        <ActionButton action={setTargetStatus.bind(null, target.id, "contacted")} label="Mark contacted" />
      )}
      {target.status !== "dismissed" && (
        <ActionButton action={setTargetStatus.bind(null, target.id, "dismissed")} label="Dismiss" />
      )}
      {target.status !== "new" && <ActionButton action={setTargetStatus.bind(null, target.id, "new")} label="Reopen" />}
    </div>
  );
}

function ActionButton({ action, label }: { action: () => Promise<void>; label: string }) {
  return (
    <form action={action}>
      <button
        type="submit"
        className="action-btn text-xs rounded px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2"
        style={{
          color: "var(--text-secondary)",
          border: "1px solid var(--border)",
          // @ts-expect-error -- CSS custom property for focus ring color
          "--tw-ring-color": "var(--accent)",
        }}
      >
        {label}
      </button>
    </form>
  );
}
