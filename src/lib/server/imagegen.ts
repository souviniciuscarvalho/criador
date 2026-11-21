import { getStyle, imgIds, imgPut, kvGet, kvSet, listRows } from "./db";
import { unseal } from "./crypto";
import type { Project } from "../types";

export type ImgReq = { provider: string; key: string; model?: string; quality?: string; prompt: string; width: number; height: number };

function ratio(w: number, h: number) {
  const r = w / h;
  const opts: [string, number][] = [["1:1", 1], ["4:5", 0.8], ["9:16", 0.5625], ["16:9", 1.7778], ["3:4", 0.75]];
  return opts.sort((a, b) => Math.abs(a[1] - r) - Math.abs(b[1] - r))[0][0];
}

// Chama o provedor e devolve uma data URL. Lança Error com mensagem em português.
export async function makeImage(b: ImgReq): Promise<string> {
  if (b.provider === "openai") {
    const size = b.width === b.height ? "1024x1024" : b.height > b.width ? "1024x1536" : "1536x1024";
    const call = (extra: object) =>
      fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${b.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: b.model || "gpt-image-1", prompt: b.prompt, size, quality: b.quality || "medium", n: 1, ...extra }),
      });
    let r = await call({ output_format: "jpeg", output_compression: 80 });
    if (r.status === 400) r = await call({});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error?.message ?? `OpenAI respondeu ${r.status}`);
    const d = j?.data?.[0];
    if (d?.b64_json) return `data:image/${d.b64_json.startsWith("/9j") ? "jpeg" : "png"};base64,${d.b64_json}`;
    if (d?.url) return d.url;
    throw new Error("A OpenAI não devolveu imagem.");
  }
  if (b.provider === "gemini") {
    const model = encodeURIComponent(b.model || "gemini-2.5-flash-image");
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": b.key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: b.prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: ratio(b.width, b.height) } },
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error?.message ?? `Gemini respondeu ${r.status}`);
    const parts = (j?.candidates?.[0]?.content?.parts ?? []) as { inlineData?: { mimeType?: string; data?: string } }[];
    const p = parts.find((x) => x.inlineData?.data);
    if (p?.inlineData) return `data:${p.inlineData.mimeType ?? "image/png"};base64,${p.inlineData.data}`;
    throw new Error("O Gemini não devolveu imagem (a descrição pode ter sido recusada).");
  }
  throw new Error("Escolha OpenAI ou Gemini.");
}

type Cfg = { imageDefault?: string; geminiModel?: string; openaiModel?: string; openaiQuality?: string };
export type ImgStatus = { state: "gerando" | "pronto" | "erro"; done: number; total: number; error?: string; at: number };

async function setStatus(ws: string, cid: string, s: ImgStatus) {
  await kvSet(ws, `status:${cid}`, JSON.stringify(s));
}

// Prepara a geração das imagens de um conteúdo (uma por lâmina sem imagem).
export async function prepare(ws: string, cid: string): Promise<{ ok: true; run: () => Promise<void> } | { ok: false; error: string }> {
  const cfg = JSON.parse((await kvGet(ws, "cfg")) ?? "{}") as Cfg;
  const has = async (p: string) => !!(await kvGet(ws, `key:${p}`));
  const provider = cfg.imageDefault === "openai" || cfg.imageDefault === "gemini"
    ? ((await has(cfg.imageDefault)) ? cfg.imageDefault : "")
    : "";
  const chosen = provider || ((await has("gemini")) ? "gemini" : (await has("openai")) ? "openai" : "");
  if (!chosen) return { ok: false, error: "Nenhuma chave de imagem guardada. Salve a da OpenAI ou do Gemini em Conexões → Imagens." };
  const key = unseal((await kvGet(ws, `key:${chosen}`)) ?? "");
  if (!key) return { ok: false, error: "Não consegui ler a chave guardada. Salve-a de novo em Conexões → Imagens." };
  const p = (await listRows<Project>("criador_contents", ws)).find((x) => x.id === cid);
  if (!p) return { ok: false, error: "Conteúdo não encontrado." };
  const prev = JSON.parse((await kvGet(ws, `status:${cid}`)) ?? "null") as ImgStatus | null;
  if (prev?.state === "gerando" && Date.now() - prev.at < 6 * 60_000) return { ok: false, error: "As imagens já estão sendo geradas." };
  const have = new Set((await imgIds(ws)).filter((x) => x.content_id === cid).map((x) => x.slide_id));
  const todo = p.slides.filter((s) => !have.has(s.id));
  await setStatus(ws, cid, { state: "gerando", done: 0, total: todo.length, at: Date.now() });
  const run = async () => {
    const style = p.styleId ? await getStyle(ws, p.styleId) : null;
    const guide = style && typeof style.guide === "string" ? style.guide.slice(0, 500) : "";
    const pal = style && Array.isArray(style.palette) ? (style.palette as string[]).slice(0, 5).join(", ") : "";
    let done = 0;
    let error = "";
    for (let i = 0; i < todo.length; i += 3) {
      await Promise.all(
        todo.slice(i, i + 3).map(async (s) => {
          const idea = s.imageIdea?.trim() || `${s.title}. ${s.body}`.slice(0, 400);
          const prompt = `${idea}. Imagem de fundo para post de rede social, sem texto escrito, sem letras.${guide ? ` Estilo visual da marca: ${guide}` : ""}${pal ? ` Cores: ${pal}.` : ""}`;
          try {
            const img = await makeImage({ provider: chosen, key, model: chosen === "gemini" ? cfg.geminiModel : cfg.openaiModel, quality: cfg.openaiQuality, prompt, width: p.width, height: p.height });
            if (img.startsWith("data:")) await imgPut(ws, cid, s.id, img);
            else error = error || "A imagem veio como link, não consegui guardar.";
            if (img.startsWith("data:")) done++;
          } catch (e) {
            error = error || (e as Error).message;
          }
        }),
      );
      await setStatus(ws, cid, { state: "gerando", done, total: todo.length, at: Date.now() });
    }
    await setStatus(ws, cid, { state: error ? "erro" : "pronto", done, total: todo.length, error: error || undefined, at: Date.now() });
  };
  return { ok: true, run };
}
