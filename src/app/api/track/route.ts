import { NextResponse } from "next/server";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOCIAL_HOSTS: Record<string, string> = {
  "instagram.com": "instagram",
  "www.instagram.com": "instagram",
  "l.instagram.com": "instagram",
  "facebook.com": "facebook",
  "www.facebook.com": "facebook",
  "m.facebook.com": "facebook",
  "l.facebook.com": "facebook",
  "lm.facebook.com": "facebook",
  "tiktok.com": "tiktok",
  "www.tiktok.com": "tiktok",
  "vm.tiktok.com": "tiktok",
  "twitter.com": "twitter",
  "x.com": "twitter",
  "t.co": "twitter",
  "youtube.com": "youtube",
  "www.youtube.com": "youtube",
  "youtu.be": "youtube",
  "pinterest.com": "pinterest",
  "www.pinterest.com": "pinterest",
};

function classifyReferrer(referrer: string | null): {
  host: string | null;
  social: string | null;
} {
  if (!referrer) return { host: null, social: null };
  try {
    const u = new URL(referrer);
    const host = u.hostname.toLowerCase();
    return { host, social: SOCIAL_HOSTS[host] ?? null };
  } catch {
    return { host: null, social: null };
  }
}

type UtmIn = {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  term?: string | null;
};

export async function POST(request: Request) {
  let body: {
    referrer?: string;
    path?: string;
    sessionId?: string;
    utm?: UtmIn;
  } = {};
  try {
    body = await request.json();
  } catch {
    // ignore — beacon may send empty body
  }

  const headers = request.headers;
  const country =
    headers.get("x-vercel-ip-country") ||
    headers.get("cf-ipcountry") ||
    null;
  const region = headers.get("x-vercel-ip-country-region") || null;
  const city = (() => {
    const raw = headers.get("x-vercel-ip-city");
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();

  const referrer = body.referrer ?? headers.get("referer") ?? null;
  const { host, social } = classifyReferrer(referrer);

  const utm = body.utm ?? {};
  const cleanUtm = {
    source: typeof utm.source === "string" ? utm.source.slice(0, 80) : null,
    medium: typeof utm.medium === "string" ? utm.medium.slice(0, 80) : null,
    campaign:
      typeof utm.campaign === "string" ? utm.campaign.slice(0, 120) : null,
    content:
      typeof utm.content === "string" ? utm.content.slice(0, 120) : null,
    term: typeof utm.term === "string" ? utm.term.slice(0, 120) : null,
  };

  try {
    await addDoc(collection(db, "sessions"), {
      sessionId: body.sessionId ?? null,
      path: body.path ?? null,
      referrer: referrer ?? null,
      referrerHost: host,
      socialReferrer: social,
      country,
      region,
      city,
      utm: cleanUtm,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Track error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
