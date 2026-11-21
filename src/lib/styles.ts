"use client";
import { getState, setState } from "./store";
import { uid, type Style } from "./types";

export function shrinkImage(file: File, max = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => reject(new Error("imagem inválida"));
    img.src = url;
  });
}

export function newStyle(name: string, prints: string[]): Style {
  return {
    id: uid(), name, prints, status: "novo", guide: "", fonts: { title: "", body: "" },
    palette: [], components: [], recreated: [], rev: 0, createdAt: Date.now(),
  };
}

const headers = (token: string) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

// Envia (ou atualiza) um estilo no servidor, se houver link do Claude.
export async function pushStyle(id: string, fields: { name?: boolean; guide?: boolean; prints?: boolean }) {
  const { claude, styles } = getState();
  const st = styles.find((s) => s.id === id);
  if (!claude.token || !st) return;
  const body: Record<string, unknown> = { id };
  if (fields.name) body.name = st.name;
  if (fields.guide) body.guide = st.guide;
  if (fields.prints) body.prints = st.prints;
  const res = await fetch("/api/styles", { method: "POST", headers: headers(claude.token), body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "falha ao enviar o estilo");
}

export async function removeStyleRemote(id: string) {
  const { claude } = getState();
  if (!claude.token) return;
  await fetch(`/api/styles?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: headers(claude.token) }).catch(() => {});
}

export function patchStyle(id: string, patch: Partial<Style>) {
  setState((s) => ({ ...s, styles: s.styles.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
}

// reduz uma imagem (arquivo ou data URL) para caber no armazenamento do navegador
export function fitImage(src: File | string, max = 1080): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = typeof src === "string" ? src : URL.createObjectURL(src);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      if (typeof src !== "string") URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => reject(new Error("imagem inválida"));
    img.src = url;
  });
}
