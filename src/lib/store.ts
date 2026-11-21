"use client";
import { useSyncExternalStore } from "react";
import type { AppState } from "./types";

const KEY = "criador:v1";
const empty: AppState = {
  projects: [],
  references: [],
  claude: { endpoint: "", token: "", enabled: false },
};

let state: AppState = empty;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...empty, ...JSON.parse(raw) };
  } catch {
    /* ignora dados corrompidos */
  }
}

export function setState(fn: (s: AppState) => AppState) {
  load();
  state = fn(state);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    alert("Armazenamento do navegador cheio. Remova imagens de referências antigas.");
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// Snapshot do servidor/hidratação é sempre o estado vazio; depois do mount lê o localStorage.
export function useApp(): { state: AppState; ready: boolean } {
  const ready = useSyncExternalStore(
    (l) => {
      const un = subscribe(l);
      load();
      queueMicrotask(l);
      return un;
    },
    () => (loaded ? 1 : 0),
    () => 0,
  );
  const s = useSyncExternalStore(
    subscribe,
    () => {
      load();
      return state;
    },
    () => empty,
  );
  return { state: s, ready: ready === 1 };
}
