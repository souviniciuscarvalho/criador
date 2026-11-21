import { getStyle, imgIds, imgPut, kvGet, kvSet, listRows } from "./db";
import { unseal } from "./crypto";
import { generateViaMcp } from "./mcpclient";
import { MAGNIFIC_MCP, magnificToken } from "./magnific";
import type { Project } from "../types";

export const IAGEN_MCP = "https://k.iamaisgen.com/api/mcp";

// Credencial do provedor guardada no servidor (chave cifrada ou login do Magnific).
export async function credential(ws: string, provider: string): Promise<string | null> {
  if (provider === "magnific") return magnificToken(ws);
  const raw = await kvGet(ws, `key:${provider}`);
  return raw ? unseal(raw) : null;
}

export async function viaService(ws: string, provider: string, prompt: string, width: number, height: number): Promise<string> {
  const cred = await credential(ws, provider);
  if (!cred) throw new Error(provider === "magnific" ? "O Magnific não está conectado. Conecte em Conexões → Imagens." : "Chave do IA Gen não encontrada. Salve em Conexões → Imagens.");
  const g = await generateViaMcp(provider === "magnific" ? MAGNIFIC_MCP : IAGEN_MCP, cred, prompt, width, height);
  await kvSet(ws, `tools:${provider}`, JSON.stringify(g.tools)).catch(() => {});
  if (!g.image) {
    await kvSet(ws, `err:${provider}`, g.error ?? "falha").catch(() => {});
    throw new Error(g.error ?? "O serviço não devolveu imagem.");
  }
  return g.image;
}

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
  const has = async (p: string) => !!(await credential(ws, p).catch(() => null));
  const order = ["magnific", "iagen", "gemini", "openai"];
  const first = order.includes(cfg.imageDefault ?? "") ? [cfg.imageDefault!] : [];
  let chosen = "";
  for (const p of [...first, ...order]) if (await has(p)) { chosen = p; break; }
  if (!chosen) return { ok: false, error: "Nenhuma IA de imagem conectada. Conecte uma em Conexões → Imagens." };
  const key = (chosen === "gemini" || chosen === "openai") ? await credential(ws, chosen) : "service";
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
            const img = chosen === "gemini" || chosen === "openai"
              ? await makeImage({ provider: chosen, key, model: chosen === "gemini" ? cfg.geminiModel : cfg.openaiModel, quality: cfg.openaiQuality, prompt, width: p.width, height: p.height })
              : await viaService(ws, chosen, prompt, p.width, p.height);
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
