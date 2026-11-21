import { NextResponse } from "next/server";
import { dbConfigured, deleteMissing, listRows, upsertRows, validToken, wasUsed, workspaceOf } from "@/lib/server/db";
import type { Project, Reference } from "@/lib/types";

export const dynamic = "force-dynamic";

// O app envia as referências e recebe de volta: referências (com estudos do Claude),
// conteúdos criados pelo Claude e se o link já foi usado.
export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!validToken(token)) return NextResponse.json({ error: "link inválido" }, { status: 401 });
  if (!dbConfigured()) return NextResponse.json({ configured: false }, { status: 503 });
  try {
    const ws = workspaceOf(token);
    const body = (await req.json()) as { references?: Reference[] };
    const incoming = Array.isArray(body.references) ? body.references.filter((r) => r && typeof r.id === "string") : [];
    const server = await listRows<Reference>("criador_references", ws);
    const byId = new Map(server.map((r) => [r.id, r]));
    // estudo do Claude no servidor vence o estudo local do app
    const merged = incoming.map((r) => {
      const s = byId.get(r.id)?.study;
      return s?.source === "claude" && r.study?.source !== "claude" ? { ...r, study: s } : r;
    });
    await upsertRows("criador_references", ws, merged, { updated_at: new Date().toISOString() });
    await deleteMissing("criador_references", ws, merged.map((r) => r.id));
    const [contents, used] = await Promise.all([listRows<Project>("criador_contents", ws), wasUsed(ws)]);
    return NextResponse.json({ configured: true, used, studies: merged.filter((r) => r.study?.source === "claude").map((r) => ({ id: r.id, study: r.study })), contents });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
