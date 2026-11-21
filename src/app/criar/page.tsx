"use client";
import { useState } from "react";
import { Download, Plus, Trash2, Copy, Sparkles } from "lucide-react";
import { useApp, setState } from "@/lib/store";
import { FORMATS, newProject, newSlide, type Project, type Slide } from "@/lib/types";
import SlidePreview from "@/components/SlidePreview";
import { downloadSlides } from "@/lib/render";

const PALETTES = [
  { bg: "#111827", fg: "#f9fafb", accent: "#a78bfa" },
  { bg: "#fafaf9", fg: "#18181b", accent: "#ef4444" },
  { bg: "#0f172a", fg: "#e0f2fe", accent: "#38bdf8" },
  { bg: "#fef3c7", fg: "#292524", accent: "#d97706" },
  { bg: "#052e16", fg: "#dcfce7", accent: "#4ade80" },
  { bg: "#be123c", fg: "#fff1f2", accent: "#fde047" },
];

export default function CriarPage() {
  const { state, ready } = useApp();
  const [curId, setCurId] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [idea, setIdea] = useState("");

  const proj = state.projects.find((p) => p.id === (curId ?? state.projects[0]?.id));

  function update(fn: (p: Project) => Project) {
    if (!proj) return;
    setState((s) => ({
      ...s,
      projects: s.projects.map((p) => (p.id === proj.id ? { ...fn(p), updatedAt: Date.now() } : p)),
    }));
  }
  function create(format: Project["format"], ideaText = "") {
    const p = newProject(format);
    if (ideaText.trim()) {
      p.title = ideaText.trim().slice(0, 60);
      p.slides[0].title = ideaText.trim().slice(0, 90);
    }
    setState((s) => ({ ...s, projects: [p, ...s.projects] }));
    setCurId(p.id);
    setIdx(0);
  }
  function patchSlide(patch: Partial<Slide>) {
    update((p) => ({ ...p, slides: p.slides.map((s, i) => (i === idx ? { ...s, ...patch } : s)) }));
  }

  if (!ready) return null;

  if (!proj) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold">O que vamos criar?</h1>
        <p className="mt-1 text-muted">Escreva sua ideia (opcional) e escolha o formato.</p>
        <textarea className="input mt-4" rows={3} placeholder="Ex.: 5 erros que travam o crescimento do seu perfil" value={idea} onChange={(e) => setIdea(e.target.value)} />
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
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

  const slide = proj.slides[Math.min(idx, proj.slides.length - 1)];
  const fmt = FORMATS.find((f) => f.id === proj.format)!;
  const multi = fmt.multi;
  const refs = state.references;
  const chosen = refs.filter((r) => proj.referenceIds.includes(r.id));

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <select className="input !w-auto" value={proj.id} onChange={(e) => { setCurId(e.target.value); setIdx(0); }}>
            {state.projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <button className="btn btn-ghost" onClick={() => create("carrossel")}><Plus size={16} /> Novo</button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              if (!confirm("Excluir este conteúdo?")) return;
              setState((s) => ({ ...s, projects: s.projects.filter((p) => p.id !== proj.id) }));
              setCurId(null);
            }}
          ><Trash2 size={16} /></button>
          <button className="btn ml-auto" onClick={() => downloadSlides(multi ? proj.slides : [slide], proj.width, proj.height, proj.title)}>
            <Download size={16} /> Baixar PNG{multi && proj.slides.length > 1 ? "s" : ""}
          </button>
        </div>

        <input className="input !text-lg font-semibold" value={proj.title} onChange={(e) => update((p) => ({ ...p, title: e.target.value }))} />

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_1fr]">
          <div className="mx-auto w-full max-w-[420px]">
            <SlidePreview slide={slide} width={proj.width} height={proj.height} />
          </div>

          <div className="space-y-3">
            <div>
              <span className="label">Formato</span>
              <div className="flex flex-wrap gap-1.5">
                {FORMATS.map((f) => (
                  <button key={f.id} className={`chip ${proj.format === f.id ? "chip-on" : ""}`}
                    onClick={() => update((p) => ({ ...p, format: f.id, width: f.width, height: f.height, slides: f.multi ? p.slides : p.slides.slice(0, 1) }))}>
                    {f.label}
                  </button>
                ))}
              </div>
              {proj.format === "custom" && (
                <div className="mt-2 flex items-center gap-2">
                  <input type="number" className="input" value={proj.width} min={200} max={4000} onChange={(e) => update((p) => ({ ...p, width: +e.target.value || 1080 }))} />
                  ×
                  <input type="number" className="input" value={proj.height} min={200} max={4000} onChange={(e) => update((p) => ({ ...p, height: +e.target.value || 1350 }))} />
                </div>
              )}
            </div>
            <div>
              <span className="label">Título</span>
              <textarea className="input" rows={2} value={slide.title} onChange={(e) => patchSlide({ title: e.target.value })} />
            </div>
            <div>
              <span className="label">Texto</span>
              <textarea className="input" rows={4} value={slide.body} onChange={(e) => patchSlide({ body: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="label">Tamanho do título ({slide.titleSize})</span>
                <input type="range" min={40} max={160} className="w-full" value={slide.titleSize} onChange={(e) => patchSlide({ titleSize: +e.target.value })} />
              </div>
              <div>
                <span className="label">Tamanho do texto ({slide.bodySize})</span>
                <input type="range" min={24} max={90} className="w-full" value={slide.bodySize} onChange={(e) => patchSlide({ bodySize: +e.target.value })} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {PALETTES.map((p, i) => (
                <button key={i} aria-label={`Paleta ${i + 1}`} onClick={() => patchSlide(p)}
                  className="size-7 rounded-full border border-line" style={{ background: `linear-gradient(135deg, ${p.bg} 50%, ${p.accent} 50%)` }} />
              ))}
              <button className="chip" onClick={() => patchSlide({ align: slide.align === "left" ? "center" : "left" })}>
                Alinhar: {slide.align === "left" ? "esquerda" : "centro"}
              </button>
            </div>
          </div>
        </div>

        {multi && (
          <div>
            <span className="label">Slides ({proj.slides.length})</span>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {proj.slides.map((s, i) => (
                <div key={s.id} className={`w-24 shrink-0 rounded-lg border-2 ${i === idx ? "border-white" : "border-transparent"}`}>
                  <SlidePreview slide={s} width={proj.width} height={proj.height} onClick={() => setIdx(i)} className="cursor-pointer" />
                </div>
              ))}
              <button className="grid w-24 shrink-0 place-items-center rounded-lg border border-dashed border-line text-muted"
                onClick={() => { update((p) => ({ ...p, slides: [...p.slides, newSlide({ bg: slide.bg, fg: slide.fg, accent: slide.accent, align: slide.align })] })); setIdx(proj.slides.length); }}>
                <Plus />
              </button>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost" onClick={() => { update((p) => ({ ...p, slides: [...p.slides.slice(0, idx + 1), { ...slide, id: Math.random().toString(36).slice(2) }, ...p.slides.slice(idx + 1)] })); setIdx(idx + 1); }}><Copy size={15} /> Duplicar</button>
              <button className="btn btn-ghost" disabled={proj.slides.length < 2} onClick={() => { update((p) => ({ ...p, slides: p.slides.filter((_, i) => i !== idx) })); setIdx(Math.max(0, idx - 1)); }}><Trash2 size={15} /> Remover slide</button>
            </div>
          </div>
        )}
      </div>

      <aside className="space-y-3 rounded-xl border border-line bg-panel p-4 lg:self-start">
        <div className="font-semibold">Base de referências</div>
        <p className="text-sm text-muted">Associe referências para guiar este conteúdo.</p>
        {refs.length === 0 && <p className="text-sm text-muted">Nenhuma ainda. Adicione na aba Referências.</p>}
        <div className="max-h-56 space-y-1 overflow-auto">
          {refs.map((r) => (
            <label key={r.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-panel2">
              <input type="checkbox" checked={proj.referenceIds.includes(r.id)}
                onChange={(e) => update((p) => ({ ...p, referenceIds: e.target.checked ? [...p.referenceIds, r.id] : p.referenceIds.filter((x) => x !== r.id) }))} />
              <span className="truncate">{r.name}</span>
              <span className="chip ml-auto">{r.niche || r.kind}</span>
            </label>
          ))}
        </div>
        {chosen.length > 0 && (
          <div className="rounded-lg bg-panel2 p-3 text-xs text-muted">
            Padrões das referências: {[...new Set(chosen.flatMap((r) => r.study?.tags ?? []))].join(", ") || "—"}
          </div>
        )}
        <div className="space-y-2 border-t border-line pt-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles size={15} /> Pedir ao Claude
            <span className={`dot ml-auto ${state.claude.token ? "dot-ok" : ""}`} />
          </div>
          <p className="text-xs text-muted">
            {state.claude.token
              ? "Copie o pedido e cole numa conversa do Claude com o conector Criador ligado."
              : "Ligue o Claude em Conexões para o texto ser escrito por ele, no seu plano, sem chave de API."}
          </p>
          <button className="btn btn-ghost w-full justify-center" onClick={() => {
            const refNames = chosen.map((r) => `“${r.name}”`).join(", ");
            const txt = `Crie um conteúdo de ${fmt.label.toLowerCase()} chamado “${proj.title}”` +
              (refNames ? `, usando como base as referências ${refNames}` : "") +
              ". Escreva título e texto de cada slide.";
            navigator.clipboard?.writeText(txt);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}>
            <Copy size={15} /> {copied ? "Copiado!" : "Copiar pedido"}
          </button>
        </div>
      </aside>
    </div>
  );
}
