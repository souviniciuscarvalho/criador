import { NextResponse } from "next/server";
import { dbConfigured, validToken, workspaceOf } from "@/lib/server/db";
import { startAuth } from "@/lib/server/magnific";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!validToken(token)) return NextResponse.json({ error: "Ligue o Claude primeiro (aba Claude) para ter o seu link." }, { status: 401 });
  if (!dbConfigured()) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });
  try {
    return NextResponse.json({ url: await startAuth(workspaceOf(token), new URL(req.url).origin) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
