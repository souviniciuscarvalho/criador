"use client";
import { useEffect } from "react";
import { getState, setState, useApp } from "./store";
import type { Project, Reference } from "./types";

// Enquanto houver link do Claude, envia as referências ao servidor e traz de volta
// estudos feitos pelo Claude e conteúdos criados por ele.
export function useSync() {
  const { state, ready } = useApp();
  const token = state.claude.token;
  const refKey = JSON.stringify(state.references.map((r) => [r.id, r.study?.source, r.name]));

  useEffect(() => {
    if (!ready || !token) return;
    let stop = false;
    async function run() {
      try {
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ references: getState().references }),
        });
        const j = await res.json().catch(() => ({}));
        if (stop) return;
        if (!res.ok) {
          const msg = res.status === 503 ? "o Supabase ainda não foi configurado no servidor." : (j.error ?? "falha ao sincronizar.");
          setState((s) => (s.claude.syncError === msg ? s : { ...s, claude: { ...s.claude, syncError: msg } }));
          return;
        }
        setState((s) => {
          const studies = new Map<string, Reference["study"]>((j.studies ?? []).map((x: { id: string; study: Reference["study"] }) => [x.id, x.study]));
          let changed = s.claude.syncError !== undefined || s.claude.used !== !!j.used;
          const references = s.references.map((r) => {
            const st = studies.get(r.id);
            if (st && r.study?.at !== st.at) { changed = true; return { ...r, study: st }; }
            return r;
          });
          const have = new Set(s.projects.map((p) => p.id));
          const incoming = ((j.contents ?? []) as Project[]).filter((p) => !have.has(p.id));
          if (incoming.length) changed = true;
          if (!changed) return s;
          return { ...s, references, projects: [...incoming, ...s.projects], claude: { ...s.claude, used: !!j.used, syncError: undefined } };
        });
      } catch {
        /* sem rede: tenta de novo no próximo ciclo */
      }
    }
    run();
    const t = setInterval(run, 10000);
    return () => { stop = true; clearInterval(t); };
  }, [ready, token, refKey]);
}
