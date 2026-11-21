"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookMarked, PenSquare, Plug } from "lucide-react";

const nav = [
  { href: "/criar", label: "Criar", icon: PenSquare },
  { href: "/referencias", label: "Referências", icon: BookMarked },
  { href: "/conexoes", label: "Conexões", icon: Plug },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-line bg-panel md:w-56 md:border-r md:border-b-0">
        <div className="flex items-center gap-2 px-5 py-4 text-lg font-extrabold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-accent text-sm">C</span>
          Criador
        </div>
        <nav className="flex gap-1 px-3 pb-3 md:flex-col">
          {nav.map(({ href, label, icon: Icon }) => {
            const on = path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  on ? "bg-panel2 text-fg" : "text-muted hover:text-fg"
                }`}
              >
                <Icon size={17} /> {label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
