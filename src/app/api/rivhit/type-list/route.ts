import { NextResponse } from "next/server";
import { getVaultToken } from "@/lib/supabase/rivhit-vault";

export async function GET() {
  const token = await getVaultToken();
  if (!token) {
    return NextResponse.json(
      { error: "טוקן Rivhit לא מוגדר — עבור להגדרות" },
      { status: 401 },
    );
  }

  try {
    const res = await fetch(
      "https://api.rivhit.co.il/online/RivhitOnlineAPI.svc/Document.TypeList",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_token: token }),
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
