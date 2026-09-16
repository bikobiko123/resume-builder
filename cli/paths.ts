import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Locating the two things the headless renderer needs from the machine: the
 * project's own stylesheets, and a Chromium to lay them out in.
 */

const here = path.dirname(fileURLToPath(import.meta.url));

/** `cli/paths.ts` -> repository root. */
export const repoRoot = (): string => path.resolve(here, '..');

/** Same order as `src/main.tsx`, so the reset in `base.css` lands before `a4.css`. */
const STYLE_FILES = ['base.css', 'a4.css'];

export class CliEnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliEnvironmentError';
  }
}

export const readStyles = (root = repoRoot()): string => {
  const styleDir = path.join(root, 'src', 'styles');
  const missing = STYLE_FILES.filter((file) => !existsSync(path.join(styleDir, file)));
  if (missing.length > 0) {
    throw new CliEnvironmentError(
      `找不到样式文件 ${missing.map((file) => path.join(styleDir, file)).join('、')}。` +
        `measure 依赖它们还原 A4 排版；请确认命令是从仓库内运行的（当前解析出的根目录：${root}）。`,
    );
  }
  return STYLE_FILES.map((file) => readFileSync(path.join(styleDir, file), 'utf8')).join('\n');
};

/**
 * Candidate Chromium binaries, most trustworthy first.
 *
 * A browser the user already has wins over one Playwright downloaded: it is the
 * same engine the preview was looked at in, and it cannot go stale against the
 * installed `playwright-core` revision.
 */
const explicitCandidates = (): string[] => {
  const fromEnv = process.env.RESUME_CHROME_PATH;
  if (!fromEnv) return [];

  if (!existsSync(fromEnv)) {
    throw new CliEnvironmentError(`RESUME_CHROME_PATH 指向的文件不存在：${fromEnv}`);
  }
  return [fromEnv];
};

const MAC_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
];

const LINUX_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge',
  '/snap/bin/chromium',
];

const WINDOWS_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

const platformPaths = (): string[] => {
  if (process.platform === 'darwin') return MAC_PATHS;
  if (process.platform === 'win32') return WINDOWS_PATHS;
  return LINUX_PATHS;
};

/** Chromium builds Playwright already downloaded, newest first. */
const playwrightCacheCandidates = (): string[] => {
  const root =
    process.platform === 'darwin'
      ? path.join(homedir(), 'Library', 'Caches', 'ms-playwright')
      : process.platform === 'win32'
        ? path.join(homedir(), 'AppData', 'Local', 'ms-playwright')
        : path.join(homedir(), '.cache', 'ms-playwright');

  if (!existsSync(root)) return [];

  const buildNumber = (name: string): number => Number(name.split('-').pop() ?? '0');

  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return [];
  }

  const found: string[] = [];
  const chromiumDirs = entries
    .filter((name) => name.startsWith('chromium-') || name.startsWith('chromium_headless_shell-'))
    .sort((left, right) => buildNumber(right) - buildNumber(left));

  for (const dir of chromiumDirs) {
    const base = path.join(root, dir);
    let children: string[];
    try {
      children = readdirSync(base);
    } catch {
      continue;
    }
    for (const child of children) {
      const variants = [
        path.join(base, child, 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
        path.join(base, child, 'chrome-headless-shell'),
        path.join(base, child, 'chrome-linux', 'chrome'),
        path.join(base, child, 'chrome-win', 'chrome.exe'),
      ];
      found.push(...variants.filter((candidate) => existsSync(candidate)));
    }
  }

  return found;
};

export const browserCandidates = (): string[] => [
  ...explicitCandidates(),
  ...platformPaths().filter((candidate) => existsSync(candidate)),
  ...playwrightCacheCandidates(),
];
