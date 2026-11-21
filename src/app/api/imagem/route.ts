import { makeImage } from "@/lib/server/imagegen";

// Gera uma imagem com a chave enviada pelo navegador (não é gravada).
export const maxDuration = 60;

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { provider?: string; key?: string; model?: string; quality?: string; prompt?: string; width?: number; height?: number };
  const prompt = (b.prompt ?? "").trim().slice(0, 3000);
  const key = (b.key ?? "").trim();
  if (!prompt) return Response.json({ error: "Escreva a descrição da imagem." }, { status: 400 });
  if (!key) return Response.json({ error: "Falta a chave. Salve em Conexões → Imagens." }, { status: 400 });
  try {
    const image = await makeImage({ provider: b.provider ?? "", key, model: b.model, quality: b.quality, prompt, width: b.width ?? 1080, height: b.height ?? 1350 });
    return Response.json({ image });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
