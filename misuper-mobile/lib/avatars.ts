/** The 50 preset avatars: emoji + the web's gradient pair. */

export const AVATAR_GRADIENTS: Record<string, [string, string]> = {
  a01: ["#fbbf24", "#b45309"],
  a02: ["#d6a06a", "#713f12"],
  a03: ["#94a3b8", "#1f2937"],
  a04: ["#b6c2cf", "#475569"],
  a05: ["#f59e0b", "#92400e"],
  a06: ["#facc15", "#a16207"],
  a07: ["#4ade80", "#15803d"],
  a08: ["#a78bfa", "#6d28d9"],
  a09: ["#34d399", "#047857"],
  a10: ["#475569", "#0f172a"],
  a11: ["#c27a3a", "#78350f"],
  a12: ["#2dd4bf", "#0f766e"],
  a13: ["#fde047", "#a16207"],
  a14: ["#f472b6", "#be185d"],
  a15: ["#38bdf8", "#0369a1"],
  a16: ["#22d3ee", "#0e7490"],
  a17: ["#c084fc", "#7e22ce"],
  a18: ["#4ade80", "#166534"],
  a19: ["#fb7185", "#be123c"],
  a20: ["#fb923c", "#c2410c"],
  a21: ["#a3e635", "#4d7c0f"],
  a22: ["#fb923c", "#9a3412"],
  a23: ["#fbbf24", "#92400e"],
  a24: ["#b07a3c", "#572c11"],
  a25: ["#34d399", "#166534"],
  a26: ["#facc15", "#ca8a04"],
  a27: ["#22d3ee", "#7c3aed"],
  a28: ["#fbbf24", "#d97706"],
  a29: ["#94a3b8", "#1e293b"],
  a30: ["#a78bfa", "#4c1d95"],
  a31: ["#fcd34d", "#b45309"],
  a32: ["#e5e7eb", "#374151"],
  a33: ["#cbd5e1", "#475569"],
  a34: ["#d6a06a", "#6b4a2a"],
  a35: ["#c08457", "#5b3a1e"],
  a36: ["#94a3b8", "#334155"],
  a37: ["#f9a8d4", "#be185d"],
  a38: ["#f5f5f4", "#78716c"],
  a39: ["#fca5a5", "#b91c1c"],
  a40: ["#93c5fd", "#1d4ed8"],
  a41: ["#fb923c", "#be123c"],
  a42: ["#7dd3fc", "#0c4a6e"],
  a43: ["#4ade80", "#14532d"],
  a44: ["#fda4af", "#9f1239"],
  a45: ["#fbcfe8", "#db2777"],
  a46: ["#fef08a", "#ca8a04"],
  a47: ["#c4b5fd", "#5b21b6"],
  a48: ["#fcd34d", "#7c2d12"],
  a49: ["#60a5fa", "#7c3aed"],
  a50: ["#fb923c", "#7c2d12"],
};

export function avatarGradient(id: string | null | undefined): [string, string] {
  return (id && AVATAR_GRADIENTS[id]) || ["#94a3b8", "#334155"];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const value = parts.map((part) => part.charAt(0).toUpperCase()).join("");
  return value || "U";
}

export function resolveMediaUrl(url: string | null | undefined, apiUrl: string): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${apiUrl}${url}`;
  return `${apiUrl}/${url}`;
}
