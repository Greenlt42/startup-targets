"use client";

import { useId, useState } from "react";

// The native <details>/<summary> + ::details-content animation only works in
// recent Chromium — Safari doesn't animate block-size to "auto" at all, so it
// was snapping open there instead of transitioning. grid-template-rows 0fr/1fr
// is the one CSS accordion trick that's been animatable everywhere for years.
export function Accordion({
  summary,
  children,
}: {
  // Plain JSX, not a render-prop function — functions can't cross the
  // server/client boundary as props, only already-rendered React nodes can.
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={contentId}
        className="w-full text-left cursor-pointer transition-colors hover:bg-[var(--surface-1)]"
      >
        {summary}
      </button>
      <div
        id={contentId}
        style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows 300ms ease" }}
      >
        <div style={{ overflow: "hidden", minHeight: 0 }}>{children}</div>
      </div>
    </div>
  );
}
