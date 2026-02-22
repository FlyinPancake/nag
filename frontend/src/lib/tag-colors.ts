/**
 * Tag color palette and utilities.
 *
 * Colors are stored as key strings in the database (e.g. "sage", "terracotta").
 * CSS custom properties define the actual color values for light/dark mode.
 * When a tag has no explicit color (null), one is auto-assigned via name hash.
 */

export interface TagColor {
  key: string;
  label: string;
  /** Tailwind class for the CSS variable, e.g. "text-tag-sage" */
  cssVar: string;
}

export const TAG_COLORS: TagColor[] = [
  { key: "terracotta", label: "Terracotta", cssVar: "tag-terracotta" },
  { key: "sage", label: "Sage", cssVar: "tag-sage" },
  { key: "ocean", label: "Ocean", cssVar: "tag-ocean" },
  { key: "amber", label: "Amber", cssVar: "tag-amber" },
  { key: "plum", label: "Plum", cssVar: "tag-plum" },
  { key: "clay", label: "Clay", cssVar: "tag-clay" },
  { key: "moss", label: "Moss", cssVar: "tag-moss" },
  { key: "slate", label: "Slate", cssVar: "tag-slate" },
  { key: "mauve", label: "Mauve", cssVar: "tag-mauve" },
  { key: "sand", label: "Sand", cssVar: "tag-sand" },
];

const TAG_COLOR_MAP = new Map(TAG_COLORS.map((c) => [c.key, c]));

/**
 * Simple string hash that maps a tag name to a palette index.
 * Deterministic — same name always gets the same color.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Resolve the color key for a tag.
 * Uses the explicit color if set, otherwise auto-assigns based on name hash.
 */
export function resolveTagColorKey(
  color: string | null | undefined,
  tagName: string,
): string {
  if (color && TAG_COLOR_MAP.has(color)) return color;
  return TAG_COLORS[hashString(tagName) % TAG_COLORS.length].key;
}

/**
 * Get inline style object for a tag badge.
 * Uses CSS custom properties so it works in both light and dark mode.
 */
export function tagBadgeStyle(
  color: string | null | undefined,
  tagName: string,
): React.CSSProperties {
  const key = resolveTagColorKey(color, tagName);
  return {
    backgroundColor: `color-mix(in oklch, var(--color-${TAG_COLOR_MAP.get(key)?.cssVar ?? "tag-sage"}) 15%, transparent)`,
    color: `var(--color-${TAG_COLOR_MAP.get(key)?.cssVar ?? "tag-sage"})`,
    borderColor: `color-mix(in oklch, var(--color-${TAG_COLOR_MAP.get(key)?.cssVar ?? "tag-sage"}) 25%, transparent)`,
  };
}

/**
 * Get inline style for a small color dot/swatch.
 */
export function tagDotStyle(colorKey: string): React.CSSProperties {
  const entry = TAG_COLOR_MAP.get(colorKey);
  if (!entry) return {};
  return {
    backgroundColor: `var(--color-${entry.cssVar})`,
  };
}
