"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/store";

export default function ConexoesLayout({ children }: LayoutProps<"/conexoes">) {
  const path = usePathname();
  const { state } = useApp();
  const c = state.connections;
  const k = c.keys;
  const tabs = [
    { href: "/conexoes", label: "Claude", ok: !!state.claude.token },
    { href: "/conexoes/imagens", label: "Imagens", ok: !!(k.iagen || k.openai || k.gemini) },
    { href: "/conexoes/integracoes", label: "Integrações", ok: !!(k.figma || k.producthunt || k.redditId) },
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">Conexões</h1>
      <p className="mt-2 text-muted">Ligue aqui o Claude, a IA das imagens e as integrações. Cada aba tem o passo a passo.</p>
      <div className="mt-6 flex gap-6 border-b border-line">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href}
            className={`-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm font-medium ${path === t.href ? "border-white text-fg" : "border-transparent text-muted hover:text-fg"}`}>
            {t.label} <span className={`dot ${t.ok ? "dot-ok" : "dot-warn"}`} />
          </Link>
        ))}
      </div>
      <div className="mt-8 space-y-5">{children}</div>
    </div>
  );
}
