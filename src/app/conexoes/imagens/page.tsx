"use client";
import { useEffect, useState } from "react";
import { useApp, setState } from "@/lib/store";
import { Card, KeyField, Status, Steps } from "@/components/ConnUI";
import type { Connections } from "@/lib/types";

const ext = (href: string, t: string) => <a className="text-fg underline" href={href} target="_blank" rel="noreferrer">{t} ↗</a>;

export default function ImagensPage() {
  const { state, ready } = useApp();
  const [mg, setMg] = useState("");
  useEffect(() => {
    if (!ready) return;
    const m = new URLSearchParams(window.location.search).get("magnific");
    if (!m) return;
    window.history.replaceState(null, "", "/conexoes/imagens");
    if (m === "ok") setState((s) => ({ ...s, connections: { ...s.connections, imageDefault: "magnific" } }));
    Promise.resolve().then(() => setMg(m === "ok" ? "Magnific conectado e escolhido como padrão das imagens." : m === "cancelado" ? "Conexão cancelada." : "Não consegui conectar o Magnific. Tente de novo."));
  }, [ready]);
  if (!ready) return null;
  const token = state.claude.token;
  const im = state.imagens;
  async function connectMagnific() {
    if (!token) { setMg("Ligue o Claude primeiro (aba Claude) para ter o seu link."); return; }
    setMg("");
    const r = await fetch("/api/magnific/iniciar", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMg(j.error ?? "Falha ao iniciar."); return; }
    window.location.href = j.url;
  }
  async function disconnectMagnific() {
    if (token) await fetch("/api/magnific/desconectar", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    setState((s) => ({ ...s, imagens: s.imagens ? { ...s.imagens, keys: { ...s.imagens.keys, magnific: false } } : s.imagens, connections: { ...s.connections, imageDefault: s.connections.imageDefault === "magnific" ? "" : s.connections.imageDefault } }));
  }
  const c = state.connections;
  const k = c.keys;
  const patch = (p: Partial<Connections>) => setState((s) => ({ ...s, connections: { ...s.connections, ...p } }));
  const badge = (id: Connections["imageDefault"], on: boolean) =>
    on ? (
      c.imageDefault === id
        ? <span className="chip chip-on">Padrão das imagens</span>
        : <button className="chip" onClick={() => patch({ imageDefault: id })}>Tornar padrão</button>
    ) : null;

  return (
    <>
      <div>
        <h2 className="text-xl font-semibold">IA das imagens</h2>
        <p className="mt-1 text-sm text-muted">Escolha quem vai fazer as imagens. Conecte uma ou mais; a que tiver o selo “Padrão das imagens” é a que faz.</p>
      </div>

      <h3 className="text-xs font-medium tracking-widest text-muted uppercase">Com a sua conta (o mais fácil)</h3>
      <Card title="IA Gen" desc="Usa os créditos da sua conta do IA Gen. Você só cola a sua chave uma vez."
        status={<div className="flex items-center gap-3">{badge("iagen", !!k.iagen)}<Status ok={!!k.iagen} /></div>}>
        <Steps items={[
          <>Abra o IA Gen na página Conectar agente. {ext("https://app.iamaisgen.com", "Abrir o IA Gen")}</>,
          <>Role até o fim e abra “Para programadores: Claude Code no terminal ou plugin do Figma”.</>,
          <>Em Sua chave, clique em Copiar. A chave começa com <code>iamg_</code>.</>,
          <>Volte aqui, cole no campo abaixo e clique em Salvar.</>,
        ]} />
        <KeyField provider="iagen" placeholder="iamg_…" test={(v) => v.startsWith("iamg_")} />
      </Card>

      <Card title="Magnific" desc="Usa os créditos da sua conta do Magnific (antigo Freepik). Não tem chave: você entra com a sua conta."
        status={<div className="flex items-center gap-3">{badge("magnific", !!im?.keys.magnific)}<Status ok={!!im?.keys.magnific} /></div>}>
        <Steps items={[
          <>Clique em Conectar com o Magnific, aqui embaixo.</>,
          <>O Magnific mostra o aviso <i>Unverified application</i> com o endereço do Criador. É só o Magnific avisando que o Criador vai usar a sua conta. Clique em <b>I recognise it, continue</b>.</>,
          <>Entre com a sua conta do Magnific (o mesmo e-mail e senha de sempre).</>,
          <>Pronto: você volta para cá com o Magnific conectado e escolhido como padrão das imagens.</>,
        ]} />
        <div className="flex gap-2">
          <button className="btn" onClick={connectMagnific}>{im?.keys.magnific ? "Conectar de novo" : "Conectar com o Magnific"}</button>
          {im?.keys.magnific && <button className="btn btn-ghost" onClick={disconnectMagnific}>Desconectar</button>}
        </div>
        {mg && <p className="text-sm text-muted">{mg}</p>}
      </Card>

      {(im?.tools || im?.errors) && Object.keys({ ...im.tools, ...im.errors }).length > 0 && (
        <Card title="Último teste de imagem" desc="Aparece depois da primeira imagem gerada por IA Gen ou Magnific.">
          {Object.entries({ ...im.tools }).map(([k, v]) => <p key={k} className="text-xs text-muted"><b>{k}</b>: ferramentas {v.join(", ") || "nenhuma"}</p>)}
          {Object.entries({ ...im.errors }).map(([k, v]) => <p key={k} className="text-xs text-[var(--warn)]"><b>{k}</b>: {v}</p>)}
        </Card>
      )}

      <h3 className="pt-2 text-xs font-medium tracking-widest text-muted uppercase">Com chave de API (para quem já tem conta de desenvolvedor)</h3>
      <Card title="OpenAI" desc="A IA de imagem do ChatGPT, pela chave de API. A OpenAI cobra o uso direto de você."
        status={<div className="flex items-center gap-3">{badge("openai", !!k.openai)}<Status ok={!!k.openai} /></div>}>
        <Steps items={[
          <>Entre em {ext("https://platform.openai.com", "platform.openai.com")} e crie a conta.</>,
          <>Em Billing, coloque créditos. A API é cobrada à parte da assinatura do ChatGPT.</>,
          <>Em API keys, clique em Create new secret key e copie. Começa com <code>sk-</code>.</>,
          <>Cole aqui embaixo e clique em Salvar.</>,
        ]} />
        <KeyField provider="openai" placeholder="sk-…" test={(v) => v.startsWith("sk-")} />
      </Card>

      <Card title="Google Gemini" desc="A IA de imagem do Google, pela chave de API. Tem uso grátis com limite por dia."
        status={<div className="flex items-center gap-3">{badge("gemini", !!k.gemini)}<Status ok={!!k.gemini} /></div>}>
        <Steps items={[
          <>Entre em {ext("https://aistudio.google.com", "aistudio.google.com")} com a sua conta Google.</>,
          <>Clique em Get API key e depois em Create API key. Começa com <code>AIza</code>.</>,
          <>Cole aqui embaixo e clique em Salvar.</>,
        ]} />
        <KeyField provider="gemini" placeholder="AIza…" test={(v) => v.startsWith("AIza")} />
      </Card>

      <h3 className="pt-2 text-xs font-medium tracking-widest text-muted uppercase">Modelos de imagem</h3>
      <Card title="Usados quando a OpenAI ou o Gemini fazem as imagens">
        <div className="grid gap-3 sm:grid-cols-3">
          <div><span className="label">Gemini</span>
            <select className="input" value={c.geminiModel} onChange={(e) => patch({ geminiModel: e.target.value })}>
              <option value="gemini-3.1-flash-image">Gemini 3.1 Flash Image (padrão)</option>
              <option value="gemini-3.1-flash-lite-image">Gemini 3.1 Flash Lite Image (mais barato)</option>
              <option value="gemini-3-pro-image">Gemini 3 Pro Image (mais caprichado)</option>
              <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image (antigo)</option>
            </select></div>
          <div><span className="label">OpenAI — modelo</span>
            <select className="input" value={c.openaiModel} onChange={(e) => patch({ openaiModel: e.target.value })}>
              <option value="gpt-image-2.5-flare">GPT Image 2.5 Flare (rápido)</option>
              <option value="gpt-image-2.5-sunburst">GPT Image 2.5 Sunburst (detalhado)</option>
              <option value="gpt-image-2">GPT Image 2</option>
            </select></div>
          <div><span className="label">OpenAI — qualidade</span>
            <select className="input" value={c.openaiQuality} onChange={(e) => patch({ openaiQuality: e.target.value })}>
              <option value="low">Baixa (mais barata)</option>
              <option value="medium">Média (padrão)</option>
              <option value="high">Alta</option>
            </select></div>
        </div>
        <p className="text-xs text-muted">Salvo automaticamente.</p>
      </Card>
    </>
  );
}
