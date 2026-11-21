"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Copy, Download, ImagePlus, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useApp, setState } from "@/lib/store";
import { FORMATS, newProject, newSlide, uid, type Project, type Slide, type Style } from "@/lib/types";
import SlidePreview from "@/components/SlidePreview";
import { downloadSlides } from "@/lib/render";
import { fitImage } from "@/lib/styles";

const PALETTES = [
  { bg: "#111827", fg: "#f9fafb", accent: "#a78bfa" },
  { bg: "#fafaf9", fg: "#18181b", accent: "#ef4444" },
  { bg: "#0f172a", fg: "#e0f2fe", accent: "#38bdf8" },
  { bg: "#fef3c7", fg: "#292524", accent: "#d97706" },
  { bg: "#052e16", fg: "#dcfce7", accent: "#4ade80" },
  { bg: "#be123c", fg: "#fff1f2", accent: "#fde047" },
];

function styleLook(st: Style): Partial<Slide> {
  const r = st.recreated[0];
  return {
    bg: r?.bg ?? st.palette[0] ?? "#111827",
    fg: r?.fg ?? "#f9fafb",
    accent: r?.accent ?? st.palette[1] ?? "#a78bfa",
    align: r?.align ?? "left",
    font: st.fonts.title || undefined,
  };
}

function CopyBtn({ text, label, done }: { text: string; label: string; done: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="btn btn-ghost" onClick={() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1800); }}>
      {ok ? <Check size={15} /> : <Copy size={15} />} {ok ? done : label}
    </button>
  );
}

export default function CriarPage() {
  const { state, ready } = useApp();
  const [curId, setCurId] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [idea, setIdea] = useState("");

  const proj = state.projects.find((p) => p.id === (curId ?? state.projects[0]?.id));

  function update(fn: (p: Project) => Project) {
    if (!proj) return;
    setState((s) => ({ ...s, projects: s.projects.map((p) => (p.id === proj.id ? { ...fn(p), updatedAt: Date.now() } : p)) }));
  }
  function create(format: Project["format"], ideaText = "") {
    const p = newProject(format);
    const def = state.styles.find((s) => s.id === state.defaultStyleId);
    if (def) { p.styleId = def.id; p.slides = p.slides.map((s) => ({ ...s, ...styleLook(def) })); }
    if (ideaText.trim()) { p.title = ideaText.trim().slice(0, 60); p.slides[0].title = ideaText.trim().slice(0, 90); }
    setState((s) => ({ ...s, projects: [p, ...s.projects] }));
    setCurId(p.id); setIdx(0);
  }
  const patchSlide = (i: number, patch: Partial<Slide>) =>
    update((p) => ({ ...p, slides: p.slides.map((s, k) => (k === i ? { ...s, ...patch } : s)) }));

  const [gen, setGen] = useState<{ busy: boolean; err: string; prompt: string; idea: string }>({ busy: false, err: "", prompt: "", idea: "" });
  const conn = state.connections;
  const provider = conn.imageDefault === "gemini" || conn.imageDefault === "openai" ? conn.imageDefault : conn.keys.gemini ? "gemini" : conn.keys.openai ? "openai" : "";

  async function upload(f?: File) {
    if (!f) return;
    try { patchSlide(si, { bgImage: await fitImage(f), bgDim: slide?.bgDim ?? 0.45 }); } catch { setGen((g) => ({ ...g, err: "Não consegui abrir essa imagem." })); }
  }
  const [fig, setFig] = useState("");
  async function genServer() {
    const t = state.claude.token;
    if (!t) { setGen((g) => ({ ...g, err: "Ligue o Claude em Conexões primeiro." })); return; }
    setGen((g) => ({ ...g, err: "" }));
    const r = await fetch("/api/gerar", { method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify({ contentId: proj?.id }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setGen((g) => ({ ...g, err: j.error ?? "falha ao pedir as imagens" }));
  }
  const imgSt = proj ? state.imagens?.status[proj.id] : undefined;
  async function importFigma() {
    if (!conn.keys.figma) { setGen((g) => ({ ...g, err: "Salve o token do Figma em Conexões → Integrações." })); return; }
    setGen((g) => ({ ...g, busy: true, err: "" }));
    try {
      const r = await fetch("/api/figma", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: conn.keys.figma, url: fig }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "falha ao importar");
      patchSlide(si, { bgImage: await fitImage(j.image), bgDim: 0 });
      setFig("");
      setGen((g) => ({ ...g, busy: false }));
    } catch (e) {
      setGen((g) => ({ ...g, busy: false, err: e instanceof Error ? e.message : "falha ao importar" }));
    }
  }
  async function generate() {
    const base = slide?.imageIdea?.trim() || slide?.title || "";
    const prompt = (gen.idea === slide?.id && gen.prompt ? gen.prompt : base).trim();
    if (!provider) { setGen((g) => ({ ...g, err: "Salve a chave da OpenAI ou do Gemini em Conexões → Imagens." })); return; }
    setGen((g) => ({ ...g, busy: true, err: "" }));
    try {
      const r = await fetch("/api/imagem", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider, key: conn.keys[provider], prompt: `${prompt}. Imagem de fundo para post de rede social, sem texto escrito, sem letras.`,
          model: provider === "gemini" ? conn.geminiModel : conn.openaiModel, quality: conn.openaiQuality, width: proj?.width, height: proj?.height,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "falha ao gerar");
      patchSlide(si, { bgImage: await fitImage(j.image), bgDim: slide.bgDim ?? 0.45 });
      setGen((g) => ({ ...g, busy: false }));
    } catch (e) {
      setGen((g) => ({ ...g, busy: false, err: e instanceof Error ? e.message : "falha ao gerar" }));
    }
  }

  if (!ready) return null;

  if (!proj) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight">O que vamos criar?</h1>
        <p className="mt-2 text-muted">Escreva sua ideia (opcional) e escolha o formato.</p>
        <textarea className="input mt-4" rows={3} placeholder="Ex.: 5 erros que travam o crescimento do seu perfil" value={idea} onChange={(e) => setIdea(e.target.value)} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {FORMATS.map((f) => (
            <button key={f.id} onClick={() => create(f.id, idea)} className="rounded-xl border border-line bg-panel p-5 text-left hover:border-[#5a5a5a]">
              <div className="font-semibold">{f.label}</div>
              <div className="text-sm text-muted">{f.hint}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const fmt = FORMATS.find((f) => f.id === proj.format)!;
  const multi = fmt.multi;
  const stage = proj.stage ?? "texto";
  const si = Math.min(idx, proj.slides.length - 1);
  const slide = proj.slides[si];
  const style = state.styles.find((s) => s.id === proj.styleId);
  const chosen = state.references.filter((r) => proj.referenceIds.includes(r.id));
  const linked = !!state.claude.token;
  const refNames = chosen.map((r) => `“${r.name}”`).join(", ");

  const notePrompt = `Leia o texto do conteúdo “${proj.title}” (id ${proj.id}) no Criador, pelo conector, como um editor exigente (ler_conteudo). Dê uma nota de 0 a 100, um resumo e sugestões de melhoria, e salve com salvar_nota. Depois me diga em poucas linhas o que melhorar.`;
  const visualPrompt = `Monte o visual do conteúdo “${proj.title}” (id ${proj.id}) no Criador, pelo conector.\n1. Chame ler_conteudo${style ? ` e ler_estilo com estilo_id: ${style.id} (“${style.name}”)` : ""}.\n2. Atualize cada slide com atualizar_conteudo (indice, fundo, cor_texto, destaque, alinhamento, tamanho_titulo, tamanho_texto${style ? ", pecas com os componentes do estilo" : ""}), sem mudar o texto já aprovado${style ? ", seguindo o guia do estilo" : ""}.\n3. Formato do carrossel: ${proj.mode === "continuo" ? "contínuo (os slides se encaixam como uma faixa só)" : "normal (cada slide fechado em si)"}.\n4. Escreva ideia_imagem para TODOS os slides (uma cena concreta, sem texto escrito na imagem): a IA de imagem conectada gera uma imagem por slide sozinha quando você terminar.\n5. No fim, use etapa: "visual".`;
  const textPrompt = `Escreva o texto de um ${fmt.label.toLowerCase()} para o Criador, pelo conector${refNames ? `, usando como base as referências ${refNames} (ler_referencia)` : ""}. Tema: ${proj.title}. Salve com criar_conteudo (título, legenda e slides com texto principal, texto de apoio e ideia de imagem).`;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <select className="input !w-auto" value={proj.id} onChange={(e) => { setCurId(e.target.value); setIdx(0); }}>
            {state.projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <button className="btn btn-ghost" onClick={() => create("carrossel")}><Plus size={16} /> Novo</button>
          <button className="btn btn-ghost" aria-label="Excluir conteúdo" onClick={() => {
            if (!confirm("Excluir este conteúdo?")) return;
            setState((s) => ({ ...s, projects: s.projects.filter((p) => p.id !== proj.id), deletedProjects: [...s.deletedProjects, proj.id] }));
            setCurId(null);
          }}><Trash2 size={16} /></button>
        </div>

        <input className="input !border-transparent !bg-transparent !px-0 !text-3xl font-bold tracking-tight" value={proj.title} onChange={(e) => update((p) => ({ ...p, title: e.target.value }))} />

        <div className="flex gap-6 border-b border-line text-sm">
          {([["texto", "Etapa 1 · Texto"], ["visual", "Etapa 2 · Visual"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => update((p) => ({ ...p, stage: k }))}
              className={`-mb-px border-b-2 pb-3 font-medium ${stage === k ? "border-white text-fg" : "border-transparent text-muted hover:text-fg"}`}>{l}</button>
          ))}
        </div>

        {stage === "texto" ? (
          <>
            <p className="text-sm text-muted">Revise e edite o texto de cada slide. Quando estiver do seu jeito, gere o visual.</p>
            <div className="flex flex-wrap gap-1.5">
              {FORMATS.map((f) => (
                <button key={f.id} className={`chip ${proj.format === f.id ? "chip-on" : ""}`}
                  onClick={() => update((p) => ({ ...p, format: f.id, width: f.width, height: f.height, slides: f.multi ? p.slides : p.slides.slice(0, 1) }))}>{f.label}</button>
              ))}
            </div>
            {proj.format === "custom" && (
              <div className="flex max-w-xs items-center gap-2">
                <input type="number" className="input" value={proj.width} min={200} max={4000} onChange={(e) => update((p) => ({ ...p, width: +e.target.value || 1080 }))} />×
                <input type="number" className="input" value={proj.height} min={200} max={4000} onChange={(e) => update((p) => ({ ...p, height: +e.target.value || 1350 }))} />
              </div>
            )}

            {proj.slides.map((s, i) => (
              <section key={s.id} className="space-y-3 rounded-xl border border-line bg-panel p-4">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="font-mono">{String(i + 1).padStart(2, "0")}</span>{i === 0 && multi && <span>CAPA</span>}
                  <span className="ml-auto flex gap-1">
                    <button aria-label="Subir" disabled={i === 0} className="chip disabled:opacity-30" onClick={() => update((p) => { const a = [...p.slides]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return { ...p, slides: a }; })}><ArrowUp size={13} /></button>
                    <button aria-label="Descer" disabled={i === proj.slides.length - 1} className="chip disabled:opacity-30" onClick={() => update((p) => { const a = [...p.slides]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; return { ...p, slides: a }; })}><ArrowDown size={13} /></button>
                    {multi && <button aria-label="Adicionar depois" className="chip" onClick={() => update((p) => ({ ...p, slides: [...p.slides.slice(0, i + 1), newSlide({ bg: s.bg, fg: s.fg, accent: s.accent, align: s.align, font: s.font, title: "", body: "" }), ...p.slides.slice(i + 1)] }))}><Plus size={13} /></button>}
                    <button aria-label="Remover slide" disabled={proj.slides.length < 2} className="chip disabled:opacity-30" onClick={() => update((p) => ({ ...p, slides: p.slides.filter((_, k) => k !== i) }))}><X size={13} /></button>
                  </span>
                </div>
                <div><span className="label">TEXTO PRINCIPAL</span><textarea className="input" rows={2} value={s.title} onChange={(e) => patchSlide(i, { title: e.target.value })} /></div>
                <div><span className="label">TEXTO DE APOIO (opcional)</span><textarea className="input" rows={2} value={s.body} onChange={(e) => patchSlide(i, { body: e.target.value })} /></div>
                <div><span className="label">IDEIA DE IMAGEM (opcional)</span><textarea className="input" rows={1} value={s.imageIdea ?? ""} onChange={(e) => patchSlide(i, { imageIdea: e.target.value })} /></div>
              </section>
            ))}
            {multi && proj.slides.length < 20 && (
              <button className="btn btn-ghost" onClick={() => { const l = proj.slides[proj.slides.length - 1]; update((p) => ({ ...p, slides: [...p.slides, newSlide({ bg: l.bg, fg: l.fg, accent: l.accent, align: l.align, font: l.font, title: "", body: "" })] })); }}><Plus size={15} /> Adicionar slide</button>
            )}

            <div><span className="label">Legenda do post</span><textarea className="input" rows={4} value={proj.caption ?? ""} onChange={(e) => update((p) => ({ ...p, caption: e.target.value }))} /></div>

            <section className="space-y-3 rounded-xl border border-line bg-panel p-4">
              <div className="text-xs tracking-widest text-muted uppercase">Antes do visual · nota da IA</div>
              <p className="text-sm text-muted">O Claude lê o texto como um editor exigente, dá uma nota e sugere melhorias.</p>
              {proj.note && (
                <div className="space-y-2 rounded-lg bg-panel2 p-3 text-sm">
                  <div className="text-2xl font-bold">{proj.note.score}<span className="text-sm font-normal text-muted"> / 100</span></div>
                  <p>{proj.note.summary}</p>
                  {proj.note.tips.length > 0 && <ul className="list-disc space-y-1 pl-5 text-muted">{proj.note.tips.map((t, k) => <li key={k}>{t}</li>)}</ul>}
                </div>
              )}
              <CopyBtn text={notePrompt} label="Pedir nota ao Claude" done="Copiado! Cole no Claude" />
              {!linked && <p className="text-xs text-[var(--warn)]">Ligue o Claude em <Link className="underline" href="/conexoes">Conexões</Link> primeiro.</p>}
            </section>

            <div className="flex items-center gap-3">
              <span className="text-sm text-muted">Quando o texto estiver pronto, gere o visual.</span>
              <button className="btn ml-auto" onClick={() => update((p) => ({ ...p, stage: "visual" }))}>Gerar visual <ArrowRight size={15} /></button>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_1fr]">
              <div className="mx-auto w-full max-w-[420px]"><SlidePreview slide={slide} width={proj.width} height={proj.height} /></div>
              <div className="space-y-4">
                <div>
                  <span className="label">Estilo</span>
                  {state.styles.length ? (
                    <div className="flex gap-2">
                      <select className="input" value={proj.styleId ?? ""} onChange={(e) => update((p) => ({ ...p, styleId: e.target.value || undefined }))}>
                        <option value="">Sem estilo</option>
                        {state.styles.map((s) => <option key={s.id} value={s.id}>{s.name}{s.status === "novo" ? " (não analisado)" : ""}</option>)}
                      </select>
                      <button className="btn btn-ghost" disabled={!style} title="Aplicar cores e fonte do estilo a todos os slides"
                        onClick={() => style && update((p) => ({ ...p, slides: p.slides.map((s) => ({ ...s, ...styleLook(style) })) }))}>Aplicar</button>
                    </div>
                  ) : <p className="text-sm text-muted">Treine um estilo primeiro em <Link className="underline" href="/estilos">Estilos</Link>: envie prints dos seus carrosséis e volte aqui. O texto fica salvo.</p>}
                </div>
                {multi && (
                  <div>
                    <span className="label">Formato do carrossel</span>
                    <div className="flex gap-2">
                      {(["normal", "continuo"] as const).map((m) => (
                        <button key={m} className={`chip ${(proj.mode ?? "normal") === m ? "chip-on" : ""}`} onClick={() => update((p) => ({ ...p, mode: m }))}>{m === "normal" ? "Normal" : "Contínuo"}</button>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-muted">{(proj.mode ?? "normal") === "normal" ? "Cada slide fechado em si." : "Os slides se encaixam como uma faixa só."}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="label">Título ({slide.titleSize})</span><input type="range" min={40} max={160} className="w-full" value={slide.titleSize} onChange={(e) => patchSlide(si, { titleSize: +e.target.value })} /></div>
                  <div><span className="label">Texto ({slide.bodySize})</span><input type="range" min={24} max={90} className="w-full" value={slide.bodySize} onChange={(e) => patchSlide(si, { bodySize: +e.target.value })} /></div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {PALETTES.map((p, i) => <button key={i} aria-label={`Paleta ${i + 1}`} onClick={() => patchSlide(si, p)} className="size-7 rounded-full border border-line" style={{ background: `linear-gradient(135deg, ${p.bg} 50%, ${p.accent} 50%)` }} />)}
                  {style?.palette.map((c) => <button key={c} aria-label={`Cor ${c}`} title={c} onClick={() => patchSlide(si, { bg: c })} className="size-7 rounded-full border border-white/40" style={{ background: c }} />)}
                  <button className="chip" onClick={() => patchSlide(si, { align: slide.align === "left" ? "center" : "left" })}>Alinhar: {slide.align === "left" ? "esquerda" : "centro"}</button>
                </div>
                <div className="space-y-2">
                  <span className="label">Foto de fundo</span>
                  <textarea className="input min-h-16" placeholder={slide.imageIdea || "Descreva a imagem (ou deixe a ideia de imagem do slide)"}
                    value={gen.idea === slide.id ? gen.prompt : ""} onChange={(e) => setGen((g) => ({ ...g, idea: slide.id, prompt: e.target.value }))} />
                  <div className="flex flex-wrap gap-2">
                    <button className="btn" disabled={gen.busy} onClick={generate}>
                      {gen.busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Gerar com IA{provider ? ` (${provider === "gemini" ? "Gemini" : "OpenAI"})` : ""}
                    </button>
                    <label className="btn btn-ghost cursor-pointer"><ImagePlus size={15} /> Enviar foto
                      <input type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
                    </label>
                    {slide.bgImage && <button className="btn btn-ghost" onClick={() => { patchSlide(si, { bgImage: undefined }); const t = state.claude.token; if (t) fetch(`/api/slide-image?c=${proj.id}&s=${slide.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${t}` } }).catch(() => {}); }}><X size={14} /> Tirar</button>}
                  </div>
                  <div className="flex gap-2">
                    <input className="input" placeholder="Link de um quadro do Figma" value={fig} onChange={(e) => setFig(e.target.value)} />
                    <button className="btn btn-ghost" disabled={gen.busy || !fig.trim()} onClick={importFigma}>Importar</button>
                  </div>
                  {slide.bgImage && (
                    <div><span className="label">Escurecer a foto ({Math.round((slide.bgDim ?? 0.45) * 100)}%)</span>
                      <input type="range" min={0} max={85} className="w-full" value={Math.round((slide.bgDim ?? 0.45) * 100)} onChange={(e) => patchSlide(si, { bgDim: +e.target.value / 100 })} /></div>
                  )}
                  {gen.err && <p className="text-xs text-red-400">{gen.err}</p>}
                  {!provider && <p className="text-xs text-muted">Para gerar com IA, salve a chave em <Link className="underline" href="/conexoes/imagens">Conexões → Imagens</Link>. Enviar foto funciona sem chave. As fotos ficam só neste navegador.</p>}
                </div>
                <div>
                  <span className="label">Componentes do estilo</span>
                  {style && style.components.length > 0 ? (
                    <select className="input" value="" onChange={(e) => {
                      const c = style.components.find((x) => x.id === e.target.value);
                      if (c) patchSlide(si, { pieces: [...(slide.pieces ?? []), { id: uid(), text: c.sample || c.name, bg: c.accent, fg: c.bg }] });
                    }}>
                      <option value="">+ Componente</option>
                      {style.components.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : <p className="text-xs text-muted">Escolha um estilo analisado para usar os componentes dele.</p>}
                  {(slide.pieces ?? []).map((pc) => (
                    <div key={pc.id} className="mt-2 flex gap-2">
                      <input className="input" value={pc.text} onChange={(e) => patchSlide(si, { pieces: slide.pieces!.map((x) => (x.id === pc.id ? { ...x, text: e.target.value } : x)) })} />
                      <button className="btn btn-ghost" aria-label="Remover componente" onClick={() => patchSlide(si, { pieces: slide.pieces!.filter((x) => x.id !== pc.id) })}><X size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3 text-sm">
              <button className="btn btn-ghost" disabled={imgSt?.state === "gerando"} onClick={genServer}>
                {imgSt?.state === "gerando" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Gerar imagens de todos os slides
              </button>
              <span className="text-muted">
                {imgSt?.state === "gerando" ? `Gerando ${imgSt.done}/${imgSt.total}… pode fechar, continua no servidor.`
                  : imgSt?.state === "pronto" ? "Imagens prontas." : imgSt?.state === "erro" ? `Algumas falharam: ${imgSt.error}`
                  : state.imagens && !state.imagens.keys.openai && !state.imagens.keys.gemini ? "Salve a chave de imagem em Conexões → Imagens." : "Quando o Claude terminar o visual, as imagens saem sozinhas."}
              </span>
            </div>

            <div>
              <span className="label">Slides ({proj.slides.length})</span>
              <div className={`flex overflow-x-auto pb-2 ${proj.mode === "continuo" && multi ? "gap-0" : "gap-2"}`}>
                {proj.slides.map((s, i) => (
                  <div key={s.id} className={`w-24 shrink-0 border-2 ${i === si ? "border-white" : "border-transparent"} ${proj.mode === "continuo" && multi ? "" : "rounded-lg"}`}>
                    <SlidePreview slide={s} width={proj.width} height={proj.height} onClick={() => setIdx(i)} className={`cursor-pointer ${proj.mode === "continuo" && multi ? "!rounded-none" : ""}`} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button className="btn btn-ghost" onClick={() => update((p) => ({ ...p, stage: "texto" }))}><ArrowLeft size={15} /> Voltar ao texto</button>
              <CopyBtn text={visualPrompt} label="Copiar para o Claude" done="Copiado! Cole no Claude" />
              <button className="btn ml-auto" onClick={() => downloadSlides(multi ? proj.slides : [slide], proj.width, proj.height, proj.title)}><Download size={16} /> Baixar PNG{multi && proj.slides.length > 1 ? "s" : ""}</button>
            </div>
            <p className="text-xs text-muted">“Copiar para o Claude”: cole no chat do Claude com o conector Criador ligado e ele monta o visual com esta configuração, sem custo de API.{!linked && " Ligue o Claude em Conexões primeiro."}</p>
          </>
        )}
      </div>

      <aside className="space-y-3 rounded-xl border border-line bg-panel p-4 lg:self-start">
        <div className="font-semibold">Base de referências</div>
        <p className="text-sm text-muted">Associe referências para guiar este conteúdo.</p>
        {state.references.length === 0 && <p className="text-sm text-muted">Nenhuma ainda. Adicione na aba Referências.</p>}
        <div className="max-h-56 space-y-1 overflow-auto">
          {state.references.map((r) => (
            <label key={r.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-panel2">
              <input type="checkbox" checked={proj.referenceIds.includes(r.id)}
                onChange={(e) => update((p) => ({ ...p, referenceIds: e.target.checked ? [...p.referenceIds, r.id] : p.referenceIds.filter((x) => x !== r.id) }))} />
              <span className="truncate">{r.name}</span><span className="chip ml-auto">{r.niche || r.kind}</span>
            </label>
          ))}
        </div>
        {chosen.length > 0 && <div className="rounded-lg bg-panel2 p-3 text-xs text-muted">Padrões: {[...new Set(chosen.flatMap((r) => r.study?.tags ?? []))].join(", ") || "—"}</div>}
        <div className="space-y-2 border-t border-line pt-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={15} /> Pedir o texto ao Claude<span className={`dot ml-auto ${state.claude.used ? "dot-ok" : ""}`} /></div>
          <p className="text-xs text-muted">{linked ? "Copie o pedido e cole numa conversa do Claude com o conector Criador ligado." : "Ligue o Claude em Conexões para ele escrever, no seu plano, sem chave de API."}</p>
          <CopyBtn text={textPrompt} label="Copiar pedido" done="Copiado!" />
        </div>
      </aside>
    </div>
  );
}
