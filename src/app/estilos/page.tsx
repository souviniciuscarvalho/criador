"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { setState, useApp } from "@/lib/store";
import { newStyle, pushStyle, shrinkImage } from "@/lib/styles";

export default function EstilosPage() {
  const { state, ready } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [prints, setPrints] = useState<string[]>([]);
  const [err, setErr] = useState("");
  if (!ready) return null;

  async function save() {
    if (!name.trim()) return;
    const st = newStyle(name.trim(), prints);
    setState((s) => ({ ...s, styles: [st, ...s.styles] }));
    setOpen(false); setName(""); setPrints([]); setErr("");
    pushStyle(st.id, { name: true, guide: true, prints: true }).catch(() => {});
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold tracking-tight">Estilos</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Envie prints dos seus carrosséis (ou de referências). O Claude aprende o visual e os próximos conteúdos saem nesse estilo. Cada estilo é uma pasta.
      </p>
      {!state.claude.token && (
        <p className="mt-4 text-sm text-[var(--warn)]">
          Ligue o Claude em <Link className="underline" href="/conexoes">Conexões → Claude</Link> para ele analisar os prints, sem custo de API.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {state.styles.map((st) => (
          <Link key={st.id} href={`/estilos/${st.id}`} className="group block">
            <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-panel group-hover:border-[#5a5a5a]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {st.prints[0] && <img src={st.prints[0]} alt="" className="size-full object-cover" />}
              <span className={`chip absolute top-3 left-3 !bg-black/70 ${st.status === "analisado" ? "!text-[var(--ok)]" : ""}`}>
                {st.status === "analisado" ? "Analisado" : "Aguardando análise"}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="font-medium">{st.name}</span>
              <span className="ml-auto flex gap-1">{st.palette.slice(0, 4).map((c) => <span key={c} className="size-3 rounded-full border border-line" style={{ background: c }} />)}</span>
            </div>
            <div className="text-xs text-muted">{st.prints.length} print{st.prints.length === 1 ? "" : "s"}</div>
          </Link>
        ))}
        <button onClick={() => setOpen(true)} className="grid aspect-square place-items-center rounded-xl border border-dashed border-line text-muted hover:text-fg">
          <span className="flex flex-col items-center gap-2 text-sm"><Plus /> Novo estilo<span className="text-xs">Envie prints de carrosséis</span></span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-10 grid place-items-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg space-y-3 rounded-xl border border-line bg-panel p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center"><h2 className="text-lg font-bold">Novo estilo</h2><button className="ml-auto" onClick={() => setOpen(false)} aria-label="Fechar"><X size={18} /></button></div>
            <div><span className="label">Nome do estilo</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div>
              <span className="label">Prints (até 8)</span>
              <input type="file" accept="image/*" multiple className="text-sm" onChange={async (e) => {
                try {
                  const imgs = await Promise.all([...(e.target.files ?? [])].map((f) => shrinkImage(f)));
                  setPrints((p) => [...p, ...imgs].slice(0, 8)); setErr("");
                } catch { setErr("Não consegui ler uma das imagens."); }
              }} />
              {prints.length > 0 && <div className="mt-2 flex gap-1.5 overflow-x-auto">{/* eslint-disable-next-line @next/next/no-img-element */}{prints.map((p, i) => <img key={i} src={p} alt="" className="h-20 rounded-md" />)}</div>}
              {err && <p className="mt-1 text-xs text-[var(--warn)]">{err}</p>}
            </div>
            <button className="btn w-full justify-center" disabled={!name.trim() || prints.length === 0} onClick={save}>Criar estilo</button>
          </div>
        </div>
      )}
    </div>
  );
}
