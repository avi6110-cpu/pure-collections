import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const token =
    request.headers.get("X-Rivhit-Token") ??
    process.env.RIVHIT_API_TOKEN;

  if (!token) {
    return NextResponse.json(
      { error: "No API token provided" },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(
      "https://api.rivhit.co.il/online/RivhitOnlineAPI.svc/Document.List",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, api_token: token }),
      },
    );
    const data: unknown = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to reach Rivhit API" },
      { status: 502 },
    );
  }
}
