import { describe, expect, it } from 'vitest';
import { normalizeResume } from '../src/lib/resumeSchema';
import { assignResumeIds } from '../src/lib/ids';
import { createBlankResumeState, createDefaultResumeState, createResumeSection, type ResumeState } from '../src/types/resume';
import { countPdfPages } from './browser';
import { renderResumePdf } from './pdf';
import { browserCandidates } from './paths';

const hasBrowser = browserCandidates().length > 0;

/** A4 in PostScript points: 210mm x 297mm. */
const A4_WIDTH_PT = (210 / 25.4) * 72;
const A4_HEIGHT_PT = (297 / 25.4) * 72;

interface MediaBox {
  widthPt: number;
  heightPt: number;
}

const readMediaBox = (buffer: Buffer): MediaBox => {
  const match = buffer.toString('latin1').match(/MediaBox\s*\[([^\]]+)\]/u);
  if (!match) throw new Error('PDF 里没有 MediaBox');
  const [x0, y0, x1, y1] = match[1].trim().split(/\s+/u).map(Number);
  return { widthPt: x1 - x0, heightPt: y1 - y0 };
};

const fixture = (): ResumeState =>
  assignResumeIds(normalizeResume(createDefaultResumeState()).resume, { rewrite: true }).resume;

/** Enough bullets to overflow one fixed A4 page badly. */
const oversized = (): ResumeState => {
  const resume = createBlankResumeState('李四');
  const work = createResumeSection('work');
  work.id = 'sec-work';
  work.title = '工作经历';
  work.workEntries = Array.from({ length: 40 }, (_, index) => ({
    id: `work-${index}`,
    organization: `公司 ${index}`,
    location: '上海',
    positions: [
      {
        id: `pos-${index}`,
        position: '产品经理',
        startDate: '2020-01',
        endDate: 'present',
        highlights: Array.from(
          { length: 5 },
          (_, bullet) => `第 ${index}-${bullet} 条战绩：负责一条足以占据整整一行的长描述文字，用来把内容撑到超出 A4 一页`,
        ),
      },
    ],
  }));
  resume.sections = [work];
  return assignResumeIds(resume).resume;
};

/** Just over one page: must be scaled down, but still fits after scaling. */
const slightlyOver = (): ResumeState => {
  const resume = createBlankResumeState('王五');
  const work = createResumeSection('work');
  work.id = 'sec-work';
  work.title = '工作经历';
  work.workEntries = Array.from({ length: 9 }, (_, index) => ({
    id: `work-${index}`,
    organization: `公司 ${index}`,
    location: '上海',
    positions: [
      {
        id: `pos-${index}`,
        position: '产品经理',
        startDate: '2020-01',
        endDate: 'present',
        highlights: Array.from({ length: 4 }, (_, bullet) => `第 ${index}-${bullet} 条战绩：一行半左右的描述文字，长度接近一条真实的工作成果描述`),
      },
    ],
  }));
  resume.sections = [work];
  return assignResumeIds(resume).resume;
};

describe('countPdfPages', () => {
  it('counts page objects without counting the page tree', () => {
    const fake = Buffer.from('<< /Type /Pages /Count 2 >> << /Type /Page >> << /Type /Page >>', 'latin1');
    expect(countPdfPages(fake)).toBe(2);
  });

  it('returns 0 for something that is not a PDF', () => {
    expect(countPdfPages(Buffer.from('not a pdf'))).toBe(0);
  });
});

describe.skipIf(!hasBrowser)('renderResumePdf', () => {
  it('produces exactly one A4 page for a resume that fits', async () => {
    const result = await renderResumePdf(fixture());
    const box = readMediaBox(result.buffer);

    expect(result.buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(result.pages).toBe(1);
    // Chrome rounds the mm page size slightly; it is still A4 to any reader.
    expect(box.widthPt).toBeCloseTo(A4_WIDTH_PT, 0);
    expect(box.heightPt).toBeCloseTo(A4_HEIGHT_PT, 0);
    expect(result.clipped).toBe(false);
    expect(result.report.fitScale).toBe(1);
  }, 90000);

  it('keeps the physical font size and reports a slightly over-long resume as clipped', async () => {
    const result = await renderResumePdf(slightlyOver());

    expect(result.report.fillRatio).toBeGreaterThan(1);
    expect(result.report.fitScale).toBe(1);
    expect(result.pages).toBe(1);
    expect(result.clipped).toBe(true);
  }, 90000);

  it('reports clipped for oversized content without changing its scale', async () => {
    const result = await renderResumePdf(oversized());

    expect(result.report.fitScale).toBe(1);
    expect(result.clipped).toBe(true);
    // Clipped, but still one page — it never silently becomes a two-page file.
    expect(result.pages).toBe(1);
    // And the caller gets the reason, not just the flag.
    expect(result.report.warnings.some((line) => line.includes('不会自动缩小'))).toBe(true);
  }, 90000);

  it('keeps a blank resume to one page', async () => {
    const result = await renderResumePdf(createBlankResumeState('空'));
    expect(result.pages).toBe(1);
    expect(result.clipped).toBe(false);
  }, 90000);

  it('refuses to guess when the document does not lay out', async () => {
    const resume = fixture();
    // A stylesheet that hides the page frame entirely.
    await expect(
      renderResumePdf(resume, { root: '/nonexistent-root-for-styles' }),
    ).rejects.toThrow();
  }, 60000);
});
