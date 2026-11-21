import { NextResponse } from "next/server";
import { dbConfigured, touch, validToken, workspaceOf } from "@/lib/server/db";
import { callTool, TOOLS } from "@/lib/server/mcp";

// Servidor MCP (Streamable HTTP, sem sessão): o Claude chama este endereço.
export const dynamic = "force-dynamic";

type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

async function handle(ws: string, m: Rpc) {
  if (m.id === undefined) return null; // notificação
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id: m.id, result });
  const err = (code: number, message: string) => ({ jsonrpc: "2.0", id: m.id, error: { code, message } });
  switch (m.method) {
    case "initialize":
      return ok({
        protocolVersion: (m.params?.protocolVersion as string) ?? "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "Criador", version: "0.1.0" },
        instructions: "Conector do Criador: crie posts de feed, stories e carrosséis. Use listar_referencias para se basear nas referências do usuário e criar_conteudo para salvar o resultado.",
      });
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: TOOLS });
    case "tools/call": {
      try {
        await touch(ws);
        return ok(await callTool(ws, String(m.params?.name), (m.params?.arguments as Record<string, unknown>) ?? {}));
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
