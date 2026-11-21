// Baixa um quadro do Figma como imagem, com o token do próprio usuário (não é gravado).
export const maxDuration = 60;

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { token?: string; url?: string };
  const token = (b.token ?? "").trim();
  if (!token) return Response.json({ error: "Falta o token do Figma. Salve em Conexões → Integrações." }, { status: 400 });
  let u: URL;
  try { u = new URL((b.url ?? "").trim()); } catch { return Response.json({ error: "Cole o link do quadro do Figma." }, { status: 400 }); }
  if (!/(^|\.)figma\.com$/.test(u.hostname)) return Response.json({ error: "O link precisa ser do figma.com." }, { status: 400 });
  const key = u.pathname.match(/\/(?:design|file|proto)\/([A-Za-z0-9]+)/)?.[1];
  const node = u.searchParams.get("node-id")?.replace("-", ":");
  if (!key) return Response.json({ error: "Não achei o arquivo nesse link." }, { status: 400 });
  if (!node) return Response.json({ error: "No Figma, clique com o botão direito no quadro → Copy link to selection e cole aqui." }, { status: 400 });
  try {
    const r = await fetch(`https://api.figma.com/v1/images/${key}?ids=${encodeURIComponent(node)}&format=jpg&scale=1`, { headers: { "X-Figma-Token": token } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return Response.json({ error: r.status === 403 ? "O Figma recusou o token." : (j?.err ?? `Figma respondeu ${r.status}`) }, { status: 502 });
    const img = Object.values((j?.images ?? {}) as Record<string, string | null>)[0];
    if (!img) return Response.json({ error: "O Figma não devolveu imagem desse quadro." }, { status: 502 });
    const f = await fetch(img);
    if (!f.ok) return Response.json({ error: "Não consegui baixar a imagem do Figma." }, { status: 502 });
    const buf = Buffer.from(await f.arrayBuffer());
    return Response.json({ image: `data:image/jpeg;base64,${buf.toString("base64")}` });
  } catch {
    return Response.json({ error: "Não consegui falar com o Figma." }, { status: 502 });
  }
}
