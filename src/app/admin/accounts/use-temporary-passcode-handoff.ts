"use client";

import { useEffect, useState } from "react";

type ExpiringHandoff = Readonly<{
  temporaryPasscodeExpiresAt: string;
}>;

export function useTemporaryPasscodeHandoff<T extends ExpiringHandoff>() {
  const [handoff, setHandoff] = useState<T | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!handoff) return;

    const remainingMs = Math.max(
      0,
      Date.parse(handoff.temporaryPasscodeExpiresAt) - Date.now(),
    );

    const timeout = window.setTimeout(() => {
      setHandoff(null);
      setExpired(true);
    }, remainingMs);
    return () => window.clearTimeout(timeout);
  }, [handoff]);

  function show(nextHandoff: T) {
    const remainingMs =
      Date.parse(nextHandoff.temporaryPasscodeExpiresAt) - Date.now();
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
      setHandoff(null);
      setExpired(true);
      return;
    }
    setExpired(false);
    setHandoff(nextHandoff);
  }

  function dismiss() {
    setHandoff(null);
  }

  return { handoff, expired, show, dismiss };
}
