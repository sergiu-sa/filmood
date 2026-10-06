import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ACCENT_VARS, AVATAR_COLORS } from "@/lib/constants";

// Every text token in app/globals.css must reach WCAG AA (4.5:1) on the
// surfaces it is allowed on, in both themes.
const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function block(selector: string): Record<string, string> {
  const match = css.match(new RegExp(`^${selector} \\{([^}]*)\\}`, "m"));
  if (!match) throw new Error(`No ${selector} block in globals.css`);
  return Object.fromEntries([...match[1].matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const dark = block(":root");
const themes = { dark, light: { ...dark, ...block('\\[data-theme="light"\\]') } };

type RGB = [number, number, number];

function rgb(tokens: Record<string, string>, name: string): RGB {
  const raw = tokens[name];
  const value = raw?.match(/^var\(--([\w-]+)\)$/) ? tokens[raw.slice(6, -1)] : raw;
  if (!/^#[0-9a-f]{6}$/i.test(value ?? "")) throw new Error(`--${name} is not a hex colour: ${raw}`);
  return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16)) as RGB;
}

// A translucent token (`rgba(r, g, b, a)`) as it renders over an opaque surface.
function over(tokens: Record<string, string>, tint: string, surface: string): RGB {
  const [r, g, b, a] = tokens[tint].match(/[\d.]+/g)!.map(Number);
  const base = rgb(tokens, surface);
  return [r, g, b].map((c, i) => c * a + base[i] * (1 - a)) as RGB;
}

function luminance(color: RGB): number {
  const [r, g, b] = color.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const accents = ["gold", "blue", "rose", "violet", "teal", "ember"];
const accentText = (a: string) => (a === "gold" ? "gold-text" : a);

const pairs: [string, string][] = [
  ...["t1", "t2", "t3"].flatMap((t) => ["bg", "surface", "surface2"].map((s): [string, string] => [t, s])),
  ...accents.flatMap((a) => ["bg", "surface"].map((s): [string, string] => [accentText(a), s])),
  ...accents.map((a): [string, string] => [`${a}-on`, a]),
];

// Accent text keeps its colour on its own soft fill; gold text also sits on tags.
const tinted: [string, string, string][] = ["bg", "surface"].flatMap((s) => [
  ...accents.map((a): [string, string, string] => [accentText(a), `${a}-soft`, s]),
  ["gold-text", "tag-bg", s] as [string, string, string],
]);

describe.each(Object.entries(themes))("%s theme", (_, tokens) => {
  it.each(pairs)("--%s on --%s is at least 4.5:1", (text, surface) => {
    expect(ratio(rgb(tokens, text), rgb(tokens, surface))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(tinted)("--%s on --%s over --%s is at least 4.5:1", (text, tint, surface) => {
    expect(ratio(rgb(tokens, text), over(tokens, tint, surface))).toBeGreaterThanOrEqual(4.5);
  });

  // The rgba() tokens repeat each accent's triplet by hand.
  it.each(accents)("--%s's -rgb, -soft, -glow and -border match its hex", (a) => {
    const triplet = rgb(tokens, a).join(", ");
    expect(tokens[`${a}-rgb`]).toBe(triplet);
    for (const suffix of ["soft", "glow", "border"]) expect(tokens[`${a}-${suffix}`]).toMatch(`rgba(${triplet},`);
  });
});

it("every token ACCENT_VARS and AVATAR_COLORS name exists", () => {
  const names = JSON.stringify([ACCENT_VARS, AVATAR_COLORS]).match(/--[\w-]+/g)!;
  for (const tokens of Object.values(themes)) for (const name of names) expect(tokens).toHaveProperty(name.slice(2));
});

it(".always-dark-accents carries dark mode's -rgb triplets", () => {
  const override = block('\\[data-theme="light"\\] \\.always-dark-accents');
  for (const a of accents) expect(override[`${a}-rgb`]).toBe(dark[`${a}-rgb`]);
});
