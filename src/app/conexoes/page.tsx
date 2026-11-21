"use client";
import { ExternalLink } from "lucide-react";
import { useApp, setState } from "@/lib/store";
import { Card, CopyButton, Status, Steps } from "@/components/ConnUI";

function genToken() {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function ClaudePage() {
  const { state, ready } = useApp();
  if (!ready) return null;
  const origin = window.location.origin;

  const { token, createdAt } = state.claude;
  const url = token ? `${origin}/api/mcp/${token}` : "";
  const masked = token ? `${origin}/api/mcp/••••••••` : "";
  const when = createdAt ? new Date(createdAt).toLocaleString("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  const gen = () => setState((s) => ({ ...s, claude: { token: genToken(), createdAt: Date.now(), used: false } }));

  return (
    <>
      <div>
        <h2 className="text-xl font-semibold">O Claude escreve os seus conteúdos</h2>
        <p className="mt-1 text-sm text-muted">Textos de carrosséis, posts de feed e stories, no seu estilo e usando as suas referências.</p>
      </div>

      <Card
        title="Conversando no Claude"
        desc="Você pede no claude.ai (ou no app do Claude) e o conteúdo aparece aqui. Usa o seu plano do Claude, sem chave e sem custo extra."
        status={<Status ok={!!state.claude.used}>{!token ? "falta gerar o link" : state.claude.syncError ? "servidor sem banco" : state.claude.used ? "conectado" : "falta adicionar no Claude"}</Status>}
      />

      <Card title="Passo a passo">
        <Steps items={[
          <div key="1" className="space-y-3">
            <p><b className="text-fg">Gere o seu link.</b> É o endereço que liga o Claude ao Criador. Clique em Gerar e depois em Copiar.</p>
            {token && <p>Link criado em {when}. Perdeu o link? Gere um novo: o antigo para de funcionar.</p>}
            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={() => { if (!token || confirm("O link antigo vai parar de funcionar. Gerar um novo?")) gen(); }}>
                {token ? "Gerar link novo" : "Gerar link"}
              </button>
              {token && <CopyButton text={url} label="Copiar link" />}
              {token && <button className="btn btn-ghost" onClick={() => confirm("Desligar a conexão?") && setState((s) => ({ ...s, claude: { token: "", createdAt: 0 } }))}>Desligar</button>}
            </div>
            {token && (
              <div>
                <span className="label">Seu link do Criador</span>
                <code className="block overflow-x-auto rounded-lg bg-panel2 px-3 py-2 text-xs">{masked}</code>
                <p className="mt-1 text-xs">É como uma senha: só você usa.</p>
              </div>
            )}
          </div>,
          <div key="2" className="space-y-2">
            <p><b className="text-fg">Abra os Conectores do Claude.</b> No Claude, vá em Configurações → Conectores (Settings → Connectors).</p>
            <a className="btn btn-ghost" href="https://claude.ai/settings/connectors" target="_blank" rel="noreferrer">Abrir os Conectores do Claude <ExternalLink size={14} /></a>
          </div>,
          <p key="3"><b className="text-fg">Clique em “Adicionar conector personalizado”</b> (Add custom connector), na própria página de Conectores.</p>,
          <p key="4"><b className="text-fg">Preencha o nome e cole o link.</b> No nome, escreva Criador. Na URL, cole o link do passo 1. Clique em Adicionar.</p>,
          <p key="5"><b className="text-fg">Ligue o Criador na conversa.</b> Abra uma conversa nova, clique no botão de ferramentas e confira se o Criador está ligado. Na primeira vez, clique em Permitir.</p>,
          <div key="6" className="space-y-1">
            <p><b className="text-fg">Pronto! Agora é só pedir.</b> Exemplos:</p>
            <p>“Faz um carrossel sobre preço de site no meu estilo.”</p>
            <p>“Cria um post de feed sobre [tema], usando as minhas referências de [nicho].”</p>
          </div>,
        ]} />
      </Card>

      {state.claude.syncError && (
        <div className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
          <b className="text-fg">Servidor sem banco:</b> {state.claude.syncError}
        </div>
      )}

      <Card title="Para gastar menos do seu limite do Claude">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Abra uma conversa nova para cada conteúdo.</li>
          <li>Aprove o texto antes de pedir o visual.</li>
          <li>Deixe as imagens para o fim, quando o texto já estiver certo.</li>
        </ul>
      </Card>
    </>
  );
}
