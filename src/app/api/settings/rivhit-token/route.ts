import { NextRequest, NextResponse } from "next/server";
import { getVaultHint, saveVaultToken } from "@/lib/supabase/rivhit-vault";

// GET — returns the token hint for the current user's tenant.
// Returns { hint: string | null }. Never returns the real token.
export async function GET() {
  const result = await getVaultHint();

  if (!result) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  return NextResponse.json({ hint: result.hint });
}

// POST — saves a new Rivhit token to Vault.
// Body: { token: string }
// Returns { hint: string } on success. Never echoes the token back.
export async function POST(request: NextRequest) {
  let body: { token?: unknown };
  try {
    body = (await request.json()) as { token?: unknown };
  } catch {
    return NextResponse.json({ error: "גוף הבקשה שגוי" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "טוקן לא יכול להיות ריק" }, { status: 400 });
  }

  const hint = await saveVaultToken(token);
  if (!hint) {
    return NextResponse.json(
      { error: "שמירת הטוקן נכשלה — בדוק הרשאות" },
      { status: 500 },
    );
  }

  return NextResponse.json({ hint });
}
