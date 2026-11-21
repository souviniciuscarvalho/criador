"use client";
import { useEffect } from "react";
import { getState, setState, useApp } from "./store";
import { pushStyle } from "./styles";
import type { Project, Reference, Style } from "./types";

const uploading = new Set<string>();

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
        // estilos locais que o servidor ainda não conhece: envia
        const remote = new Map<string, Record<string, unknown>>(((j.styles ?? []) as Array<{ id: string }>).map((x) => [x.id, x as Record<string, unknown>]));
        for (const st of getState().styles) {
          if (!remote.has(st.id) && !uploading.has(st.id)) {
            uploading.add(st.id);
            pushStyle(st.id, { name: true, guide: true, prints: true }).catch(() => {}).finally(() => uploading.delete(st.id));
          }
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
          const styles = s.styles.map((st) => {
            const r = remote.get(st.id) as Partial<Style> | undefined;
            if (r && typeof r.rev === "number" && r.rev > st.rev && r.status) {
              changed = true;
              return { ...st, status: r.status, guide: r.guide ?? st.guide, fonts: r.fonts ?? st.fonts, palette: r.palette ?? [], components: r.components ?? [], recreated: r.recreated ?? [], rev: r.rev };
            }
            return st;
          });
          if (!changed) return s;
          return { ...s, styles, references, projects: [...incoming, ...s.projects], claude: { ...s.claude, used: !!j.used, syncError: undefined } };
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
