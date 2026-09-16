import type { ResumeState } from '../src/types/resume';
import { PX_PER_MM } from '../src/lib/a4';
import { MEASURE_EXTRA_CSS, renderResumeDocument } from '../src/lib/html';
import { launchBrowser, openDocument, readGeometry, type BrowserOptions, type RawGeometry } from './browser';
import { readStyles, repoRoot } from './paths';

/**
 * Page geometry, measured in a real browser.
 *
 * This is the one number an agent cannot work out by reasoning about the text:
 * whether the content still fits one A4 page, and how much it is being shrunk
 * to get there. The measurement runs against the exact markup and stylesheet
 * the preview uses (`src/lib/html.ts` + `base.css` + `a4.css`), so its numbers
 * describe what will actually print.
 */

export interface MeasureHotspot {
  /** JSON Pointer into `sections`, e.g. `/sections/2` — usable as a patch path. */
  path: string;
  id: string | null;
  title: string;
  heightPx: number;
  /** Fraction of the total content height. Section margins are not included. */
  share: number;
}

export interface MeasureReport {
  contentHeightPx: number;
  pageHeightPx: number;
  contentHeightMm: number;
  pageHeightMm: number;
  /** 1 means the content exactly fills one page; 1.19 means 19% too tall. */
  fillRatio: number;
  /** Actual document scale. Fixed at 1: overflow must be resolved, never hidden by shrinking. */
  fitScale: number;
  pages: number;
  fontSizePt: number;
  hotspots: MeasureHotspot[];
  warnings: string[];
  browser: string;
  confidence: 'measured';
}

export interface MeasureOptions extends BrowserOptions {
  root?: string;
}

const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/** The standalone document `measure` lays out: same markup, with min-height relaxed so the content's own height is readable. */
export const buildMeasureDocument = (resume: ResumeState, root?: string): string =>
  renderResumeDocument(resume, {
    css: readStyles(root ?? repoRoot()),
    extraCss: MEASURE_EXTRA_CSS,
    title: `${resume.personal.name || '简历'} — measure`,
  });

/** Turn raw browser geometry into the report an agent reads. Pure — no browser involved. */
export const buildMeasureReport = (
  resume: ResumeState,
  geometry: RawGeometry,
  browserLabel: string,
): MeasureReport => {
  const { pageHeightPx, contentHeightPx } = geometry;

  const fillRatio = contentHeightPx / pageHeightPx;
  const fitScale = 1;
  const pages = Math.max(1, Math.ceil((contentHeightPx - 0.5) / pageHeightPx));

  const share = (heightPx: number): number =>
    contentHeightPx > 0 ? round(heightPx / contentHeightPx, 3) : 0;

  const hotspots: MeasureHotspot[] = [];
  if (geometry.headerHeightPx > 0) {
    hotspots.push({
      path: '/personal',
      id: null,
      title: '个人信息（页头）',
      heightPx: round(geometry.headerHeightPx, 1),
      share: share(geometry.headerHeightPx),
    });
  }

  const visibleSections = resume.sections
    .map((section, index) => ({ section, index }))
    .filter((entry) => entry.section.visible);

  visibleSections.forEach((entry, order) => {
    const heightPx = geometry.sectionHeights[order];
    if (typeof heightPx !== 'number') return;
    hotspots.push({
      path: `/sections/${entry.index}`,
      id: entry.section.id || null,
      title: entry.section.title || entry.section.type,
      heightPx: round(heightPx, 1),
      share: share(heightPx),
    });
  });

  hotspots.sort((left, right) => right.heightPx - left.heightPx);

  const warnings: string[] = [];
  const percent = (value: number) => `${Math.round(value * 100)}%`;

  if (contentHeightPx <= 0) {
    warnings.push('页面里没有内容，可能是所有章节都不可见，或者 sections 是空的。');
  } else {
    if (fillRatio > 1) {
      warnings.push(
        `内容超出 A4 一页 ${percent(fillRatio - 1)}。为保证字号和预览一致，系统不会自动缩小；请先精简内容或降低字号。`,
      );
    }
    if (fillRatio < 0.75) {
      warnings.push(
        `内容只占 A4 的 ${percent(fillRatio)}，还有约 ${percent(1 - fillRatio)} 的空白可以补充经历或展开细节。`,
      );
    }
  }

  return {
    contentHeightPx: round(contentHeightPx, 1),
    pageHeightPx: round(pageHeightPx, 1),
    contentHeightMm: round(contentHeightPx / PX_PER_MM, 1),
    pageHeightMm: round(pageHeightPx / PX_PER_MM, 1),
    fillRatio: round(fillRatio, 3),
    fitScale: round(fitScale, 3),
    pages,
    fontSizePt: resume.fontSizePt,
    hotspots,
    warnings,
    browser: browserLabel,
    confidence: 'measured',
  };
};

/** Measure in a browser this call owns. Callers that need the browser too should use the helpers above. */
export const measureResume = async (
  resume: ResumeState,
  options: MeasureOptions = {},
): Promise<MeasureReport> => {
  const { browser, label } = await launchBrowser({ ...options, purpose: '测量排版' });
  try {
    const page = await openDocument(browser, buildMeasureDocument(resume, options.root));
    try {
      return buildMeasureReport(resume, await readGeometry(page), label);
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }
};
