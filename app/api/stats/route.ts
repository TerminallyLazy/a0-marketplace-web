import { NextResponse } from "next/server";

// In-memory fallback when Vercel KV is not configured
const memoryStore: Record<string, number> = {};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET() {
  try {
    // Try Vercel KV
    if (process.env.KV_REST_API_URL) {
      const { kv } = await import("@vercel/kv");
      const counts =
        (await kv.hgetall<Record<string, number>>("plugin_installs")) || {};
      return NextResponse.json({ counts }, { headers: CORS_HEADERS });
    }
  } catch {
    // Fall through to memory store
  }

  // Fallback to memory store
  return NextResponse.json({ counts: memoryStore }, { headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
