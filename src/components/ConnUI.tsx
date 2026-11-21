"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { setState, useApp } from "@/lib/store";
import type { KeyProvider } from "@/lib/types";

export function Status({ ok, children }: { ok: boolean; children?: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <span className={`dot ${ok ? "dot-ok" : ""}`} /> {children ?? (ok ? "conectado" : "não conectado")}
    </span>
  );
}

export function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="grid size-6 shrink-0 place-items-center rounded-full border border-line text-xs text-muted">{i + 1}</span>
          <div className="min-w-0 flex-1 text-muted">{it}</div>
        </li>
      ))}
    </ol>
  );
}

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="btn btn-ghost" onClick={() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}>
      {ok ? <Check size={15} /> : <Copy size={15} />} {ok ? "Copiado" : label}
    </button>
  );
}

// Campo para colar uma chave/token e salvar.
export function KeyField({ provider, placeholder, test }: { provider: KeyProvider; placeholder: string; test?: (v: string) => boolean }) {
  const { state } = useApp();
  const saved = state.connections.keys[provider];
  const remote = (provider === "openai" || provider === "gemini" || provider === "iagen") && !!state.imagens?.keys?.[provider];
  const removeRemote = () => {
    const t = state.claude.token;
    if (t) fetch("/api/keys", { method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify({ keys: { [provider]: "" } }) }).then(() => setState((s) => s.imagens ? { ...s, imagens: { ...s.imagens, keys: { ...s.imagens.keys, [provider]: false } } } : s)).catch(() => {});
  };
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");
  const set = (v: string | undefined) =>
    setState((s) => {
      const keys = { ...s.connections.keys };
      if (v) keys[provider] = v; else delete keys[provider];
      return { ...s, connections: { ...s.connections, keys } };
    });
  if (!saved && remote)
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-panel2 px-3 py-2 text-xs text-muted">chave guardada no servidor</span>
        <button className="btn btn-ghost ml-auto" onClick={removeRemote}>Remover</button>
      </div>
    );
  if (saved)
    return (
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-lg bg-panel2 px-3 py-2 text-xs text-muted">{saved.slice(0, 6)}…{saved.slice(-4)}</code>
        <span className="text-xs text-muted">salva neste navegador</span>
        <button className="btn btn-ghost ml-auto" onClick={() => { set(undefined); removeRemote(); }}>Remover</button>
      </div>
    );
  return (
    <div>
      <div className="flex gap-2">
        <input className="input" type="password" placeholder={placeholder} value={val} onChange={(e) => { setVal(e.target.value); setErr(""); }} />
        <button className="btn" onClick={() => {
          const v = val.trim();
          if (!v) return;
          if (test && !test(v)) return setErr(`Essa chave deveria começar com ${placeholder.replace("…", "")}`);
          set(v); setVal("");
        }}>Salvar</button>
      </div>
      {err && <p className="mt-1 text-xs text-[var(--warn)]">{err}</p>}
    </div>
  );
}

export function Card({ title, desc, status, children }: { title: string; desc?: string; status?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-line bg-panel p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{title}</h3>
          {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
        </div>
        <div className="ml-auto shrink-0">{status}</div>
      </div>
      {children}
    </section>
  );
}
