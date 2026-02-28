import { NextRequest, NextResponse } from "next/server";

/**
 * Backend for Editor.js Link tool. Fetches a URL and returns Open Graph / meta for preview.
 * Link tool sends: GET/POST with url (query or body). Returns { success, meta: { title, description, image } }.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ success: 0 }, { status: 400 });
  }
  return fetchMeta(url);
}

export async function POST(request: NextRequest) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: 0 }, { status: 400 });
  }
  const url = body?.url;
  if (!url || typeof url !== "string") {
    return NextResponse.json({ success: 0 }, { status: 400 });
  }
  return fetchMeta(url);
}

function isAllowedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

async function fetchMeta(url: string) {
  if (!isAllowedUrl(url)) {
    return NextResponse.json({ success: 0 }, { status: 200 });
  }
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; EditorJS-Link/1.0; +https://editorjs.io)",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return NextResponse.json({ success: 0 }, { status: 200 });
    }
    const html = await res.text();
    const meta = extractMeta(html);
    return NextResponse.json({
      success: 1,
      link: url,
      meta,
    });
  } catch {
    return NextResponse.json({ success: 0 }, { status: 200 });
  }
}

function extractMeta(html: string): {
  title?: string;
  description?: string;
  image?: { url: string };
} {
  const meta: { title?: string; description?: string; image?: { url: string } } = {};
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);

  if (ogTitle?.[1]) meta.title = decodeEntities(ogTitle[1]);
  else if (titleTag?.[1]) meta.title = decodeEntities(titleTag[1]);

  if (ogDesc?.[1]) meta.description = decodeEntities(ogDesc[1]);
  if (ogImage?.[1]) meta.image = { url: ogImage[1].trim() };

  return meta;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
