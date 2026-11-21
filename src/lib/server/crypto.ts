import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Chave de cifra derivada do segredo do servidor; as chaves de IA nunca ficam em texto puro no banco.
const secret = () => createHash("sha256").update("criador-keys:" + (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")).digest();

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", secret(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function unseal(blob: string): string | null {
  try {
    const [iv, tag, enc] = blob.split(".").map((x) => Buffer.from(x, "base64"));
    const d = createDecipheriv("aes-256-gcm", secret(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
