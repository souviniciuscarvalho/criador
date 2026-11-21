import { createHash } from "node:crypto";

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dbConfigured = () => !!(URL_ && KEY);
export const workspaceOf = (token: string) => createHash("sha256").update(token).digest("hex");
export const validToken = (t: unknown): t is string => typeof t === "string" && /^[a-f0-9]{32,128}$/.test(t);

async function rest(path: string, init: RequestInit & { prefer?: string } = {}) {
  const { prefer, ...rest } = init;
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    ...rest,
    cache: "no-store",
    headers: {
      apikey: KEY!,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const q = (s: string) => encodeURIComponent(s);

export async function touch(ws: string) {
  await rest("criador_workspaces?on_conflict=workspace", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: JSON.stringify([{ workspace: ws, last_used_at: new Date().toISOString() }]),
  });
}

export async function wasUsed(ws: string): Promise<boolean> {
  const r = await rest(`criador_workspaces?workspace=eq.${q(ws)}&select=last_used_at`);
  return !!r?.[0]?.last_used_at;
}

export async function listRows<T>(table: "criador_references" | "criador_contents", ws: string): Promise<T[]> {
  const r = await rest(`${table}?workspace=eq.${q(ws)}&select=data&order=${table === "criador_contents" ? "created_at" : "updated_at"}.desc&limit=500`);
  return (r ?? []).map((x: { data: T }) => x.data);
}

export async function upsertRows(table: "criador_references" | "criador_contents", ws: string, items: { id: string }[], extra: Record<string, unknown> = {}) {
  if (!items.length) return;
  await rest(`${table}?on_conflict=workspace,id`, {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: JSON.stringify(items.map((d) => ({ workspace: ws, id: d.id, data: d, ...extra }))),
  });
}

export async function deleteMissing(table: "criador_references", ws: string, keepIds: string[]) {
  const filter = keepIds.length ? `&id=not.in.(${keepIds.map((i) => `"${i.replace(/"/g, "")}"`).join(",")})` : "";
  await rest(`${table}?workspace=eq.${q(ws)}${filter}`, { method: "DELETE", prefer: "return=minimal" });
}
