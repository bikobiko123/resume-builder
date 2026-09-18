import { describe, expect, it } from 'vitest';
import {
  BASE_SPACING,
  DEFAULT_RESUME_FONT_SIZE_PT,
  DEFAULT_RESUME_SPACING,
  MAX_LEVEL_FONT_SIZE_PT,
  MIN_LEVEL_FONT_SIZE_PT,
  MIN_RESUME_SPACING,
  RESUME_LEVEL_RATIOS,
  createDefaultResumeState,
  normalizeLevelFontSize,
  normalizeResumeSpacing,
  resolveResumeSpacing,
  resolveResumeTypeScale,
  type ResumeState,
} from '../types/resume';
import { renderResumeDocument } from '../lib/html';
import { resumeCssVariables, resumeCssVariableStyle } from '../lib/typeScale';

const resumeWith = (patch: Partial<ResumeState>): ResumeState => ({
  ...createDefaultResumeState(),
  ...patch,
});

describe('分层字号 —— 「跟随正文」是缺省，不是某个具体值', () => {
  it('缺省时按 em 倍率从正文换算', () => {
    const scale = resolveResumeTypeScale(resumeWith({ fontSizePt: 10 }));

    expect(scale.bodyPt).toBe(10);
    expect(scale.namePt).toBe(Number((10 * RESUME_LEVEL_RATIOS.name).toFixed(1)));
    expect(scale.sectionPt).toBe(Number((10 * RESUME_LEVEL_RATIOS.section).toFixed(1)));
    expect(scale.entryPt).toBe(Number((10 * RESUME_LEVEL_RATIOS.entry).toFixed(1)));
    expect(scale.following).toEqual({ name: true, section: true, entry: true });
  });

  it('显式设过之后不再跟着正文动', () => {
    const scale = resolveResumeTypeScale(resumeWith({ fontSizePt: 10, sectionPt: 13 }));

    expect(scale.sectionPt).toBe(13);
    expect(scale.following.section).toBe(false);
    expect(scale.following.name).toBe(true);

    // 正文改成 12pt，设过的章节标题保持 13pt，没设的姓名跟着涨。
    const resized = resolveResumeTypeScale(resumeWith({ fontSizePt: 12, sectionPt: 13 }));
    expect(resized.sectionPt).toBe(13);
    expect(resized.namePt).toBe(Number((12 * RESUME_LEVEL_RATIOS.name).toFixed(1)));
  });

  it('归一化把坏值折回「跟随正文」，把越界的值收敛到边界', () => {
    expect(normalizeLevelFontSize(undefined)).toBeUndefined();
    expect(normalizeLevelFontSize(null)).toBeUndefined();
    expect(normalizeLevelFontSize('不是数字')).toBeUndefined();
    expect(normalizeLevelFontSize(Number.NaN)).toBeUndefined();
    expect(normalizeLevelFontSize(MIN_LEVEL_FONT_SIZE_PT - 5)).toBe(MIN_LEVEL_FONT_SIZE_PT);
    expect(normalizeLevelFontSize(MAX_LEVEL_FONT_SIZE_PT + 5)).toBe(MAX_LEVEL_FONT_SIZE_PT);
    expect(normalizeLevelFontSize(11.24)).toBe(11.2);
  });

  it('默认模板四档都跟随正文', () => {
    const scale = resolveResumeTypeScale(createDefaultResumeState());
    expect(scale.bodyPt).toBe(DEFAULT_RESUME_FONT_SIZE_PT);
    expect(Object.values(scale.following)).toEqual([true, true, true]);
  });
});

describe('分层字号 —— 预览与出稿共用同一组 CSS 变量', () => {
  it('缺省的层级不输出变量，让 a4.css 里的 em 兜底生效', () => {
    const variables = resumeCssVariables(createDefaultResumeState());

    expect(variables['--resume-font-size']).toBe('9.5pt');
    expect(variables['--resume-name-size']).toBeUndefined();
    expect(variables['--resume-section-size']).toBeUndefined();
    expect(variables['--resume-entry-size']).toBeUndefined();
  });

  it('设过的层级以 pt 输出', () => {
    const variables = resumeCssVariables(
      resumeWith({ namePt: 19, sectionPt: undefined, entryPt: 10.5 }),
    );

    expect(variables['--resume-name-size']).toBe('19pt');
    expect(variables['--resume-entry-size']).toBe('10.5pt');
    expect(variables['--resume-section-size']).toBeUndefined();
  });

  it('CLI 出的文档和预览拿到同一串变量', () => {
    // 这条是重点：两边只要有一边漏了变量，measure 量的就不是你看到的排版。
    const resume = resumeWith({ namePt: 19, sectionPt: 12, entryPt: 10.5 });
    const html = renderResumeDocument(resume, { css: '' });
    const style = resumeCssVariableStyle(resume);

    expect(html).toContain(`style="${style}"`);
    for (const declaration of ['--resume-name-size: 19pt', '--resume-section-size: 12pt', '--resume-entry-size: 10.5pt']) {
      expect(html).toContain(declaration);
    }
  });
});

describe('留白紧凑度 —— 缺省即默认间距，不是某个具体系数', () => {
  it('不设时各项就是 a4.css 里写死的基准值', () => {
    const spacing = resolveResumeSpacing(createDefaultResumeState());

    expect(spacing.factor).toBe(DEFAULT_RESUME_SPACING);
    expect(spacing.lineHeight).toBe(BASE_SPACING.lineHeight);
    expect(spacing.pagePaddingMm).toBe(BASE_SPACING.pagePaddingMm);
    expect(spacing.blockGapMm).toBe(BASE_SPACING.blockGapMm);
    expect(spacing.itemGapMm).toBe(BASE_SPACING.itemGapMm);
    expect(spacing.sectionGapMm).toBe(BASE_SPACING.sectionGapMm);
    expect(spacing.isDefault).toBe(true);
  });

  it('系数按同一比例缩放留白，行距则收到 1.3 为止', () => {
    const spacing = resolveResumeSpacing(resumeWith({ spacing: 0.85 }));

    expect(spacing.lineHeight).toBe(1.34);
    expect(spacing.pagePaddingMm).toBe(10.2);
    expect(spacing.blockGapMm).toBe(1.87);
    expect(spacing.itemGapMm).toBe(0.68);
    expect(spacing.sectionGapMm).toBe(2.55);
    expect(spacing.isDefault).toBe(false);

    // 拉到底：行距正好停在 1.3，留白是基准的 75%
    const tightest = resolveResumeSpacing(resumeWith({ spacing: MIN_RESUME_SPACING }));
    expect(tightest.lineHeight).toBe(1.3);
    expect(tightest.pagePaddingMm).toBe(BASE_SPACING.pagePaddingMm * MIN_RESUME_SPACING);
  });

  it('归一化把坏值折回「默认」，把越界的值收敛到边界', () => {
    expect(normalizeResumeSpacing(undefined)).toBeUndefined();
    expect(normalizeResumeSpacing(null)).toBeUndefined();
    expect(normalizeResumeSpacing('紧一点')).toBeUndefined();
    expect(normalizeResumeSpacing(Number.NaN)).toBeUndefined();
    // 恰好 1.0 必须等于缺省，否则「拖到 100% 再拖回来」会留下和默认差之毫厘的值
    expect(normalizeResumeSpacing(1)).toBeUndefined();
    expect(normalizeResumeSpacing(1.5)).toBeUndefined();
    expect(normalizeResumeSpacing(0.5)).toBe(MIN_RESUME_SPACING);
    expect(normalizeResumeSpacing(0.912)).toBe(0.91);
  });

  it('缺省时不输出间距变量，让 a4.css 的兜底值生效', () => {
    const variables = resumeCssVariables(createDefaultResumeState());

    expect(variables['--resume-line-height']).toBeUndefined();
    expect(variables['--resume-page-gap-y']).toBeUndefined();
    expect(variables['--resume-block-gap']).toBeUndefined();
    expect(variables['--resume-item-gap']).toBeUndefined();
    expect(variables['--resume-section-gap']).toBeUndefined();
  });

  it('设过之后以具体值输出，预览和出稿拿到的是同一份', () => {
    const resume = resumeWith({ spacing: 0.85 });
    const variables = resumeCssVariables(resume);

    expect(variables['--resume-line-height']).toBe('1.34');
    expect(variables['--resume-page-gap-y']).toBe('10.2mm');
    expect(variables['--resume-block-gap']).toBe('1.87mm');
    expect(variables['--resume-item-gap']).toBe('0.68mm');
    expect(variables['--resume-section-gap']).toBe('2.55mm');

    const html = renderResumeDocument(resume, { css: '' });
    expect(html).toContain(`style="${resumeCssVariableStyle(resume)}"`);
    expect(html).toContain('--resume-line-height: 1.34');
  });
});
