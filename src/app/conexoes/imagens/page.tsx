"use client";
import { useApp, setState } from "@/lib/store";
import { Card, KeyField, Status, Steps } from "@/components/ConnUI";
import type { Connections } from "@/lib/types";

const ext = (href: string, t: string) => <a className="text-fg underline" href={href} target="_blank" rel="noreferrer">{t} ↗</a>;

export default function ImagensPage() {
  const { state, ready } = useApp();
  if (!ready) return null;
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
        status={<Status ok={false}>em breve</Status>}>
        <p className="text-sm text-muted">O login com a conta do Magnific precisa do registro do Criador como aplicativo lá. Fica para a próxima etapa.</p>
        <button className="btn" disabled>Conectar com o Magnific</button>
      </Card>

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
