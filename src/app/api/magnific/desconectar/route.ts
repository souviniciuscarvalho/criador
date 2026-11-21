import { NextResponse } from "next/server";
import { dbConfigured, kvDelete, validToken, workspaceOf } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!validToken(token) || !dbConfigured()) return NextResponse.json({ error: "pedido inválido" }, { status: 400 });
  await kvDelete(workspaceOf(token), "mg:tok").catch(() => {});
  return NextResponse.json({ ok: true });
}
