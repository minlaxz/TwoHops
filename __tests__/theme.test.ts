import fs from 'fs';
import path from 'path';
import { getAppTheme } from '../src/theme/colors';

// Guards issue #78's acceptance criteria: every token exists in both
// palettes, and screens/components carry no raw color literals.

function leafPaths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => leafPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir).flatMap(name => {
    const file = path.join(dir, name);
    return fs.statSync(file).isDirectory() ? sourceFiles(file) : [file];
  });
}

describe('theme tokens', () => {
  test('light and dark palettes define the same tokens', () => {
    const light = getAppTheme('light');
    const dark = getAppTheme('dark');
    expect(leafPaths(dark).sort()).toEqual(leafPaths(light).sort());
  });

  test('screens and components use no raw color literals', () => {
    const root = path.join(__dirname, '..');
    const files = [
      ...sourceFiles(path.join(root, 'src/screens')),
      ...sourceFiles(path.join(root, 'src/components')),
      path.join(root, 'App.tsx'),
    ];
    const offenders = files.filter(file =>
      /['"]#[0-9a-fA-F]{3,8}['"]|rgba?\(/.test(fs.readFileSync(file, 'utf8')),
    );
    expect(offenders.map(file => path.relative(root, file))).toEqual([]);
  });
});
