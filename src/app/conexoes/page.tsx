"use client";
import { Plug, CheckCircle2, CircleDashed } from "lucide-react";
import { useApp, setState } from "@/lib/store";

export default function ConexoesPage() {
  const { state, ready } = useApp();
  if (!ready) return null;
  const c = state.claude;
  const set = (patch: Partial<typeof c>) => setState((s) => ({ ...s, claude: { ...s.claude, ...patch } }));
  const configured = c.endpoint.trim() && c.token.trim();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Conexões</h1>
        <p className="text-sm text-muted">Integre o Criador a outras ferramentas.</p>
      </div>

      <section className="space-y-3 rounded-xl border border-line bg-panel p-5">
        <div className="flex items-center gap-2">
          <Plug size={18} />
          <h2 className="font-semibold">Claude Code</h2>
          <span className="chip ml-auto flex items-center gap-1">
            {c.enabled ? <><CheckCircle2 size={13} /> Ativa</> : <><CircleDashed size={13} /> Inativa</>}
          </span>
        </div>
        <p className="text-sm text-muted">
          Usada para estudar referências e gerar textos. O formato exato da conexão será definido depois — estes campos são provisórios.
        </p>
        <div><span className="label">Endpoint</span><input className="input" placeholder="https://..." value={c.endpoint} onChange={(e) => set({ endpoint: e.target.value })} /></div>
        <div><span className="label">Token</span><input className="input" type="password" value={c.token} onChange={(e) => set({ token: e.target.value })} /></div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={c.enabled} disabled={!configured} onChange={(e) => set({ enabled: e.target.checked })} />
          Ativar conexão
        </label>
        <p className="text-xs text-muted">Os dados ficam só neste navegador (localStorage).</p>
      </section>

      <section className="rounded-xl border border-dashed border-line p-5 text-sm text-muted">
        Outras conexões (redes sociais, armazenamento, etc.) entram aqui depois.
      </section>
    </div>
  );
}
