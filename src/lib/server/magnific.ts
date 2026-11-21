import { createHash, randomBytes } from "node:crypto";
import { kvDelete, kvGet, kvSet } from "./db";
import { seal, unseal } from "./crypto";

const AUTH = "https://auth.magnific.com/realms/mcp";
export const MAGNIFIC_MCP = "https://mcp.magnific.com";
const SCOPE = "openid profile email mcp:custom-audience";
const b64 = (b: Buffer) => b.toString("base64url");

// Passo 1: registra o Criador como aplicativo no Magnific e devolve o endereço de login.
export async function startAuth(ws: string, origin: string): Promise<string> {
  const redirect = `${origin}/api/magnific/retorno`;
  const reg = await fetch(`${AUTH}/clients-registrations/openid-connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: "Criador", redirect_uris: [redirect], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none", scope: SCOPE }),
  });
  const c = await reg.json().catch(() => ({}));
  if (!reg.ok || !c.client_id) throw new Error("O Magnific não aceitou o registro do Criador.");
  const verifier = b64(randomBytes(32));
  const state = b64(randomBytes(18));
  await kvSet("_oauth", state, seal(JSON.stringify({ ws, client_id: c.client_id, verifier, redirect, at: Date.now() })));
  const q = new URLSearchParams({
    response_type: "code", client_id: c.client_id, redirect_uri: redirect, scope: SCOPE, state,
    code_challenge: b64(createHash("sha256").update(verifier).digest()), code_challenge_method: "S256", resource: MAGNIFIC_MCP,
  });
  return `${AUTH}/protocol/openid-connect/auth?${q}`;
}

type Tok = { access: string; refresh?: string; exp: number; client_id: string };

// Passo 2: o Magnific volta com um código; troca por acesso e guarda cifrado.
export async function finishAuth(code: string, state: string): Promise<{ ws: string } | null> {
  const raw = await kvGet("_oauth", state);
  const st = raw ? (JSON.parse(unseal(raw) ?? "null") as { ws: string; client_id: string; verifier: string; redirect: string; at: number } | null) : null;
  await kvDelete("_oauth", state).catch(() => {});
  if (!st || Date.now() - st.at > 15 * 60_000) return null;
  const r = await fetch(`${AUTH}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: st.redirect, client_id: st.client_id, code_verifier: st.verifier }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) return null;
  const tok: Tok = { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in ?? 300) * 1000, client_id: st.client_id };
  await kvSet(st.ws, "mg:tok", seal(JSON.stringify(tok)));
  return { ws: st.ws };
}

export async function magnificToken(ws: string): Promise<string | null> {
  const raw = await kvGet(ws, "mg:tok");
  const tok = raw ? (JSON.parse(unseal(raw) ?? "null") as Tok | null) : null;
  if (!tok) return null;
  if (tok.exp > Date.now() + 60_000) return tok.access;
  if (!tok.refresh) return null;
  const r = await fetch(`${AUTH}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tok.refresh, client_id: tok.client_id }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) return null;
  const next: Tok = { access: j.access_token, refresh: j.refresh_token ?? tok.refresh, exp: Date.now() + (j.expires_in ?? 300) * 1000, client_id: tok.client_id };
  await kvSet(ws, "mg:tok", seal(JSON.stringify(next)));
  return next.access;
}
