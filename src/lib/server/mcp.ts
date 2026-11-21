import { FORMATS, uid, type Project, type Reference, type Slide } from "@/lib/types";
import { getStyle, listPrints, listRows, listStyles, putStyle, upsertRows } from "./db";

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
    name: "listar_estilos",
    description: "Lista os estilos visuais cadastrados (cada um é uma pasta de prints de carrosséis) e se já foram analisados.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "instrucoes_estilo",
    description: "Instruções de como estudar os prints de um estilo e o que salvar. Chame ANTES de prints_do_estilo e salvar_estilo.",
    inputSchema: { type: "object", properties: { estilo_id: { type: "string" } }, required: ["estilo_id"] },
  },
  {
    name: "prints_do_estilo",
    description: "Devolve as imagens (prints) enviadas para o estilo, para você estudar o visual.",
    inputSchema: { type: "object", properties: { estilo_id: { type: "string" } }, required: ["estilo_id"] },
  },
  {
    name: "ler_estilo",
    description: "Mostra a análise já salva de um estilo: guia, fontes, paleta e componentes. Use ao criar conteúdo nesse estilo.",
    inputSchema: { type: "object", properties: { estilo_id: { type: "string" } }, required: ["estilo_id"] },
  },
  {
    name: "salvar_estilo",
    description:
      "Salva a análise do estilo: guia de regras, fontes, paleta, componentes (peças reutilizáveis) e recriações dos prints (um slide por print). Cores sempre em #rrggbb.",
    inputSchema: {
      type: "object",
      properties: {
        estilo_id: { type: "string" },
        guia: { type: "string", description: "Regras do estilo em texto corrido: fundo, título, tipografia, composição, elementos gráficos, o que evitar." },
        fonte_titulo: { type: "string" },
        fonte_corpo: { type: "string" },
        paleta: { type: "array", items: { type: "string" }, description: "3 a 6 cores #rrggbb" },
        componentes: {
          type: "array",
          description: "10 a 12 peças reutilizáveis do estilo (ex.: tira de título, selo, botão CTA, lista).",
          items: {
            type: "object",
            properties: {
              nome: { type: "string" },
              descricao: { type: "string", description: "Como a peça é montada e quando usar" },
              fundo: { type: "string" },
              cor_texto: { type: "string" },
              destaque: { type: "string" },
              exemplo: { type: "string", description: "Texto de exemplo curto" },
            },
            required: ["nome", "descricao"],
          },
        },
        recriados: {
          type: "array",
          description: "Uma recriação por print, no formato de slide",
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
      required: ["estilo_id", "guia"],
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
  if (name === "listar_estilos") {
    const st = await listStyles(ws);
    return text(st.length ? st.map((x) => `- ${x.id} · ${x.name} · ${x.printCount ?? 0} print(s) · ${x.status}`).join("\n") : "Nenhum estilo cadastrado ainda.");
  }
  if (name === "instrucoes_estilo") {
    const st = await getStyle(ws, str(args.estilo_id));
    if (!st) return { ...text("Estilo não encontrado."), isError: true };
    return text(
      `Estilo “${st.name}”. Passo a passo:\n` +
        "1. Chame prints_do_estilo e olhe cada print com atenção.\n" +
        "2. Descreva o visual: fundo (cor, foto, grão), tipografia (fontes, pesos, tamanhos, caixa alta), composição (alinhamento, hierarquia, margens), elementos gráficos (tiras, selos, rabiscos, setas, botões) e o tom.\n" +
        "3. Extraia 10 a 12 componentes reutilizáveis, cada um com nome, descrição de como montar e cores.\n" +
        "4. Faça uma recriação por print como slide (título, texto, fundo, cor_texto, destaque, alinhamento).\n" +
        "5. Chame salvar_estilo com guia, fonte_titulo, fonte_corpo, paleta (3 a 6 cores #rrggbb), componentes e recriados.\n" +
        "Escreva o guia como regras que outra IA possa seguir ao criar carrosséis neste estilo.",
    );
  }
  if (name === "prints_do_estilo") {
    const prints = await listPrints(ws, str(args.estilo_id));
    if (!prints.length) return { ...text("Este estilo não tem prints."), isError: true };
    return {
      content: prints.flatMap((p, i) => [
        { type: "text", text: `Print ${i + 1} de ${prints.length}` },
        { type: "image", data: p.replace(/^data:image\/jpeg;base64,/, ""), mimeType: "image/jpeg" },
      ]),
    };
  }
  if (name === "ler_estilo") {
    const st = await getStyle(ws, str(args.estilo_id));
    if (!st) return { ...text("Estilo não encontrado."), isError: true };
    return text(JSON.stringify(st, null, 2));
  }
  if (name === "salvar_estilo") {
    const st = await getStyle(ws, str(args.estilo_id));
    if (!st) return { ...text("Estilo não encontrado."), isError: true };
    const cores = (a: unknown) => (Array.isArray(a) ? a.filter((c): c is string => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c)).slice(0, 8) : []);
    st.guide = str(args.guia).slice(0, 20000);
    st.fonts = { title: str(args.fonte_titulo).slice(0, 60), body: str(args.fonte_corpo).slice(0, 60) };
    st.palette = cores(args.paleta);
    st.components = (Array.isArray(args.componentes) ? (args.componentes as Json[]) : []).slice(0, 20).map((c) => ({
      id: uid(),
      name: str(c.nome).slice(0, 60),
      description: str(c.descricao).slice(0, 600),
      bg: color(c.fundo, "#111827"),
      fg: color(c.cor_texto, "#f9fafb"),
      accent: color(c.destaque, "#ff7a00"),
      sample: str(c.exemplo).slice(0, 80),
    }));
    st.recreated = (Array.isArray(args.recriados) ? (args.recriados as Json[]) : []).slice(0, 8).map((s) => ({
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
    st.status = "analisado";
    st.rev = Date.now();
    await putStyle(ws, st);
    return text(`Estilo “${st.name}” salvo: ${st.components && (st.components as unknown[]).length} componente(s), ${(st.recreated as unknown[]).length} recriação(ões). Ele já aparece na aba Estilos do Criador.`);
  }
  if (name === "listar_conteudos") {
    const c = await listRows<Project>("criador_contents", ws);
    return text(c.length ? c.map((p) => `- ${p.id} · ${p.title} [${p.format}, ${p.slides.length} slide(s)]`).join("\n") : "Nenhum conteúdo ainda.");
  }
  return { ...text(`Ferramenta desconhecida: ${name}`), isError: true };
}
