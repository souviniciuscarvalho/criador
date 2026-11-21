"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSync } from "@/lib/sync";
import { BookMarked, PenSquare, Plug } from "lucide-react";

const sections = [
  { title: "Criar", items: [{ href: "/criar", label: "Criar", icon: PenSquare }] },
  {
    title: "Seu material",
    items: [
      { href: "/referencias", label: "Referências", icon: BookMarked },
      { href: "/conexoes", label: "Conexões", icon: Plug },
    ],
  },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  useSync();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-line bg-bg md:w-56 md:border-r md:border-b-0">
        <div className="flex items-center gap-2 px-5 py-4 text-lg font-bold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-white text-sm font-extrabold text-black">C</span>
          Criador
        </div>
        <nav className="flex gap-4 px-3 pb-3 md:flex-col md:gap-5">
          {sections.map((sec) => (
            <div key={sec.title}>
              <div className="px-3 pb-1 text-[11px] font-medium tracking-widest text-muted uppercase">{sec.title}</div>
              <div className="flex gap-1 md:flex-col">
                {sec.items.map(({ href, label, icon: Icon }) => {
                  const on = path.startsWith(href);
                  return (
                    <Link key={href} href={href}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${on ? "bg-panel2 text-fg" : "text-muted hover:text-fg"}`}>
                      <Icon size={17} /> {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-10">{children}</main>
    </div>
  );
}
