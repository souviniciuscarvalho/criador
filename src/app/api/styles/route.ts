import { NextResponse } from "next/server";
import { dbConfigured, deleteStyle, getStyle, putStyle, replacePrints, validToken, workspaceOf } from "@/lib/server/db";

export const dynamic = "force-dynamic";

const auth = (req: Request) => {
  const t = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  return validToken(t) ? workspaceOf(t) : null;
};
const okId = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9]{4,40}$/.test(v);
const okPrint = (v: unknown): v is string => typeof v === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v) && v.length < 600_000;

// O app cria/atualiza estilos (nome, guia, prints). A análise (componentes etc.) vem do Claude via MCP.
export async function POST(req: Request) {
  const ws = auth(req);
  if (!ws) return NextResponse.json({ error: "link inválido" }, { status: 401 });
  if (!dbConfigured()) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });
  try {
    const b = (await req.json()) as { id?: unknown; name?: unknown; guide?: unknown; prints?: unknown };
    if (!okId(b.id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });
    const cur = (await getStyle(ws, b.id)) ?? { id: b.id, status: "novo", guide: "", fonts: { title: "", body: "" }, palette: [], components: [], recreated: [], rev: 0 };
    if (typeof b.name === "string") cur.name = b.name.slice(0, 80);
    if (typeof b.guide === "string") cur.guide = b.guide.slice(0, 20000);
    if (Array.isArray(b.prints)) {
      const prints = b.prints.filter(okPrint).slice(0, 8);
      await replacePrints(ws, b.id, prints);
      cur.printCount = prints.length;
    }
    cur.name ??= "Novo estilo";
    cur.printCount ??= 0;
    cur.rev = Date.now();
    await putStyle(ws, cur);
    return NextResponse.json({ ok: true, rev: cur.rev });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const ws = auth(req);
  const id = new URL(req.url).searchParams.get("id");
  if (!ws || !okId(id)) return NextResponse.json({ error: "pedido inválido" }, { status: 400 });
  if (!dbConfigured()) return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });
  try {
    await deleteStyle(ws, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
