import { NextResponse } from "next/server";
import { dbConfigured, kvDelete, kvSet, validToken, workspaceOf } from "@/lib/server/db";
import { seal } from "@/lib/server/crypto";

export const dynamic = "force-dynamic";

// Guarda (cifradas) as chaves de imagem do usuário para gerar as imagens no servidor.
export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!validToken(token)) return NextResponse.json({ error: "link inválido" }, { status: 401 });
  if (!dbConfigured()) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });
  const ws = workspaceOf(token);
  const b = (await req.json().catch(() => ({}))) as { keys?: Record<string, unknown>; cfg?: Record<string, unknown> };
  try {
    for (const p of ["openai", "gemini", "iagen"]) {
      const v = b.keys?.[p];
      if (typeof v !== "string") continue;
      if (v.trim()) await kvSet(ws, `key:${p}`, seal(v.trim().slice(0, 300)));
      else await kvDelete(ws, `key:${p}`);
    }
    if (b.cfg) {
      const s = (x: unknown) => (typeof x === "string" ? x.slice(0, 80) : "");
      await kvSet(ws, "cfg", JSON.stringify({ imageDefault: s(b.cfg.imageDefault), geminiModel: s(b.cfg.geminiModel), openaiModel: s(b.cfg.openaiModel), openaiQuality: s(b.cfg.openaiQuality) }));
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
