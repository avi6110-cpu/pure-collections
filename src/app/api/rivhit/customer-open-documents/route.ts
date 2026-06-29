import { NextRequest, NextResponse } from "next/server";
import { getVaultToken } from "@/lib/supabase/rivhit-vault";

export async function POST(request: NextRequest) {
  const token = await getVaultToken();
  if (!token) {
    return NextResponse.json(
      { error: "טוקן Rivhit לא מוגדר — עבור להגדרות" },
      { status: 401 },
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
      "https://api.rivhit.co.il/online/RivhitOnlineAPI.svc/Customer.OpenDocuments",
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
