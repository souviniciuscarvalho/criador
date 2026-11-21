"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Check, Copy, Trash2 } from "lucide-react";
import { setState, useApp } from "@/lib/store";
import { patchStyle, pushStyle, removeStyleRemote, shrinkImage } from "@/lib/styles";
import SlidePreview from "@/components/SlidePreview";

type Tab = "prints" | "recriados" | "componentes" | "guia";

export default function EstiloPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, ready } = useApp();
  const [tab, setTab] = useState<Tab | null>(null);
  const [copied, setCopied] = useState(false);
  const [guide, setGuide] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  if (!ready) return null;
  const st = state.styles.find((s) => s.id === id);
  if (!st) return <p className="text-muted">Estilo não encontrado. <Link className="underline" href="/estilos">Voltar</Link></p>;

  const folders: { id: Tab; label: string; count: string }[] = [
    { id: "recriados", label: "Recriados pelo Claude", count: `${st.recreated.length} item(ns)` },
    { id: "prints", label: "Prints enviados", count: `${st.prints.length} item(ns)` },
    { id: "componentes", label: "Componentes", count: `${st.components.length} itens` },
    { id: "guia", label: "Guia do estilo", count: "Regras e composições" },
  ];
  const prompt = `Treine o estilo “${st.name}” no Criador, pelo conector, com o estudo completo.\n1. Chame instrucoes_estilo e prints_do_estilo com estilo_id: ${st.id}. Estude os prints seguindo as instruções (uma recriação para cada print e 10 a 12 componentes) e salve com salvar_estilo.\n2. No fim, me diga em poucas linhas como o estilo ficou.`;
  const dim = { w: 1080, h: 1350 };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="text-sm text-muted"><Link href="/estilos" className="hover:text-fg">Estilos</Link> / {st.name}{tab && <> / {folders.find((f) => f.id === tab)?.label}</>}</div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input className="input !w-auto !border-transparent !bg-transparent !px-0 !text-3xl font-bold tracking-tight" value={st.name}
          onChange={(e) => patchStyle(st.id, { name: e.target.value })} onBlur={() => pushStyle(st.id, { name: true }).catch(() => {})} />
        <span className="ml-1 flex gap-1">{st.palette.map((c) => <span key={c} title={c} className="size-4 rounded-full border border-line" style={{ background: c }} />)}</span>
        {st.fonts.title && <span className="text-xs text-muted">{st.fonts.title}{st.fonts.body ? ` · ${st.fonts.body}` : ""}</span>}
        <span className={`chip ${st.status === "analisado" ? "!text-[var(--ok)]" : ""}`}>{st.status === "analisado" ? "Analisado pelo Claude" : "Aguardando análise"}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn" disabled={!state.claude.token} onClick={() => { navigator.clipboard?.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copiado! Cole no Claude" : "Treinar com o Claude"}
        </button>
        <button className="btn btn-ghost" onClick={() => {
          if (!confirm("Excluir este estilo?")) return;
          removeStyleRemote(st.id);
          setState((s) => ({ ...s, styles: s.styles.filter((x) => x.id !== st.id) }));
          router.push("/estilos");
        }}><Trash2 size={15} /> Excluir</button>
      </div>
      {!state.claude.token
        ? <p className="mt-3 text-sm text-[var(--warn)]">Ligue o Claude em <Link className="underline" href="/conexoes">Conexões</Link> para treinar este estilo.</p>
        : <p className="mt-3 text-sm text-muted">Clique em “Treinar com o Claude” e cole o pedido numa conversa com o conector Criador ligado. Quando ele terminar, o estilo atualiza aqui em até 10 segundos.</p>}

      {!tab ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {folders.map((f) => (
            <button key={f.id} onClick={() => setTab(f.id)} className="space-y-2 text-left">
              <div className="grid aspect-square place-items-center overflow-hidden rounded-xl border border-line bg-panel hover:border-[#5a5a5a]">
                {f.id === "prints" && st.prints[0] && /* eslint-disable-next-line @next/next/no-img-element */ <img src={st.prints[0]} alt="" className="size-full object-cover" />}
                {f.id === "recriados" && st.recreated[0] && <SlidePreview slide={st.recreated[0]} width={dim.w} height={dim.h} className="!rounded-none" />}
                {f.id === "componentes" && st.components[0] && <span className="rounded px-3 py-1 text-sm font-extrabold" style={{ background: st.components[0].accent, color: st.components[0].bg }}>{st.components[0].sample || st.components[0].name}</span>}
                {f.id === "guia" && <span className="px-4 text-xs text-muted">{st.guide ? st.guide.slice(0, 140) + "…" : "Ainda sem guia."}</span>}
              </div>
              <div className="font-medium">{f.label}</div>
              <div className="-mt-1 text-xs text-muted">{f.count}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <button className="text-sm text-muted underline" onClick={() => setTab(null)}>Voltar às pastas</button>
          {tab === "prints" && (
            <>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {st.prints.map((p, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt="" className="w-full rounded-lg border border-line" />
                    <button className="btn btn-ghost absolute top-2 right-2 !p-1.5" aria-label="Remover print" onClick={() => { patchStyle(st.id, { prints: st.prints.filter((_, j) => j !== i) }); setTimeout(() => pushStyle(st.id, { prints: true }).catch(() => {}), 0); }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              {st.prints.length < 8 && (
                <input type="file" accept="image/*" multiple className="text-sm" onChange={async (e) => {
                  const imgs = await Promise.all([...(e.target.files ?? [])].map((f) => shrinkImage(f)));
                  patchStyle(st.id, { prints: [...st.prints, ...imgs].slice(0, 8) });
                  setTimeout(() => pushStyle(st.id, { prints: true }).catch(() => {}), 0);
                }} />
              )}
              <p className="text-xs text-muted">Depois de mudar os prints, peça ao Claude para treinar de novo.</p>
            </>
          )}
          {tab === "recriados" && (st.recreated.length ? (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">{st.recreated.map((s) => <SlidePreview key={s.id} slide={s} width={dim.w} height={dim.h} />)}</div>
          ) : <p className="text-sm text-muted">Ainda não há recriações. Clique em “Treinar com o Claude”.</p>)}
          {tab === "componentes" && (st.components.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {st.components.map((c) => (
                <div key={c.id} className="space-y-2 rounded-xl border border-line bg-panel p-4">
                  <div className="grid h-24 place-items-center rounded-lg" style={{ background: c.bg }}>
                    <span className="rounded px-3 py-1 text-sm font-extrabold" style={{ background: c.accent, color: c.bg }}>{c.sample || c.name}</span>
                  </div>
                  <div className="font-medium">{c.name}</div>
                  <p className="text-xs text-muted">{c.description}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted">Ainda não há componentes. Clique em “Treinar com o Claude”.</p>)}
          {tab === "guia" && (
            <>
              <p className="text-sm text-muted">As regras que o Claude segue ao criar conteúdos neste estilo. Pode editar à vontade.</p>
              <textarea className="input" rows={14} value={guide ?? st.guide} onChange={(e) => { setGuide(e.target.value); setSaved(false); }} />
              <button className="btn" onClick={() => { patchStyle(st.id, { guide: guide ?? st.guide }); setTimeout(() => pushStyle(st.id, { guide: true }).catch(() => {}), 0); setSaved(true); }}>
                {saved ? "Guia salvo" : "Salvar guia"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
