import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Tests run from the web/ folder (npm test -w web).
const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');
const token = (name: string): string => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'));
  if (!m?.[1]) throw new Error(`token --${name} not found`);
  return m[1];
};

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const textColors = ['text', 'text-muted', 'accent', 'secondary', 'gain', 'loss', 'warn', 'focus'];
const backgrounds = ['bg', 'card', 'card-raised'];

describe('design tokens meet WCAG AA for text', () => {
  for (const fg of textColors) {
    for (const bg of backgrounds) {
      it(`${fg} on ${bg}`, () => {
        expect(contrast(token(`color-${fg}`), token(`color-${bg}`))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('button text on accent', () => {
    expect(contrast(token('color-accent-text'), token('color-accent'))).toBeGreaterThanOrEqual(4.5);
  });
});
