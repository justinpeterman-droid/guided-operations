"use client";

import { useEffect } from "react";

const LEAVE_MESSAGE =
  "You have unsaved entries. Leave this page and discard them?";

type HistoryNavigationEvent = Event & {
  navigationType: string;
  destination: { url: string; sameDocument: boolean };
};

/** Protects supported exits without storing private form data or rewriting history. */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    function traverseHistory(event: Event) {
      const navigation = event as HistoryNavigationEvent;
      // Browsers can decline cancellation (including repeated Back attempts).
      // Cross-document exits already use beforeunload.
      if (
        event.defaultPrevented ||
        !event.cancelable ||
        navigation.navigationType !== "traverse" ||
        !navigation.destination.sameDocument
      )
        return;
      const destination = new URL(navigation.destination.url);
      if (
        destination.pathname === location.pathname &&
        destination.search === location.search
      )
        return;
      if (!window.confirm(LEAVE_MESSAGE)) event.preventDefault();
    }
    function followLink(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.hasAttribute("download") ||
        (link.target && link.target !== "_self")
      )
        return;
      const destination = new URL(link.href, window.location.href);
      if (!["http:", "https:"].includes(destination.protocol)) return;
      if (
        destination.origin === location.origin &&
        destination.pathname === location.pathname &&
        destination.search === location.search
      )
        return;
      if (!window.confirm(LEAVE_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", followLink, true);
    const navigation = (window as Window & { navigation?: EventTarget })
      .navigation;
    navigation?.addEventListener("navigate", traverseHistory);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", followLink, true);
      navigation?.removeEventListener("navigate", traverseHistory);
    };
  }, [dirty]);
}
