import { NextResponse } from "next/server";
import { dbConfigured, imgDelete, imgGet, validToken, workspaceOf } from "@/lib/server/db";

export const dynamic = "force-dynamic";

function parse(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const u = new URL(req.url);
  const c = u.searchParams.get("c") ?? "";
  const s = u.searchParams.get("s") ?? "";
  if (!validToken(token) || !/^[a-z0-9]{4,40}$/.test(c) || !/^[a-z0-9]{4,40}$/.test(s)) return null;
  return { ws: workspaceOf(token), c, s };
}

export async function GET(req: Request) {
  const p = parse(req);
  if (!p || !dbConfigured()) return NextResponse.json({ error: "pedido inválido" }, { status: 400 });
  const image = await imgGet(p.ws, p.c, p.s).catch(() => null);
  return image ? NextResponse.json({ image }) : NextResponse.json({ error: "sem imagem" }, { status: 404 });
}

export async function DELETE(req: Request) {
  const p = parse(req);
  if (!p || !dbConfigured()) return NextResponse.json({ error: "pedido inválido" }, { status: 400 });
  await imgDelete(p.ws, p.c, p.s).catch(() => {});
  return NextResponse.json({ ok: true });
}
