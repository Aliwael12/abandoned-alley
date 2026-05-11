"use client";

import { useEffect } from "react";

const SESSION_KEY = "aa_session_v1";
const ATTR_KEY = "aa_attr_v1";
const SESSION_MAX_MS = 30 * 60 * 1000;

type UtmFields = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
};

type Attribution = {
  sessionId: string;
  referrer: string | null;
  utm: UtmFields;
  landing: string;
  firstSeenAt: number;
};

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function readUtmFromUrl(): UtmFields {
  const params = new URLSearchParams(window.location.search);
  const fbclid = params.get("fbclid");
  const gclid = params.get("gclid");
  const ttclid = params.get("ttclid");
  // Infer source from click IDs when explicit utm_source missing
  let inferredSource: string | null = null;
  if (fbclid) inferredSource = "facebook";
  else if (gclid) inferredSource = "google";
  else if (ttclid) inferredSource = "tiktok";
  return {
    source: params.get("utm_source") || inferredSource,
    medium: params.get("utm_medium") || (fbclid || ttclid ? "paid_social" : gclid ? "cpc" : null),
    campaign: params.get("utm_campaign"),
    content: params.get("utm_content"),
    term: params.get("utm_term"),
  };
}

function loadOrInitAttribution(): { attr: Attribution; isNew: boolean } {
  // Always check incoming URL for fresh UTMs — newer touch wins
  const urlUtm = readUtmFromUrl();
  const hasFreshUtm = Object.values(urlUtm).some((v) => v);

  let existing: Attribution | null = null;
  try {
    const raw = sessionStorage.getItem(ATTR_KEY);
    if (raw) existing = JSON.parse(raw) as Attribution;
  } catch {
    // ignore
  }

  const sessionStillValid = (() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { id: string; ts: number };
      return parsed?.id && Date.now() - parsed.ts < SESSION_MAX_MS;
    } catch {
      return false;
    }
  })();

  if (existing && sessionStillValid && !hasFreshUtm) {
    return { attr: existing, isNew: false };
  }

  const sessionId =
    sessionStillValid && existing
      ? existing.sessionId
      : makeId();

  const attr: Attribution = {
    sessionId,
    referrer: document.referrer || null,
    utm: hasFreshUtm ? urlUtm : existing?.utm ?? {
      source: null,
      medium: null,
      campaign: null,
      content: null,
      term: null,
    },
    landing: window.location.pathname + window.location.search,
    firstSeenAt: existing?.firstSeenAt ?? Date.now(),
  };

  try {
    sessionStorage.setItem(ATTR_KEY, JSON.stringify(attr));
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ id: sessionId, ts: Date.now() })
    );
  } catch {
    // ignore
  }

  return { attr, isNew: !sessionStillValid || hasFreshUtm };
}

export default function SessionTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname.startsWith("/admin")) return;

    const { attr, isNew } = loadOrInitAttribution();
    if (!isNew) return;

    const payload = JSON.stringify({
      sessionId: attr.sessionId,
      referrer: attr.referrer,
      path: window.location.pathname,
      utm: attr.utm,
    });

    try {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon && navigator.sendBeacon("/api/track", blob)) {
        return;
      }
    } catch {
      // fall through to fetch
    }

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // best-effort
    });
  }, []);

  return null;
}

export function getStoredAttribution(): {
  sessionId: string | null;
  utm: UtmFields;
  referrer: string | null;
} {
  if (typeof window === "undefined") {
    return {
      sessionId: null,
      utm: { source: null, medium: null, campaign: null, content: null, term: null },
      referrer: null,
    };
  }
  try {
    const raw = sessionStorage.getItem(ATTR_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Attribution;
      return {
        sessionId: parsed.sessionId ?? null,
        utm: parsed.utm,
        referrer: parsed.referrer,
      };
    }
  } catch {
    // ignore
  }
  return {
    sessionId: null,
    utm: { source: null, medium: null, campaign: null, content: null, term: null },
    referrer: null,
  };
}
