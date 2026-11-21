import { NextResponse } from "next/server";
import { after } from "next/server";
import { dbConfigured, validToken, workspaceOf } from "@/lib/server/db";
import { prepare } from "@/lib/server/imagegen";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Gera, no servidor, as imagens das lâminas que ainda não têm uma.
export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!validToken(token)) return NextResponse.json({ error: "link inválido" }, { status: 401 });
  if (!dbConfigured()) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });
  const b = (await req.json().catch(() => ({}))) as { contentId?: string };
  if (typeof b.contentId !== "string" || !/^[a-z0-9]{4,40}$/.test(b.contentId)) return NextResponse.json({ error: "conteúdo inválido" }, { status: 400 });
  try {
    const r = await prepare(workspaceOf(token), b.contentId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    after(r.run);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
