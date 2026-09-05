"use client";

import { useRef } from "react";

/** Reuse an unchanged mutation after an unconfirmed response. Memory only. */
export function useIdempotentRequest() {
  const previous = useRef<{ body: string; key: string } | null>(null);
  return (body: string) => {
    if (previous.current?.body !== body)
      previous.current = {
        body,
        key: crypto.randomUUID().replaceAll("-", ""),
      };
    return previous.current;
  };
}
