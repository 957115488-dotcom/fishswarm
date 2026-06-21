import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const stylesPath = path.resolve(process.cwd(), 'src/renderer/styles/globals.css');

describe('dark theme palette', () => {
  it('uses an ink wash palette for the default theme', () => {
    const source = fs.readFileSync(stylesPath, 'utf8');
    expect(source).toContain('--color-background: #111311;');
    expect(source).toContain('--color-surface: #1b1d1a;');
    expect(source).toContain('--color-text-primary: #f1eee5;');
  });

  it('keeps the accent within the muted blue-green ink family', () => {
    const source = fs.readFileSync(stylesPath, 'utf8');
    expect(source).toContain('--color-accent: #7f9f99;');
    expect(source).toContain('--color-accent-hover: #9ab5ae;');
  });
});
