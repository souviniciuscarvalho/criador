export type FormatKind = "feed" | "story" | "carrossel" | "quadrado" | "custom";

export interface ContentFormat {
  id: FormatKind;
  label: string;
  hint: string;
  width: number;
  height: number;
  multi: boolean; // vários slides
}

export const FORMATS: ContentFormat[] = [
  { id: "feed", label: "Feed", hint: "Post 4:5 · 1080×1350", width: 1080, height: 1350, multi: false },
  { id: "quadrado", label: "Quadrado", hint: "Post 1:1 · 1080×1080", width: 1080, height: 1080, multi: false },
  { id: "story", label: "Story", hint: "Vertical 9:16 · 1080×1920", width: 1080, height: 1920, multi: false },
  { id: "carrossel", label: "Carrossel", hint: "Vários slides 4:5", width: 1080, height: 1350, multi: true },
  { id: "custom", label: "Personalizado", hint: "Defina o tamanho", width: 1080, height: 1350, multi: true },
];

export interface Slide {
  id: string;
  title: string;
  body: string;
  bg: string;
  fg: string;
  accent: string;
  align: "left" | "center";
  titleSize: number; // px no canvas real (1080 de largura)
  bodySize: number;
  imageIdea?: string; // ideia de imagem (opcional)
  font?: string; // fonte do estilo (se instalada no aparelho)
  pieces?: Piece[]; // componentes do estilo aplicados
  bgImage?: string; // foto de fundo (data URL, fica só neste navegador)
  bgDim?: number; // escurecimento da foto, 0 a 0.85
}

export interface Piece {
  id: string;
  text: string;
  bg: string;
  fg: string;
}

export interface Note {
  score: number;
  summary: string;
  tips: string[];
  at: number;
}

export interface Project {
  id: string;
  title: string;
  format: FormatKind;
  width: number;
  height: number;
  slides: Slide[];
  referenceIds: string[];
  updatedAt: number;
  caption?: string;
  styleId?: string;
  mode?: "normal" | "continuo";
  stage?: "texto" | "visual";
  note?: Note;
}

export interface Study {
  summary: string;
  tags: string[];
  source: "local" | "claude";
  at: number;
}

export interface Reference {
  id: string;
  name: string;
  niche: string;
  kind: "feed" | "carrossel" | "story" | "outro";
  notes: string; // texto/legenda/transcrição do conteúdo
  images: string[]; // data URLs reduzidas
  study: Study | null;
  createdAt: number;
}

export interface StyleComponent {
  id: string;
  name: string;
  description: string;
  bg: string;
  fg: string;
  accent: string;
  sample: string;
}

export interface Style {
  id: string;
  name: string;
  prints: string[]; // data URLs (só no navegador; o servidor guarda à parte)
  status: "novo" | "analisado";
  guide: string;
  fonts: { title: string; body: string };
  palette: string[];
  components: StyleComponent[];
  recreated: Slide[];
  rev: number; // versão vinda do servidor
  createdAt: number;
}

export interface ClaudeConnection {
  token: string; // segredo do link MCP (vazio = sem link)
  createdAt: number;
  used?: boolean; // o Claude já chamou o link
  syncError?: string;
}

export type KeyProvider = "iagen" | "openai" | "gemini" | "figma" | "redditId" | "redditSecret" | "producthunt";

export interface Connections {
  keys: Partial<Record<KeyProvider, string>>;
  imageDefault: "iagen" | "magnific" | "openai" | "gemini" | "";
  geminiModel: string;
  openaiModel: string;
  openaiQuality: string;
}

export interface AppState {
  projects: Project[];
  references: Reference[];
  styles: Style[];
  deletedProjects: string[];
  defaultStyleId: string;
  claude: ClaudeConnection;
  connections: Connections;
  imagens?: { keys: { openai: boolean; gemini: boolean }; status: Record<string, { state: "gerando" | "pronto" | "erro"; done: number; total: number; error?: string }> };
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function newSlide(partial: Partial<Slide> = {}): Slide {
  return {
    id: uid(),
    title: "Título do slide",
    body: "Escreva aqui o texto de apoio.",
    bg: "#111827",
    fg: "#f9fafb",
    accent: "#a78bfa",
    align: "left",
    titleSize: 84,
    bodySize: 44,
    ...partial,
  };
}

export function newProject(format: FormatKind = "carrossel"): Project {
  const f = FORMATS.find((x) => x.id === format)!;
  return {
    id: uid(),
    title: "Novo conteúdo",
    format,
    width: f.width,
    height: f.height,
    slides: [newSlide()],
    referenceIds: [],
    updatedAt: Date.now(),
    caption: "",
    mode: "normal",
    stage: "texto",
  };
}
