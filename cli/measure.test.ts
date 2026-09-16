import { describe, expect, it } from 'vitest';
import { normalizeResume } from '../src/lib/resumeSchema';
import { assignResumeIds } from '../src/lib/ids';
import { createBlankResumeState, createDefaultResumeState, createResumeSection, type ResumeState } from '../src/types/resume';
import { measureResume } from './measure';
import { browserCandidates } from './paths';

/**
 * These run a real Chromium, so they are skipped on a machine without one
 * rather than failing — the measurement is only as good as the browser anyway.
 */
const hasBrowser = browserCandidates().length > 0;

/** `clientHeight` is an integer by spec, so 297mm lands on 1122 or 1123. */
const expectOneA4Page = (heightPx: number): void => {
  expect(heightPx).toBeGreaterThanOrEqual(1120);
  expect(heightPx).toBeLessThanOrEqual(1126);
};

const fixture = (): ResumeState =>
  assignResumeIds(normalizeResume(createDefaultResumeState()).resume, { rewrite: true }).resume;

/** A resume far past one page: 3 pages of bullets at the default font size. */
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

describe.skipIf(!hasBrowser)('measureResume', () => {
  it('measures an A4 page and reports the default template as fitting', async () => {
    const report = await measureResume(fixture());

    // 297mm at 96dpi.
    expectOneA4Page(report.pageHeightPx);
    expect(report.pageHeightMm).toBeCloseTo(297, 0);
    expect(report.confidence).toBe('measured');
    expect(report.pages).toBe(1);
    expect(report.fillRatio).toBeLessThan(1);
    expect(report.fillRatio).toBeGreaterThan(0.4);
    expect(report.fitScale).toBe(1);
    expect(report.warnings).toEqual([]);
    expect(report.browser).not.toBe('');
  }, 60000);

  it('attributes height to the header and to each visible section', async () => {
    const resume = fixture();
    const report = await measureResume(resume);

    const header = report.hotspots.find((spot) => spot.path === '/personal');
    expect(header).toMatchObject({ id: null, title: '个人信息（页头）' });
    expect(header!.heightPx).toBeGreaterThan(0);

    const sectionPaths = report.hotspots.filter((spot) => spot.path !== '/personal').map((spot) => spot.path);
    expect(sectionPaths.sort()).toEqual(resume.sections.map((_, index) => `/sections/${index}`).sort());

    const work = report.hotspots.find((spot) => spot.path === '/sections/0')!;
    expect(work.id).toBe('sec-工作经历');
    expect(work.title).toBe('工作经历');
    expect(work.heightPx).toBeGreaterThan(0);

    // Sorted by cost, and shares are fractions of the total content height.
    const heights = report.hotspots.map((spot) => spot.heightPx);
    expect([...heights].sort((a, b) => b - a)).toEqual(heights);
    for (const spot of report.hotspots) {
      expect(spot.share).toBeGreaterThan(0);
      expect(spot.share).toBeLessThanOrEqual(1);
    }
  }, 60000);

  it('reports an over-long resume without silently shrinking it', async () => {
    const report = await measureResume(oversized());

    expect(report.fillRatio).toBeGreaterThan(2);
    expect(report.pages).toBeGreaterThanOrEqual(3);
    expect(report.fitScale).toBe(1);
    expect(report.warnings.some((line) => line.includes('不会自动缩小'))).toBe(true);
    expect(report.warnings.some((line) => line.includes('超出 A4 一页'))).toBe(true);
  }, 60000);

  it('sees font size changes in the measured height', async () => {
    const small = fixture();
    small.fontSizePt = 9;
    const large = fixture();
    large.fontSizePt = 13;

    const [smallReport, largeReport] = [await measureResume(small), await measureResume(large)];
    expect(largeReport.contentHeightPx).toBeGreaterThan(smallReport.contentHeightPx);
  }, 90000);
});
