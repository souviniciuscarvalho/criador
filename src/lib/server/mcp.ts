import { FORMATS, uid, type Project, type Reference, type Slide } from "@/lib/types";
import { listRows, upsertRows } from "./db";

type Json = Record<string, unknown>;

const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const color = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d);

export const TOOLS = [
  {
    name: "listar_referencias",
    description: "Lista as referências cadastradas no Criador (nome, nicho, tipo e estudo). Use antes de escrever um conteúdo para se basear nelas.",
    inputSchema: { type: "object", properties: { nicho: { type: "string", description: "Filtra por nicho (opcional)" } } },
  },
  {
    name: "ler_referencia",
    description: "Mostra uma referência completa: texto/legenda, imagens (quantidade) e estudo atual.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "salvar_estudo",
    description: "Salva o estudo de uma referência: o que ela faz bem (gancho, estrutura, tom, CTA). Substitui o estudo básico do app.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" }, resumo: { type: "string" }, tags: { type: "array", items: { type: "string" } } },
      required: ["id", "resumo"],
    },
  },
  {
    name: "criar_conteudo",
    description: "Cria um conteúdo no Criador (feed, story ou carrossel). Cada slide tem título e texto; cores são opcionais (#rrggbb). O conteúdo aparece na aba Criar em alguns segundos.",
    inputSchema: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        formato: { type: "string", enum: ["feed", "story", "carrossel", "quadrado"] },
        referencias: { type: "array", items: { type: "string" }, description: "ids das referências usadas" },
        slides: {
          type: "array",
          items: {
            type: "object",
            properties: {
              titulo: { type: "string" },
              texto: { type: "string" },
              fundo: { type: "string" },
              cor_texto: { type: "string" },
              destaque: { type: "string" },
              alinhamento: { type: "string", enum: ["left", "center"] },
            },
            required: ["titulo"],
          },
        },
      },
      required: ["titulo", "formato", "slides"],
    },
  },
  {
    name: "listar_conteudos",
    description: "Lista os conteúdos criados por você no Criador.",
    inputSchema: { type: "object", properties: {} },
  },
];

const text = (t: string) => ({ content: [{ type: "text", text: t }] });

export async function callTool(ws: string, name: string, args: Json) {
  if (name === "listar_referencias") {
    let refs = await listRows<Reference>("criador_references", ws);
    const n = str(args.nicho).toLowerCase();
    if (n) refs = refs.filter((r) => r.niche.toLowerCase() === n);
    if (!refs.length) return text("Nenhuma referência cadastrada ainda.");
    return text(
      refs.map((r) => `- ${r.id} · ${r.name} [${r.kind}${r.niche ? ", " + r.niche : ""}] · estudo: ${r.study?.source ?? "nenhum"}${r.study ? " — " + r.study.summary : ""}`).join("\n"),
    );
  }
  if (name === "ler_referencia") {
    const r = (await listRows<Reference>("criador_references", ws)).find((x) => x.id === str(args.id));
    if (!r) return { ...text("Referência não encontrada."), isError: true };
    return text(JSON.stringify({ ...r, images: `${r.images.length} imagem(ns)` }, null, 2));
  }
  if (name === "salvar_estudo") {
    const r = (await listRows<Reference>("criador_references", ws)).find((x) => x.id === str(args.id));
    if (!r) return { ...text("Referência não encontrada."), isError: true };
    const tags = Array.isArray(args.tags) ? args.tags.filter((t): t is string => typeof t === "string").slice(0, 20) : [];
    r.study = { summary: str(args.resumo).slice(0, 2000), tags, source: "claude", at: Date.now() };
    await upsertRows("criador_references", ws, [r], { updated_at: new Date().toISOString() });
    return text(`Estudo de “${r.name}” salvo.`);
  }
  if (name === "criar_conteudo") {
    const fmt = FORMATS.find((f) => f.id === str(args.formato)) ?? FORMATS[3];
    const raw = Array.isArray(args.slides) ? (args.slides as Json[]) : [];
    if (!raw.length) return { ...text("Envie pelo menos um slide."), isError: true };
    const slides: Slide[] = raw.slice(0, fmt.multi ? 20 : 1).map((s) => ({
      id: uid(),
      title: str(s.titulo).slice(0, 200),
      body: str(s.texto).slice(0, 800),
      bg: color(s.fundo, "#111827"),
      fg: color(s.cor_texto, "#f9fafb"),
      accent: color(s.destaque, "#a78bfa"),
      align: s.alinhamento === "center" ? "center" : "left",
      titleSize: 84,
      bodySize: 44,
    }));
    const p: Project = {
      id: uid(),
      title: str(args.titulo, "Novo conteúdo").slice(0, 120),
      format: fmt.id,
      width: fmt.width,
      height: fmt.height,
      slides,
      referenceIds: Array.isArray(args.referencias) ? args.referencias.filter((x): x is string => typeof x === "string") : [],
      updatedAt: Date.now(),
    };
    await upsertRows("criador_contents", ws, [p], { source: "claude" });
    return text(`Conteúdo “${p.title}” criado (${slides.length} slide(s)). Ele aparece na aba Criar do Criador.`);
  }
  if (name === "listar_conteudos") {
    const c = await listRows<Project>("criador_contents", ws);
    return text(c.length ? c.map((p) => `- ${p.id} · ${p.title} [${p.format}, ${p.slides.length} slide(s)]`).join("\n") : "Nenhum conteúdo ainda.");
  }
  return { ...text(`Ferramenta desconhecida: ${name}`), isError: true };
}
