import type { Slide } from "./types";

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const w of para.split(" ")) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxW && line) {
        out.push(line);
        line = w;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

const imgs = new Map<string, HTMLImageElement>();
function getImg(src: string, again: () => void): HTMLImageElement | null {
  let im = imgs.get(src);
  if (!im) {
    im = new Image();
    im.onload = again;
    im.src = src;
    imgs.set(src, im);
  }
  return im.complete && im.naturalWidth ? im : null;
}

export async function preload(slides: Slide[]) {
  await Promise.all(
    slides.filter((s) => s.bgImage).map(
      (s) =>
        new Promise<void>((res) => {
          const im = getImg(s.bgImage!, () => res());
          if (im) res();
          else setTimeout(res, 4000);
        }),
    ),
  );
}

export function drawSlide(canvas: HTMLCanvasElement, s: Slide, width: number, height: number) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, width, height);
  if (s.bgImage) {
    const im = getImg(s.bgImage, () => drawSlide(canvas, s, width, height));
    if (im) {
      const k = Math.max(width / im.naturalWidth, height / im.naturalHeight);
      const w = im.naturalWidth * k;
      const h = im.naturalHeight * k;
      ctx.drawImage(im, (width - w) / 2, (height - h) / 2, w, h);
      ctx.fillStyle = `rgba(0,0,0,${s.bgDim ?? 0.45})`;
      ctx.fillRect(0, 0, width, height);
    }
  }
  const pad = Math.round(width * 0.09);
  const maxW = width - pad * 2;
  const base = "system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
  const font = s.font ? `"${s.font.replace(/"/g, "")}", ${base}` : base;
  ctx.textBaseline = "top";
  ctx.textAlign = s.align;
  const x = s.align === "center" ? width / 2 : pad;

  ctx.font = `800 ${s.titleSize}px ${font}`;
  const tl = wrap(ctx, s.title, maxW);
  const th = tl.length * s.titleSize * 1.12;
  ctx.font = `500 ${s.bodySize}px ${font}`;
  const bl = wrap(ctx, s.body, maxW);
  const bh = bl.length * s.bodySize * 1.4;
  const gap = s.body ? 48 : 0;
  const pieces = s.pieces ?? [];
  const pieceH = 84;
  const piecesH = pieces.length ? pieces.length * (pieceH + 16) + 24 : 0;
  const total = th + gap + bh + 12 + piecesH;
  let y = Math.max(pad, (height - total) / 2);

  ctx.fillStyle = s.accent;
  const barW = 96;
  ctx.fillRect(s.align === "center" ? width / 2 - barW / 2 : pad, y - 36, barW, 10);

  ctx.fillStyle = s.fg;
  ctx.font = `800 ${s.titleSize}px ${font}`;
  for (const l of tl) {
    ctx.fillText(l, x, y);
    y += s.titleSize * 1.12;
  }
  y += gap;
  ctx.globalAlpha = 0.85;
  ctx.font = `500 ${s.bodySize}px ${font}`;
  for (const l of bl) {
    ctx.fillText(l, x, y);
    y += s.bodySize * 1.4;
  }
  ctx.globalAlpha = 1;

  // componentes do estilo (tiras)
  y += 24;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const p of pieces) {
    ctx.font = `800 52px ${font}`;
    const w = Math.min(maxW, ctx.measureText(p.text).width + 64);
    const px = s.align === "center" ? (width - w) / 2 : pad;
    ctx.fillStyle = p.bg;
    ctx.fillRect(px, y, w, pieceH);
    ctx.fillStyle = p.fg;
    ctx.fillText(p.text, px + 32, y + pieceH / 2 + 2, maxW - 64);
    y += pieceH + 16;
  }
}

export async function downloadSlides(slides: Slide[], w: number, h: number, base: string) {
  const c = document.createElement("canvas");
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "conteudo";
  await preload(slides);
  for (let i = 0; i < slides.length; i++) {
    drawSlide(c, slides[i], w, h);
    const url = c.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-${String(i + 1).padStart(2, "0")}.png`;
    a.click();
    await new Promise((r) => setTimeout(r, 250));
  }
}
