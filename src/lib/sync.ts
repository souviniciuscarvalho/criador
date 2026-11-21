"use client";
import { useEffect } from "react";
import { getState, setState, useApp } from "./store";
import { fitImage, pushStyle } from "./styles";
import type { Project, Reference, Style } from "./types";

const uploading = new Set<string>();
const fetching = new Set<string>();
let pushedKeys = "";
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

// Enquanto houver link do Claude, envia as referências ao servidor e traz de volta
// estudos feitos pelo Claude e conteúdos criados por ele.
export function useSync() {
  const { state, ready } = useApp();
  const token = state.claude.token;
  const refKey = JSON.stringify(state.references.map((r) => [r.id, r.study?.source, r.name]));

  const c = state.connections;
  const keySig = JSON.stringify([c.keys.openai ?? "", c.keys.gemini ?? "", c.keys.iagen ?? "", c.imageDefault, c.geminiModel, c.openaiModel, c.openaiQuality]);
  useEffect(() => {
    if (!ready || !token || pushedKeys === token + keySig) return;
    const cc = getState().connections;
    fetch("/api/keys", {
      method: "POST",
      headers: { ...auth(token), "Content-Type": "application/json" },
      body: JSON.stringify({ keys: { openai: cc.keys.openai ?? "", gemini: cc.keys.gemini ?? "", iagen: cc.keys.iagen ?? "" }, cfg: { imageDefault: cc.imageDefault, geminiModel: cc.geminiModel, openaiModel: cc.openaiModel, openaiQuality: cc.openaiQuality } }),
    }).then((r) => { if (r.ok) pushedKeys = token + keySig; }).catch(() => {});
  }, [ready, token, keySig]);

  useEffect(() => {
    if (!ready || !token) return;
    let stop = false;
    async function run() {
      try {
        const sentDeleted = getState().deletedProjects;
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ references: getState().references, projects: getState().projects.map((p) => ({ ...p, slides: p.slides.map((x) => ({ ...x, bgImage: undefined })) })), deleted: sentDeleted }),
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
        // imagens geradas no servidor: baixa as que faltam neste navegador
        const im = j.imagens as { keys: { openai: boolean; gemini: boolean; iagen?: boolean; magnific?: boolean }; tools?: Record<string, string[]>; errors?: Record<string, string>; status: NonNullable<ReturnType<typeof getState>["imagens"]>["status"]; ready: [string, string][] } | undefined;
        if (im) {
          for (const [cid, sid] of im.ready) {
            const p = getState().projects.find((x) => x.id === cid);
            const sl = p?.slides.find((x) => x.id === sid);
            if (!sl || sl.bgImage || fetching.has(sid)) continue;
            fetching.add(sid);
            fetch(`/api/slide-image?c=${cid}&s=${sid}`, { headers: auth(token) })
              .then((r) => r.json())
              .then(async (d) => {
                if (!d.image) return;
                const img = await fitImage(d.image);
                setState((s) => ({ ...s, projects: s.projects.map((pp) => (pp.id !== cid ? pp : { ...pp, slides: pp.slides.map((x) => (x.id === sid && !x.bgImage ? { ...x, bgImage: img, bgDim: x.bgDim ?? 0.45 } : x)) })) }));
              })
              .catch(() => {})
              .finally(() => fetching.delete(sid));
          }
          const prev = JSON.stringify(getState().imagens ?? null);
          const next = { keys: im.keys, status: im.status, tools: im.tools, errors: im.errors };
          if (prev !== JSON.stringify(next)) setState((s) => ({ ...s, imagens: next }));
        }
        setState((s) => {
          const studies = new Map<string, Reference["study"]>((j.studies ?? []).map((x: { id: string; study: Reference["study"] }) => [x.id, x.study]));
          let changed = s.claude.syncError !== undefined || s.claude.used !== !!j.used;
          const references = s.references.map((r) => {
            const st = studies.get(r.id);
            if (st && r.study?.at !== st.at) { changed = true; return { ...r, study: st }; }
            return r;
          });
          const gone = new Set(s.deletedProjects);
          const server = (j.contents ?? []) as Project[];
          const local = new Map(s.projects.map((p) => [p.id, p]));
          const incoming = server.filter((p) => !local.has(p.id) && !gone.has(p.id));
          const replaced = new Map(server.filter((p) => local.has(p.id) && (p.updatedAt ?? 0) > local.get(p.id)!.updatedAt).map((p) => [p.id, p]));
          if (incoming.length || replaced.size) changed = true;
          if (sentDeleted.length) changed = true;
          const keepImg = (p: Project): Project => {
            const old = local.get(p.id);
            const bg = new Map((old?.slides ?? []).filter((x) => x.bgImage).map((x) => [x.id, x.bgImage]));
            return { ...p, slides: p.slides.map((x) => (bg.has(x.id) ? { ...x, bgImage: bg.get(x.id) } : x)) };
          };
          const projects = [...incoming, ...s.projects.map((p) => (replaced.has(p.id) ? keepImg(replaced.get(p.id)!) : p))];
          const styles = s.styles.map((st) => {
            const r = remote.get(st.id) as Partial<Style> | undefined;
            if (r && typeof r.rev === "number" && r.rev > st.rev && r.status) {
              changed = true;
              return { ...st, status: r.status, guide: r.guide ?? st.guide, fonts: r.fonts ?? st.fonts, palette: r.palette ?? [], components: r.components ?? [], recreated: r.recreated ?? [], rev: r.rev };
            }
            return st;
          });
          if (!changed) return s;
          return { ...s, styles, references, projects, deletedProjects: s.deletedProjects.filter((x) => !sentDeleted.includes(x)), claude: { ...s.claude, used: !!j.used, syncError: undefined } };
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
