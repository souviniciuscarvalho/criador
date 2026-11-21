import { NextResponse } from "next/server";
import { dbConfigured, deleteContents, deleteMissing, imgIds, kvGet, kvList, listRows, listStyles, upsertRows, validToken, wasUsed, workspaceOf } from "@/lib/server/db";
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
    const body = (await req.json()) as { references?: Reference[]; projects?: Project[]; deleted?: string[] };
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
    // conteúdos: vence a versão mais recente (updatedAt); exclusões vão por lista
    if (Array.isArray(body.deleted)) await deleteContents(ws, body.deleted.filter((x): x is string => typeof x === "string"));
    const current = new Map((await listRows<Project>("criador_contents", ws)).map((p) => [p.id, p]));
    const sendProjects = (Array.isArray(body.projects) ? body.projects : []).filter(
      (p) => p && typeof p.id === "string" && /^[a-z0-9]{4,40}$/.test(p.id) && Array.isArray(p.slides) && !(body.deleted ?? []).includes(p.id),
    );
    const newer = sendProjects.filter((p) => !current.has(p.id) || (p.updatedAt ?? 0) > (current.get(p.id)!.updatedAt ?? 0));
    await upsertRows("criador_contents", ws, newer, { source: "app" });
    const [contents, used, styles] = await Promise.all([listRows<Project>("criador_contents", ws), wasUsed(ws), listStyles(ws)]);
    const [kv, ids] = await Promise.all([kvList(ws, "key:").then(async (k) => [k, await kvList(ws, "status:")] as const), imgIds(ws)]);
    const imagens = {
      keys: { openai: kv[0].some((x) => x.k === "key:openai"), gemini: kv[0].some((x) => x.k === "key:gemini"), iagen: kv[0].some((x) => x.k === "key:iagen"), magnific: !!(await kvGet(ws, "mg:tok")) },
      tools: Object.fromEntries((await kvList(ws, "tools:")).map((x) => [x.k.slice(6), JSON.parse(x.v)])),
      errors: Object.fromEntries((await kvList(ws, "err:")).map((x) => [x.k.slice(4), x.v])),
      status: Object.fromEntries(kv[1].map((x) => [x.k.slice(7), JSON.parse(x.v)])),
      ready: ids.map((x) => [x.content_id, x.slide_id]),
    };
    return NextResponse.json({ configured: true, imagens, used, studies: merged.filter((r) => r.study?.source === "claude").map((r) => ({ id: r.id, study: r.study })), contents, styles });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
