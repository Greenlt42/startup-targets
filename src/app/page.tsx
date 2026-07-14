import {
  fetchTargets,
  fetchStatusCounts,
  SECTOR_FILTERS,
  STATUSES,
  type TargetStatus,
  type Target,
} from "@/lib/targets";
import { setTargetStatus } from "./actions";

export const dynamic = "force-dynamic";

const SECTOR_COLORS: Record<string, string> = {
  "deep tech": "var(--sector-deep-tech)",
  climate: "var(--sector-climate)",
  defence: "var(--sector-defence)",
  energy: "var(--sector-energy)",
  biotech: "var(--sector-biotech)",
  fintech: "var(--sector-fintech)",
  "health tech": "var(--sector-health-tech)",
};

const STAGE_LABELS: Record<string, string> = {
  "pre-seed": "Pre-seed",
  seed: "Seed",
  "series-a": "Series A",
};

const STATUS_LABELS: Record<TargetStatus, string> = {
  new: "New",
  contacted: "Contacted",
  dismissed: "Dismissed",
};

const STATUS_COLORS: Record<TargetStatus, string> = {
  new: "var(--status-accent)",
  contacted: "var(--status-good)",
  dismissed: "var(--status-muted)",
};

function formatMoney(usd: number | null): string {
  if (usd == null) return "—";
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${Math.round(usd / 1_000)}K`;
  return `$${usd}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function hrefWith(current: { status?: string; sector?: string }, changes: { status?: string; sector?: string }): string {
  const merged = { ...current, ...changes };
  const params = new URLSearchParams();
  if (merged.status) params.set("status", merged.status);
  if (merged.sector) params.set("sector", merged.sector);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export default async function Home({
  searchParams,
}: {
  searchParams: { status?: string; sector?: string };
}) {
  const status = STATUSES.includes(searchParams.status as TargetStatus) ? (searchParams.status as TargetStatus) : undefined;
  const sector = SECTOR_FILTERS.includes(searchParams.sector as (typeof SECTOR_FILTERS)[number])
    ? (searchParams.sector as (typeof SECTOR_FILTERS)[number])
    : undefined;

  const [targets, counts] = await Promise.all([fetchTargets({ status, sector }), fetchStatusCounts()]);
  const total = counts.new + counts.contacted + counts.dismissed;
  const current = { status, sector };

  return (
    <main className="min-h-screen p-6 sm:p-10 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Startup Targets
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Newly-funded deep tech, climate, defence, energy &amp; biotech startups worth a recruiting message.
        </p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatTile label="Total" value={total} />
        <StatTile label="New" value={counts.new} accent="var(--status-accent)" />
        <StatTile label="Contacted" value={counts.contacted} accent="var(--status-good)" />
        <StatTile label="Dismissed" value={counts.dismissed} accent="var(--status-muted)" />
      </section>

      <nav className="flex flex-wrap gap-2 mb-3" aria-label="Filter by status">
        <FilterPill href={hrefWith(current, { status: undefined })} active={!status} label="All" />
        {STATUSES.map((s) => (
          <FilterPill key={s} href={hrefWith(current, { status: s })} active={status === s} label={STATUS_LABELS[s]} />
        ))}
      </nav>

      <nav className="flex flex-wrap gap-2 mb-6" aria-label="Filter by sector">
        <FilterPill href={hrefWith(current, { sector: undefined })} active={!sector} label="All sectors" />
        {SECTOR_FILTERS.map((s) => (
          <FilterPill key={s} href={hrefWith(current, { sector: s })} active={sector === s} label={s} dot={SECTOR_COLORS[s]} />
        ))}
      </nav>

      {targets.length === 0 ? (
        <p className="text-sm py-12 text-center" style={{ color: "var(--text-muted)" }}>
          No targets match this filter yet.
        </p>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-left"
                style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--gridline)" }}
              >
                <Th>Company</Th>
                <Th>Location</Th>
                <Th>Sector</Th>
                <Th>Stage</Th>
                <Th>Round</Th>
                <Th>Investors</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => (
                <TargetRow key={t.id} target={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

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

function FilterPill({ href, active, label, dot }: { href: string; active: boolean; label: string; dot?: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs capitalize transition-colors"
      style={{
        background: active ? "var(--text-primary)" : "var(--surface-1)",
        color: active ? "var(--page-plane)" : "var(--text-secondary)",
        border: "1px solid var(--border)",
      }}
    >
      {dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} />}
      {label}
    </a>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 font-medium text-xs">{children}</th>;
}

function TargetRow({ target }: { target: Target }) {
  return (
    <tr style={{ borderBottom: "1px solid var(--gridline)" }}>
      <td className="px-4 py-3 align-top">
        <div className="font-medium" style={{ color: "var(--text-primary)" }}>
          {target.source_url ? (
            <a href={target.source_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {target.company_name}
            </a>
          ) : (
            target.company_name
          )}
        </div>
        {target.summary && (
          <div className="text-xs mt-0.5 max-w-xs" style={{ color: "var(--text-muted)" }}>
            {target.summary}
          </div>
        )}
      </td>
      <td className="px-4 py-3 align-top text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
        {target.location ?? "—"}
      </td>
      <td className="px-4 py-3 align-top">
        {target.sector && (
          <span className="inline-flex items-center gap-1.5 text-xs capitalize" style={{ color: "var(--text-secondary)" }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SECTOR_COLORS[target.sector] ?? "var(--text-muted)" }} />
            {target.sector}
          </span>
        )}
      </td>
      <td className="px-4 py-3 align-top text-xs" style={{ color: "var(--text-secondary)" }}>
        {target.stage ? STAGE_LABELS[target.stage] ?? target.stage : "—"}
      </td>
      <td className="px-4 py-3 align-top text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
        <div>{formatMoney(target.round_size_usd)}</div>
        <div style={{ color: "var(--text-muted)" }}>{formatDate(target.round_date)}</div>
      </td>
      <td className="px-4 py-3 align-top text-xs max-w-[16rem]" style={{ color: "var(--text-secondary)" }}>
        {target.investors.join(", ") || "—"}
      </td>
      <td className="px-4 py-3 align-top">
        <span
          className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2 py-0.5"
          style={{ color: STATUS_COLORS[target.status], background: "var(--surface-1)", border: "1px solid var(--border)" }}
        >
          {STATUS_LABELS[target.status]}
        </span>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-wrap gap-1.5">
          {target.status !== "contacted" && (
            <ActionButton action={setTargetStatus.bind(null, target.id, "contacted")} label="Mark contacted" />
          )}
          {target.status !== "dismissed" && (
            <ActionButton action={setTargetStatus.bind(null, target.id, "dismissed")} label="Dismiss" />
          )}
          {target.status !== "new" && <ActionButton action={setTargetStatus.bind(null, target.id, "new")} label="Reopen" />}
        </div>
      </td>
    </tr>
  );
}

function ActionButton({ action, label }: { action: () => Promise<void>; label: string }) {
  return (
    <form action={action}>
      <button
        type="submit"
        className="text-xs rounded px-2 py-1 hover:opacity-80 transition-opacity"
        style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
      >
        {label}
      </button>
    </form>
  );
}
