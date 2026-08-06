"use client";

import { setTargetRead } from "./actions";

// The rest of the dashboard is a plain server-rendered page (see page.tsx) —
// this is the one interaction that genuinely needs client JS: clicking
// through to the source article should also mark the target read, and a
// bare <a> has no way to trigger a server mutation on its own. target="_blank"
// means the click's default navigation (opening the new tab) isn't blocked
// by firing the action alongside it.
export function CompanyLink({ id, href, isRead, children }: { id: string; href: string; isRead: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:underline transition-colors"
      style={{ textDecorationColor: "var(--accent)" }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "")}
      onClick={() => {
        if (!isRead) setTargetRead(id, true);
      }}
    >
      {children}
    </a>
  );
}
