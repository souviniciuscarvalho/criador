"use client";
import { useEffect, useState } from "react";
import { useApp, setState } from "@/lib/store";

// Abre o Criador em outro navegador com o mesmo link: /entrar#<link>
export default function Entrar() {
  const { ready } = useApp();
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!ready) return;
    const t = window.location.hash.slice(1).match(/[a-f0-9]{32,128}/)?.[0];
    if (!t) { Promise.resolve().then(() => setErr("Link de acesso inválido. Copie de novo em Conexões → Claude.")); return; }
    setState((s) => (s.claude.token === t ? s : { ...s, claude: { token: t, createdAt: Date.now(), used: false } }));
    window.location.replace("/conexoes");
  }, [ready]);
  return <p className="p-8 text-sm text-muted">{err || "Entrando…"}</p>;
}
