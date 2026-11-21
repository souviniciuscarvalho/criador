import type { Reference, Study } from "./types";

// Estudo local e simples (sem IA): extrai sinais do texto cadastrado.
// O estudo profundo é feito pelo Claude quando a conexão estiver ativa.
export function studyLocal(r: Pick<Reference, "notes" | "kind" | "niche" | "images">): Study {
  const t = r.notes.trim();
  const first = t.split(/\n|(?<=[.!?])\s/)[0] ?? "";
  const words = t ? t.split(/\s+/).length : 0;
  const tags: string[] = [];
  if (r.niche) tags.push(r.niche);
  tags.push(r.kind);
  if (/\?/.test(first)) tags.push("gancho em pergunta");
  if (/\d/.test(first)) tags.push("gancho com número");
  if (/\b(voc[êe]|seu|sua)\b/i.test(t)) tags.push("fala direto com o leitor");
  if (/\b(salve|compartilhe|comente|siga|clique|link na bio)\b/i.test(t)) tags.push("tem CTA");
  if (/\n\s*(\d+[.)]|[-•])/.test(t)) tags.push("estrutura em lista");
  if (words > 120) tags.push("texto longo");
  else if (words > 0 && words < 40) tags.push("texto curto");
  const summary = t
    ? `Abre com: “${first.slice(0, 120)}”. ${words} palavras, ${r.images.length} imagem(ns).`
    : `Sem texto cadastrado — ${r.images.length} imagem(ns). Adicione o texto para um estudo melhor.`;
  return { summary, tags: [...new Set(tags)], source: "local", at: Date.now() };
}
