"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import {
  WORKSPACE_NAV_ITEMS,
  type WorkspaceNavLabel,
} from "@/app/components/workspace-navigation-items";

export type WorkspaceNavigationProps = Readonly<{
  current?: WorkspaceNavLabel;
}>;

/** Plain-language officer navigation with a compact mobile menu. */
export function WorkspaceNavigation({ current }: WorkspaceNavigationProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="workspace-navigation-root" ref={rootRef}>
      {open ? (
        <button
          aria-label="Dismiss navigation menu"
          className="workspace-navigation-scrim"
          onClick={() => setOpen(false)}
          type="button"
        />
      ) : null}
      <button
        aria-controls={panelId}
        aria-expanded={open}
        className="workspace-navigation-toggle"
        onClick={() => setOpen((value) => !value)}
        ref={toggleRef}
        type="button"
      >
        {open ? "Close menu" : "Menu"}
      </button>
      <nav
        aria-label="Workspace"
        className={
          open ? "workspace-navigation is-open" : "workspace-navigation"
        }
        id={panelId}
      >
        {WORKSPACE_NAV_ITEMS.map(([label, href]) => (
          <Link
            aria-current={current === label ? "page" : undefined}
            href={href}
            key={href}
            onClick={() => setOpen(false)}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
