import { chromium, type Browser, type Page } from 'playwright-core';
import { browserCandidates, CliEnvironmentError } from './paths';

/**
 * Browser plumbing shared by `measure` and the PDF export.
 *
 * Both need the same thing: a real Chromium laying out the same markup the
 * preview uses. Keeping the launch and the "document is settled" logic here
 * means the measurement and the PDF cannot be taken against differently-loaded
 * pages — a font that resolved for one and not the other is exactly the kind of
 * difference that would make the numbers lie.
 */

export interface BrowserOptions {
  /** Explicit browser binary; wins over auto-discovery. */
  browserPath?: string;
  /** Named in the error message, e.g. "measure a real browser to lay out the page". */
  purpose?: string;
}

export interface LaunchedBrowser {
  browser: Browser;
  /** Which binary was used — reported in CLI output so it can be checked. */
  label: string;
}

/** `page.pdf()` is a headless-Chromium-only API; fail with a clear message rather than a browser error. */
export const assertHeadless = (browser: Browser, purpose: string): void => {
  if (!browser.isConnected()) {
    throw new CliEnvironmentError(`浏览器已断开，无法${purpose}`);
  }
};

export const launchBrowser = async (options: BrowserOptions = {}): Promise<LaunchedBrowser> => {
  const purpose = options.purpose ?? '排版';
  const attempts: Array<{ label: string; launch: () => Promise<Browser> }> = [];

  if (options.browserPath) {
    attempts.push({
      label: options.browserPath,
      launch: () => chromium.launch({ executablePath: options.browserPath }),
    });
  }

  for (const candidate of browserCandidates()) {
    attempts.push({ label: candidate, launch: () => chromium.launch({ executablePath: candidate }) });
  }

  // Let playwright-core find a Chrome/Edge it knows about, as a last resort.
  attempts.push({
    label: 'installed Chrome (playwright channel)',
    launch: () => chromium.launch({ channel: 'chrome' }),
  });

  const failures: string[] = [];

  for (const attempt of attempts) {
    try {
      const browser = await attempt.launch();
      return { browser, label: attempt.label };
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      failures.push(`  - ${attempt.label}: ${message}`);
    }
  }

  throw new CliEnvironmentError(
    [
      `找不到可用的 Chromium，${purpose}需要一个真实浏览器。`,
      '试过：',
      ...failures,
      '',
      '解决办法：安装 Google Chrome，或者用 RESUME_CHROME_PATH=/path/to/chrome 指定一个可执行文件。',
    ].join('\n'),
  );
};

/**
 * Wait until the layout has stopped moving.
 *
 * System fonts resolve immediately, but a web font would not; and a photo data
 * URL changes the header height once it decodes. Measuring or printing before
 * both settle is how you get a number — or a PDF — that does not match what the
 * user sees a moment later.
 */
const settleDocument = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    try {
      await document.fonts.ready;
    } catch {
      /* no font loading API — nothing to wait for */
    }

    await Promise.race([
      Promise.all(
        Array.from(document.images).map(
          (image) =>
            new Promise<void>((resolve) => {
              if (image.complete) {
                resolve();
                return;
              }
              image.addEventListener('load', () => resolve(), { once: true });
              image.addEventListener('error', () => resolve(), { once: true });
            }),
        ),
      ),
      new Promise<void>((resolve) => setTimeout(resolve, 3000)),
    ]);
  });
};

/** Load a standalone resume document and wait for it to settle. Caller closes the page. */
export const openDocument = async (browser: Browser, html: string): Promise<Page> => {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await settleDocument(page);
  return page;
};

export interface RawGeometry {
  pageHeightPx: number;
  pageWidthPx: number;
  /** The content's own height. Only meaningful against `MEASURE_EXTRA_CSS`, which relaxes min-height. */
  contentHeightPx: number;
  headerHeightPx: number;
  sectionHeights: number[];
}

export const readGeometry = async (page: Page): Promise<RawGeometry> => {
  const geometry = await page.evaluate((): RawGeometry | null => {
    const pageEl = document.querySelector('.a4-page');
    const contentEl = document.querySelector('.a4-content');
    if (!pageEl || !contentEl) return null;

    const headerEl = document.querySelector('.resume-header');
    const sectionEls = Array.from(document.querySelectorAll('.resume-section'));

    return {
      pageHeightPx: pageEl.clientHeight,
      pageWidthPx: pageEl.clientWidth,
      // `min-height` is relaxed by MEASURE_EXTRA_CSS, so this is the content's
      // own height rather than the page's.
      contentHeightPx: contentEl.scrollHeight,
      headerHeightPx: headerEl ? headerEl.getBoundingClientRect().height : 0,
      sectionHeights: sectionEls.map((element) => element.getBoundingClientRect().height),
    };
  });

  if (!geometry) {
    throw new CliEnvironmentError('页面里没有 .a4-page / .a4-content 节点，样式可能没加载成功');
  }
  if (!(geometry.pageHeightPx > 0)) {
    throw new CliEnvironmentError(`测量到的 A4 页高是 ${geometry.pageHeightPx}px，浏览器没有正常布局`);
  }
  return geometry;
};

/**
 * Count the pages in a PDF the browser just produced.
 *
 * Read out of the file rather than inferred from the content height, so an
 * accidental blank trailing page shows up instead of being assumed away.
 * Chrome writes page objects as plain dictionaries; if a future version
 * compresses them this returns 0 and callers fall back to the computed count.
 */
export const countPdfPages = (buffer: Buffer): number => {
  const matches = buffer.toString('latin1').match(/\/Type\s*\/Page(?![s])/gu);
  return matches ? matches.length : 0;
};
