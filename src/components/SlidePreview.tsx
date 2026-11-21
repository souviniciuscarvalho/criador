"use client";
import { useEffect, useRef } from "react";
import { drawSlide } from "@/lib/render";
import type { Slide } from "@/lib/types";

export default function SlidePreview({
  slide, width, height, className = "", onClick,
}: { slide: Slide; width: number; height: number; className?: string; onClick?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawSlide(ref.current, slide, width, height);
  }, [slide, width, height]);
  return (
    <canvas
      ref={ref}
      onClick={onClick}
      className={`h-auto w-full rounded-lg ${className}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    />
  );
}
