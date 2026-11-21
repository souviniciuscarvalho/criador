"use client";
import { useApp } from "@/lib/store";
import { Card, KeyField, Status, Steps } from "@/components/ConnUI";

export default function IntegracoesPage() {
  const { state, ready } = useApp();
  if (!ready) return null;
  const k = state.connections.keys;
  return (
    <>
      <h3 className="text-xs font-medium tracking-widest text-muted uppercase">Fontes de conteúdo</h3>
      <p className="-mt-3 text-sm text-muted">Opcionais. Sem elas, o Reddit e o Product Hunt entram pelos feeds públicos, que têm limite de uso.</p>

      <Card title="Reddit — client id" desc="reddit.com/prefs/apps → app do tipo script" status={<Status ok={!!k.redditId} />}>
        <KeyField provider="redditId" placeholder="client id" />
      </Card>
      <Card title="Reddit — client secret" desc="Do mesmo app do Reddit" status={<Status ok={!!k.redditSecret} />}>
        <KeyField provider="redditSecret" placeholder="client secret" />
      </Card>
      <Card title="Product Hunt" desc="producthunt.com/v2/oauth/applications → Developer token" status={<Status ok={!!k.producthunt} />}>
        <KeyField provider="producthunt" placeholder="developer token" />
      </Card>

      <h3 className="pt-2 text-xs font-medium tracking-widest text-muted uppercase">Figma</h3>
      <Card title="Figma (importar modelos)" desc="Para importar modelos e treinar o visual a partir de um arquivo do Figma." status={<Status ok={!!k.figma} />}>
        <Steps items={[
          <>No Figma: foto de perfil → Configurações → Segurança → Tokens de acesso pessoal (com leitura de arquivos).</>,
          <>Copie o token. Ele começa com <code>figd_</code>.</>,
          <>Cole abaixo e clique em Salvar.</>,
        ]} />
        <KeyField provider="figma" placeholder="figd_…" test={(v) => v.startsWith("figd_")} />
      </Card>
      <p className="text-xs text-muted">As chaves ficam salvas só neste navegador, sem criptografia.</p>
    </>
  );
}
