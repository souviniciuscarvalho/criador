import { NextResponse, after } from "next/server";
import { dbConfigured, touch, validToken, workspaceOf } from "@/lib/server/db";
import { callTool, TOOLS } from "@/lib/server/mcp";
import { prepare } from "@/lib/server/imagegen";

// Servidor MCP (Streamable HTTP, sem sessão): o Claude chama este endereço.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

async function handle(ws: string, m: Rpc) {
  if (m.id === undefined) return null; // notificação
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id: m.id, result });
  const err = (code: number, message: string) => ({ jsonrpc: "2.0", id: m.id, error: { code, message } });
  switch (m.method) {
    case "initialize":
      await touch(ws).catch(() => {}); // o Claude acabou de se conectar
      return ok({
        protocolVersion: (m.params?.protocolVersion as string) ?? "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "Criador", version: "0.1.0" },
        instructions: "Conector do Criador: crie posts de feed, stories e carrosséis. Use listar_referencias para se basear nas referências do usuário e criar_conteudo para salvar o resultado.",
      });
    case "ping":
      return ok({});
    case "tools/list":
      await touch(ws).catch(() => {});
      return ok({ tools: TOOLS });
    case "tools/call": {
      try {
        await touch(ws);
        const name = String(m.params?.name);
        const args = (m.params?.arguments as Record<string, unknown>) ?? {};
        const res = await callTool(ws, name, args);
        // visual pronto: gera as imagens das lâminas com a IA de imagem conectada
        if (name === "atualizar_conteudo" && args.etapa === "visual" && typeof args.conteudo_id === "string" && !(res as { isError?: boolean }).isError) {
          const r = await prepare(ws, args.conteudo_id).catch(() => null);
          if (r?.ok) {
            after(r.run);
            (res as { content: { type: string; text?: string }[] }).content.push({ type: "text", text: "As imagens das lâminas estão sendo geradas pela IA de imagem conectada; aparecem no painel em instantes." });
          }
        }
        return ok(res);
      } catch (e) {
        return ok({ content: [{ type: "text", text: `Erro: ${(e as Error).message}` }], isError: true });
      }
    }
    default:
      return err(-32601, "Método não suportado");
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!validToken(token)) return NextResponse.json({ error: "link inválido" }, { status: 404 });
  if (!dbConfigured()) return NextResponse.json({ error: "Supabase não configurado no servidor" }, { status: 503 });
  let body: Rpc | Rpc[];
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON inválido" } }, { status: 400 });
  }
  const ws = workspaceOf(token);
  const out = Array.isArray(body) ? (await Promise.all(body.map((m) => handle(ws, m)))).filter(Boolean) : await handle(ws, body);
  if (out === null || (Array.isArray(out) && !out.length)) return new Response(null, { status: 202 });
  return NextResponse.json(out);
}

export async function GET() {
  return new Response("Método não permitido", { status: 405, headers: { Allow: "POST" } });
}
