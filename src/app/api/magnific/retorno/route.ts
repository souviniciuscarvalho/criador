import { NextResponse } from "next/server";
import { finishAuth } from "@/lib/server/magnific";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const back = (r: string) => NextResponse.redirect(new URL(`/conexoes/imagens?magnific=${r}`, u.origin));
  const code = u.searchParams.get("code");
  const state = u.searchParams.get("state");
  if (!code || !state) return back("cancelado");
  try {
    return back((await finishAuth(code, state)) ? "ok" : "erro");
  } catch {
    return back("erro");
  }
}
