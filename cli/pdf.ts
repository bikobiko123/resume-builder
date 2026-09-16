import type { ResumeState } from '../src/types/resume';
import { renderResumeDocument } from '../src/lib/html';
import { countPdfPages, launchBrowser, openDocument, readGeometry, type BrowserOptions } from './browser';
import { buildMeasureDocument, buildMeasureReport, type MeasureReport } from './measure';
import { readStyles, repoRoot } from './paths';

/**
 * PDF export through the same browser that measures the page.
 *
 * The point of doing it this way — rather than reaching for a PDF library — is
 * that the file is produced by the exact engine, markup and stylesheet the
 * preview runs on. `renderResumeDocument` output goes into Chrome, and Chrome's
 * own print pipeline turns it into the PDF, so "what the agent exports" and
 * "what the user sees" cannot drift.
 *
 * The A4 document is never transformed to hide overflow. Preview and PDF both
 * render at the requested physical font size; callers get `clipped: true` when
 * the content is taller than the page and should refuse to treat that output as
 * a finished resume.
 */

export interface PdfOptions extends BrowserOptions {
  root?: string;
}

export interface PdfResult {
  buffer: Buffer;
  report: MeasureReport;
  /** Pages actually present in the produced file (read back out of the PDF). */
  pages: number;
  /** True when unscaled content is taller than the fixed A4 page. */
  clipped: boolean;
}

export const renderResumePdf = async (
  resume: ResumeState,
  options: PdfOptions = {},
): Promise<PdfResult> => {
  const root = options.root ?? repoRoot();
  const css = readStyles(root);
  const { browser, label } = await launchBrowser({ ...options, purpose: '导出 PDF' });

  try {
    // 1. Measure first so overflow is explicit before printing.
    const measurePage = await openDocument(browser, buildMeasureDocument(resume, root));
    let report: MeasureReport;
    try {
      report = buildMeasureReport(resume, await readGeometry(measurePage), label);
    } finally {
      await measurePage.close();
    }

    // 2. Print the same untransformed document shown in the preview.
    const printPage = await openDocument(
      browser,
      renderResumeDocument(resume, {
        css,
        title: resume.personal.name || '简历',
      }),
    );

    let buffer: Buffer;
    try {
      buffer = await printPage.pdf({
        // Let the stylesheet own the page size (`@page { size: A4; margin: 0 }`)
        // so the PDF geometry comes from the same file as the on-screen layout.
        preferCSSPageSize: true,
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
    } finally {
      await printPage.close();
    }

    const actualPages = countPdfPages(buffer);
    return {
      buffer,
      report,
      pages: actualPages > 0 ? actualPages : report.pages,
      clipped: report.contentHeightPx > report.pageHeightPx + 1,
    };
  } finally {
    await browser.close();
  }
};
