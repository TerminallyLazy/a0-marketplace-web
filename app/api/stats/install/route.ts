import { NextRequest, NextResponse } from "next/server";

// In-memory fallback when Vercel KV is not configured
const memoryStore: Record<string, number> = {};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const pluginId = body.plugin_id;

  if (!pluginId || typeof pluginId !== "string") {
    return NextResponse.json(
      { error: "Missing plugin_id" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    if (process.env.KV_REST_API_URL) {
      const { kv } = await import("@vercel/kv");
      await kv.hincrby("plugin_installs", pluginId, 1);
      return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
    }
  } catch {
    // Fall through to memory store
  }

  // Fallback
  memoryStore[pluginId] = (memoryStore[pluginId] || 0) + 1;
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
