// Cliente MCP mínimo (HTTP) usado para gerar imagens no IA Gen e no Magnific.
type Json = Record<string, unknown>;
type Tool = { name: string; description?: string; inputSchema?: { properties?: Record<string, Json>; required?: string[] } };

async function rpc(url: string, bearer: string, body: Json, session?: string) {
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(session ? { "Mcp-Session-Id": session } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", ...body }),
  });
  const sid = r.headers.get("mcp-session-id") ?? session;
  const raw = await r.text();
  if (r.status === 401 || r.status === 403) throw new Error("O serviço recusou o acesso. Conecte de novo em Conexões → Imagens.");
  if (!r.ok && !raw) throw new Error(`O serviço respondeu ${r.status}`);
  let msg: Json | null = null;
  if (raw.trim()) {
    const txt = raw.includes("data:") && !raw.trim().startsWith("{") ? raw.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).filter(Boolean).pop() ?? "" : raw;
    try { msg = JSON.parse(txt); } catch { /* sem corpo JSON */ }
  }
  if (msg && (msg as { error?: { message?: string } }).error) throw new Error(String((msg as { error: { message?: string } }).error.message ?? "erro do serviço"));
  return { msg, sid, status: r.status };
}

export async function connect(url: string, bearer: string) {
  const init = await rpc(url, bearer, { id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "Criador", version: "0.1.0" } } });
  const sid = init.sid ?? undefined;
  await rpc(url, bearer, { method: "notifications/initialized" }, sid).catch(() => {});
  const list = await rpc(url, bearer, { id: 2, method: "tools/list", params: {} }, sid);
  const tools = ((list.msg as { result?: { tools?: Tool[] } } | null)?.result?.tools ?? []) as Tool[];
  const call = async (name: string, args: Json) => {
    const r = await rpc(url, bearer, { id: Date.now(), method: "tools/call", params: { name, arguments: args } }, sid);
    return (r.msg as { result?: { content?: { type: string; text?: string; data?: string; mimeType?: string }[]; isError?: boolean } } | null)?.result ?? {};
  };
  return { tools, call };
}

const score = (t: Tool) => {
  const n = `${t.name} ${t.description ?? ""}`.toLowerCase();
  let s = 0;
  if (/(generat|gerar|create|criar|text.?to.?image|imagem|image)/.test(t.name.toLowerCase())) s += 3;
  if (/image|imagem/.test(n)) s += 2;
  if (/(edit|upscale|video|remove|status|list|get_|check|result|search|icon|vector|mockup|lip|audio|music)/.test(t.name.toLowerCase())) s -= 5;
  if (/(prompt|text)/.test(JSON.stringify(t.inputSchema?.properties ?? {}).toLowerCase())) s += 2;
  return s;
};

export function pickImageTool(tools: Tool[]): Tool | null {
  const ranked = [...tools].sort((a, b) => score(b) - score(a));
  return ranked.length && score(ranked[0]) > 2 ? ranked[0] : null;
}

function nearest(options: string[], w: number, h: number) {
  const r = w / h;
  const parse = (o: string) => { const m = o.match(/(\d+(?:\.\d+)?)\s*[:x×/]\s*(\d+(?:\.\d+)?)/); return m ? +m[1] / +m[2] : NaN; };
  const ok = options.filter((o) => !Number.isNaN(parse(o)));
  return ok.length ? ok.sort((a, b) => Math.abs(parse(a) - r) - Math.abs(parse(b) - r))[0] : options[0];
}

function buildArgs(tool: Tool, prompt: string, w: number, h: number): Json {
  const props = tool.inputSchema?.properties ?? {};
  const args: Json = {};
  let placed = false;
  for (const [k, def] of Object.entries(props)) {
    const lk = k.toLowerCase();
    const d = def as { type?: string; enum?: unknown[]; default?: unknown; items?: Json };
    if (!placed && /^(prompt|text|description|query|instruction)/.test(lk)) { args[k] = prompt; placed = true; continue; }
    if (/(aspect|ratio|proporc|size|dimension|format)/.test(lk) && Array.isArray(d.enum)) { args[k] = nearest(d.enum.map(String), w, h); continue; }
    if (/(aspect|ratio)/.test(lk) && d.type === "string") { args[k] = w === h ? "1:1" : h > w ? (w / h < 0.7 ? "9:16" : "4:5") : "16:9"; continue; }
    if (/^(width)$/.test(lk)) { args[k] = w; continue; }
    if (/^(height)$/.test(lk)) { args[k] = h; continue; }
    if (/(num|count|quantity|n$|images?$)/.test(lk) && (d.type === "integer" || d.type === "number")) { args[k] = 1; continue; }
  }
  for (const k of tool.inputSchema?.required ?? []) {
    if (k in args) continue;
    const d = props[k] as { type?: string; enum?: unknown[]; default?: unknown } | undefined;
    if (d?.default !== undefined) args[k] = d.default;
    else if (d?.enum?.length) args[k] = d.enum[0];
    else if (d?.type === "string") args[k] = prompt;
    else if (d?.type === "integer" || d?.type === "number") args[k] = 1;
    else if (d?.type === "boolean") args[k] = false;
  }
  if (!placed) { const first = Object.keys(props).find((k) => (props[k] as { type?: string }).type === "string"); if (first) args[first] = prompt; }
  return args;
}

async function toDataUrl(u: string): Promise<string | null> {
  try {
    const r = await fetch(u);
    if (!r.ok) return null;
    const type = r.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return null;
    return `data:${type};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
  } catch { return null; }
}

type Result = { content?: { type: string; text?: string; data?: string; mimeType?: string }[]; isError?: boolean };

async function extract(res: Result): Promise<{ image?: string; text: string }> {
  const img = res.content?.find((c) => c.type === "image" && c.data);
  if (img) return { image: `data:${img.mimeType ?? "image/png"};base64,${img.data}`, text: "" };
  const text = (res.content ?? []).map((c) => c.text ?? "").join("\n");
  const urls = [...text.matchAll(/https?:\/\/[^\s"'\\)<>\]]+/g)].map((m) => m[0]);
  const pref = urls.filter((u) => /\.(png|jpe?g|webp)(\?|$)/i.test(u)).concat(urls);
  for (const u of pref) { const d = await toDataUrl(u); if (d) return { image: d, text }; }
  return { text };
}

export type Gen = { image?: string; tools: string[]; error?: string };

export async function generateViaMcp(url: string, bearer: string, prompt: string, w: number, h: number): Promise<Gen> {
  const { tools, call } = await connect(url, bearer);
  const names = tools.map((t) => t.name);
  const tool = pickImageTool(tools);
  if (!tool) return { tools: names, error: `Não achei a ferramenta de gerar imagem (ferramentas: ${names.join(", ") || "nenhuma"}).` };
  let res = (await call(tool.name, buildArgs(tool, prompt, w, h))) as Result;
  let out = await extract(res);
  if (res.isError) return { tools: names, error: out.text.slice(0, 300) || "O serviço recusou o pedido." };
  if (out.image) return { tools: names, image: out.image };
  // trabalho assíncrono: procura uma ferramenta de status e consulta
  const idMatch = out.text.match(/"?(?:task_id|taskId|generation_id|job_id|id)"?\s*[:=]\s*"?([A-Za-z0-9_-]{6,})"?/);
  const statusTool = tools.find((t) => /(status|result|get_task|check|poll|get_gen)/i.test(t.name) && !/list/i.test(t.name));
  if (idMatch && statusTool) {
    const idKey = Object.keys(statusTool.inputSchema?.properties ?? {}).find((k) => /id/i.test(k)) ?? "task_id";
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      res = (await call(statusTool.name, { [idKey]: idMatch[1] })) as Result;
      out = await extract(res);
      if (out.image) return { tools: names, image: out.image };
      if (/(fail|error|erro)/i.test(out.text) && !/(in_progress|pending|processing)/i.test(out.text)) return { tools: names, error: out.text.slice(0, 300) };
    }
  }
  return { tools: names, error: `A resposta não trouxe imagem: ${out.text.slice(0, 300)}` };
}
