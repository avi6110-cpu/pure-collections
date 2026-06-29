import { NextRequest, NextResponse } from "next/server";
import { getVaultToken } from "@/lib/supabase/rivhit-vault";

// force_copy is always false — server-enforced, cannot be overridden by client.
// This requests an existing copy link rather than forcing a new document to be created.

export async function POST(request: NextRequest) {
  const token = await getVaultToken();
  if (!token) {
    return NextResponse.json(
      { error: "טוקן Rivhit לא מוגדר — עבור להגדרות" },
      { status: 401 },
    );
  }

  let body: { document_type?: unknown; document_number?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { document_type, document_number } = body;

  if (typeof document_type !== "number" || typeof document_number !== "number") {
    return NextResponse.json(
      { error: "document_type and document_number must be numbers" },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(
      "https://api.rivhit.co.il/online/RivhitOnlineAPI.svc/Document.Copy",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_token: token,
          document_type,
          document_number,
          force_copy: false,
          language: "he",
        }),
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
