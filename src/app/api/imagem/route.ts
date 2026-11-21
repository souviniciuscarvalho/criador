// Gera uma imagem com a chave do próprio usuário. A chave só passa por aqui
// para chegar ao provedor: não é gravada nem registrada.
export const maxDuration = 60;

type Body = { provider?: string; key?: string; model?: string; quality?: string; prompt?: string; width?: number; height?: number };

function ratio(w: number, h: number) {
  const r = w / h;
  const opts: [string, number][] = [["1:1", 1], ["4:5", 0.8], ["9:16", 0.5625], ["16:9", 1.7778], ["3:4", 0.75]];
  return opts.sort((a, b) => Math.abs(a[1] - r) - Math.abs(b[1] - r))[0][0];
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Body;
  const prompt = (b.prompt ?? "").trim().slice(0, 3000);
  const key = (b.key ?? "").trim();
  const w = b.width ?? 1080;
  const h = b.height ?? 1350;
  if (!prompt) return Response.json({ error: "Escreva a descrição da imagem." }, { status: 400 });
  if (!key) return Response.json({ error: "Falta a chave. Salve em Conexões → Imagens." }, { status: 400 });
  try {
    if (b.provider === "openai") {
      const size = w === h ? "1024x1024" : h > w ? "1024x1536" : "1536x1024";
      const r = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: b.model || "gpt-image-1", prompt, size, quality: b.quality || "medium", n: 1 }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return Response.json({ error: j?.error?.message ?? `OpenAI respondeu ${r.status}` }, { status: 502 });
      const d = j?.data?.[0];
      if (d?.b64_json) return Response.json({ image: `data:image/png;base64,${d.b64_json}` });
      if (d?.url) return Response.json({ image: d.url });
      return Response.json({ error: "A OpenAI não devolveu imagem." }, { status: 502 });
    }
    if (b.provider === "gemini") {
      const model = encodeURIComponent(b.model || "gemini-2.5-flash-image");
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: ratio(w, h) } },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return Response.json({ error: j?.error?.message ?? `Gemini respondeu ${r.status}` }, { status: 502 });
      const parts = (j?.candidates?.[0]?.content?.parts ?? []) as { inlineData?: { mimeType?: string; data?: string } }[];
      const p = parts.find((x) => x.inlineData?.data);
      if (p?.inlineData) return Response.json({ image: `data:${p.inlineData.mimeType ?? "image/png"};base64,${p.inlineData.data}` });
      return Response.json({ error: "O Gemini não devolveu imagem (a descrição pode ter sido recusada)." }, { status: 502 });
    }
    return Response.json({ error: "Escolha OpenAI ou Gemini." }, { status: 400 });
  } catch {
    return Response.json({ error: "Não consegui falar com o provedor de imagem." }, { status: 502 });
  }
}
