"use client";
import { useState } from "react";
import { Plus, Trash2, Brain, X } from "lucide-react";
import { useApp, setState } from "@/lib/store";
import { uid, type Reference } from "@/lib/types";
import { studyLocal } from "@/lib/study";

function shrink(file: File, max = 640): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = img.width * k;
      c.height = img.height * k;
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.75));
    };
    img.src = url;
  });
}

const KINDS: Reference["kind"][] = ["feed", "carrossel", "story", "outro"];

export default function ReferenciasPage() {
  const { state, ready } = useApp();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", niche: "", kind: "carrossel" as Reference["kind"], notes: "", images: [] as string[] });
  const [filter, setFilter] = useState("");

  function save() {
    if (!f.name.trim()) return;
    const ref: Reference = { id: uid(), ...f, name: f.name.trim(), niche: f.niche.trim(), study: null, createdAt: Date.now() };
    ref.study = studyLocal(ref);
    setState((s) => ({ ...s, references: [ref, ...s.references] }));
    setF({ name: "", niche: "", kind: "carrossel", notes: "", images: [] });
    setOpen(false);
  }

  if (!ready) return null;
  const niches = [...new Set(state.references.map((r) => r.niche).filter(Boolean))];
  const list = state.references.filter((r) => !filter || r.niche === filter);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Referências</h1>
          <p className="text-sm text-muted">Conteúdos que servem de base. Cada um é estudado e fica disponível ao criar.</p>
        </div>
        <button className="btn ml-auto" onClick={() => setOpen(true)}><Plus size={16} /> Adicionar referência</button>
      </div>

      {niches.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          <button className={`chip ${!filter ? "chip-on" : ""}`} onClick={() => setFilter("")}>Todos</button>
          {niches.map((n) => (
            <button key={n} className={`chip ${filter === n ? "chip-on" : ""}`} onClick={() => setFilter(n)}>{n}</button>
          ))}
        </div>
      )}

      {list.length === 0 && (
        <div className="mt-10 rounded-xl border border-dashed border-line p-10 text-center text-muted">
          Nenhuma referência ainda. Clique em “Adicionar referência”.
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {list.map((r) => (
          <article key={r.id} className="space-y-3 rounded-xl border border-line bg-panel p-4">
            <div className="flex items-start gap-2">
              <div className="min-w-0">
                <div className="truncate font-semibold">{r.name}</div>
                <div className="mt-1 flex gap-1.5"><span className="chip">{r.kind}</span>{r.niche && <span className="chip">{r.niche}</span>}</div>
              </div>
              <button className="ml-auto text-muted hover:text-fg" aria-label="Excluir"
                onClick={() => confirm("Excluir referência?") && setState((s) => ({ ...s, references: s.references.filter((x) => x.id !== r.id) }))}>
                <Trash2 size={16} />
              </button>
            </div>
            {r.images.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.images.map((src, i) => <img key={i} src={src} alt="" className="h-24 rounded-md" />)}
              </div>
            )}
            {r.study && (
              <div className="rounded-lg bg-panel2 p-3 text-sm">
                <div className="mb-1 flex items-center gap-1.5 text-xs text-muted"><Brain size={13} /> Estudo {r.study.source === "local" ? "básico (local)" : "do Claude"}</div>
                <p>{r.study.summary}</p>
                <div className="mt-2 flex flex-wrap gap-1">{r.study.tags.map((t) => <span key={t} className="chip">{t}</span>)}</div>
              </div>
            )}
            <button className="text-xs text-muted underline" onClick={() => setState((s) => ({ ...s, references: s.references.map((x) => x.id === r.id ? { ...x, study: studyLocal(x) } : x) }))}>Refazer estudo</button>
          </article>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-10 grid place-items-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-auto rounded-xl border border-line bg-panel p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center"><h2 className="text-lg font-bold">Nova referência</h2><button className="ml-auto" onClick={() => setOpen(false)} aria-label="Fechar"><X size={18} /></button></div>
            <div><span className="label">Nome do conteúdo</span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><span className="label">Nicho</span><input className="input" placeholder="ex: marketing, fitness" value={f.niche} onChange={(e) => setF({ ...f, niche: e.target.value })} /></div>
              <div><span className="label">Tipo</span>
                <select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Reference["kind"] })}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
              </div>
            </div>
            <div><span className="label">Texto / legenda do conteúdo</span><textarea className="input" rows={5} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
            <div><span className="label">Prints / imagens</span>
              <input type="file" accept="image/*" multiple className="text-sm" onChange={async (e) => {
                const imgs = await Promise.all([...(e.target.files ?? [])].map((x) => shrink(x)));
                setF((p) => ({ ...p, images: [...p.images, ...imgs] }));
              }} />
              {f.images.length > 0 && <div className="mt-2 text-xs text-muted">{f.images.length} imagem(ns) anexada(s)</div>}
            </div>
            <button className="btn w-full justify-center" disabled={!f.name.trim()} onClick={save}>Salvar e estudar</button>
          </div>
        </div>
      )}
    </div>
  );
}
