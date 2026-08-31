"use client";

import Link from "next/link";

/**
 * A non-shield brand mark for the officer workspace. The linked circles echo
 * the review path without implying an agency insignia.
 */
export function GuidedMark() {
  return (
    <svg
      aria-hidden="true"
      className="workspace-guided-mark"
      fill="none"
      viewBox="0 0 52 52"
    >
      <path d="M12 34c0-12.2 9.8-22 22-22h6" />
      <path d="M40 12 34 6m6 6-6 6" />
      <path d="M40 18c0 12.2-9.8 22-22 22h-6" />
      <circle cx="14" cy="34" r="4" />
      <circle cx="38" cy="18" r="4" />
    </svg>
  );
}

/** Shared officer brand link used across authenticated workspace pages. */
export function WorkspaceBrand({
  href = "/home",
  title,
}: Readonly<{ href?: string; title: string }>) {
  return (
    <Link className="workspace-brand workspace-brand-guided" href={href}>
      <GuidedMark />
      <span>
        <span className="eyebrow">Guided Operations</span>
        <strong>{title}</strong>
      </span>
    </Link>
  );
}
