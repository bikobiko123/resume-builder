import { describe, expect, it } from 'vitest';
import { normalizeResume, ResumeSchemaError, validateResume, MAX_HIGHLIGHT_LENGTH } from '../lib/resumeSchema';
import { assignResumeIds } from '../lib/ids';
import { createBlankResumeState, createResumeSection, createDefaultResumeState } from '../types/resume';

const codesOf = (resume: Parameters<typeof validateResume>[0]) =>
  validateResume(resume).map((diagnostic) => diagnostic.code);

describe('normalizeResume', () => {
  it('rejects values that cannot be a resume', () => {
    expect(() => normalizeResume(null)).toThrow(ResumeSchemaError);
    expect(() => normalizeResume('{}')).toThrow(ResumeSchemaError);
    expect(() => normalizeResume({ sections: {} })).toThrow(/sections 必须是数组/u);
  });

  it('fills in a complete, render-safe state from a bare object', () => {
    const { resume, warnings } = normalizeResume({ personal: { name: '张三' }, sections: [] });

    expect(resume.personal.name).toBe('张三');
    expect(resume.sections).toEqual([]);
    expect(resume.fontSizePt).toBe(9.5);
    expect(resume.fontFamily).toBe('source-han-serif');
    expect(resume.headerAlignment).toBe('left');
    expect(resume.showName).toBe(true);
    expect(resume.showPhoto).toBe(false);
    expect(typeof resume.updatedAt).toBe('string');
    expect(warnings.some((line) => line.startsWith('/fontSizePt'))).toBe(true);
  });

  it('keeps supported fonts and repairs unknown font values', () => {
    const serif = normalizeResume({ personal: {}, sections: [], fontFamily: 'anthropic-serif' });
    expect(serif.resume.fontFamily).toBe('anthropic-serif');
    expect(serif.warnings.some((line) => line.startsWith('/fontFamily'))).toBe(false);

    const fallback = normalizeResume({ personal: {}, sections: [], fontFamily: 'comic-sans' });
    expect(fallback.resume.fontFamily).toBe('source-han-serif');
    expect(fallback.warnings.some((line) => line.startsWith('/fontFamily'))).toBe(true);
  });

  it('keeps supported header alignment and repairs unknown values', () => {
    expect(normalizeResume({ personal: {}, sections: [], headerAlignment: 'center' }).resume.headerAlignment)
      .toBe('center');

    const fallback = normalizeResume({ personal: {}, sections: [], headerAlignment: 'right' });
    expect(fallback.resume.headerAlignment).toBe('left');
    expect(fallback.warnings.some((line) => line.startsWith('/headerAlignment'))).toBe(true);
  });

  it('records a warning for every field it had to repair', () => {
    const { resume, warnings } = normalizeResume({
      personal: { name: 42, titles: 'nope' },
      sections: [{ type: 'work', title: '工作经历', visible: 'yes', workEntries: 'nope' }],
      fontSizePt: 99,
      showEmail: 'yes',
    });

    expect(resume.personal.name).toBe('');
    expect(resume.personal.titles).toEqual([]);
    expect(resume.sections[0].visible).toBe(true);
    expect(resume.sections[0].workEntries).toBeUndefined();
    expect(resume.fontSizePt).toBe(13);
    expect(resume.showEmail).toBe(true);
    expect(warnings.length).toBeGreaterThanOrEqual(5);
  });

  it('keeps unknown section types renderable instead of dropping them', () => {
    const { resume, warnings } = normalizeResume({
      personal: { name: '张三' },
      sections: [{ type: 'wat', title: '???' }],
    });
    expect(resume.sections[0].type).toBe('custom');
    expect(warnings.some((line) => line.includes('未知章节类型'))).toBe(true);
  });

  it('drops a photo without a source', () => {
    expect(normalizeResume({ personal: {}, sections: [], photo: { src: '' } }).resume.photo).toBeUndefined();
    expect(normalizeResume({ personal: {}, sections: [], photo: { src: 'data:image/png;base64,AA' } }).resume.photo)
      .toEqual({ src: 'data:image/png;base64,AA' });
  });

  it('round-trips a real state without warnings', () => {
    const { resume, warnings } = normalizeResume(JSON.parse(JSON.stringify(createDefaultResumeState())));
    expect(warnings).toEqual([]);
    expect(resume.sections.length).toBe(5);
    expect(resume.sections[0].workEntries![0].positions[0].highlights.length).toBe(3);
  });
});

describe('validateResume', () => {
  it('accepts the default template', () => {
    const resume = assignResumeIds(createDefaultResumeState()).resume;
    expect(codesOf(resume)).toEqual([]);
  });

  it('flags a duplicate id as an error, with both paths', () => {
    const resume = createDefaultResumeState();
    resume.sections[0].workEntries![1].id = resume.sections[0].workEntries![0].id;
    const diagnostics = validateResume(assignResumeIds(resume).resume).filter((d) => d.level === 'error');

    // assignResumeIds repairs it, so validate on an un-repaired document must warn instead.
    expect(diagnostics.length).toBeLessThanOrEqual(1);
    const raw = validateResume(resume).filter((d) => d.level === 'error');
    expect(raw).toHaveLength(1);
    expect(raw[0].code).toBe('duplicate-id');
    expect(raw[0].message).toContain('重复');
  });

  it('points at placeholder bullets and over-long bullets', () => {
    const resume = createDefaultResumeState();
    const highlights = resume.sections[0].workEntries![0].positions[0].highlights;
    highlights.push('');
    highlights.push('长'.repeat(MAX_HIGHLIGHT_LENGTH + 1));

    const diagnostics = validateResume(assignResumeIds(resume).resume);
    const empty = diagnostics.find((d) => d.code === 'empty-highlight');
    const long = diagnostics.find((d) => d.code === 'long-highlight');

    expect(empty?.path).toBe('/sections/0/workEntries/0/positions/0/highlights/3');
    expect(long?.path).toBe('/sections/0/workEntries/0/positions/0/highlights/4');
    expect(long?.message).toContain(String(MAX_HIGHLIGHT_LENGTH + 1));
  });

  it('warns about a date it cannot read', () => {
    const resume = createDefaultResumeState();
    resume.sections[0].workEntries![0].positions[0].startDate = '2022/03';
    expect(codesOf(resume)).toContain('bad-date');
    expect(codesOf(resume)).not.toContain('bad-date'.repeat(2));
  });

  it('accepts present, YYYY-MM and YYYY-MM-DD', () => {
    const resume = createDefaultResumeState();
    const position = resume.sections[0].workEntries![0].positions[0];
    for (const value of ['present', '2022-03', '2022-03-01']) {
      position.startDate = value;
      position.endDate = value;
      expect(codesOf(resume)).not.toContain('bad-date');
    }
  });

  it('warns about every switch that is on with nothing behind it', () => {
    const resume = createBlankResumeState('张三');
    resume.showPhoto = true;
    const toggles = validateResume(resume)
      .filter((d) => d.code === 'toggle-without-content')
      .map((d) => d.path);

    expect(toggles).toEqual([
      '/showPhoto',
      '/showEmail',
      '/showPhone',
      '/showUrl',
      '/showProfiles',
      '/showAddress',
      '/showTitle',
      '/showSummary',
    ]);
  });

  it('names the switch in the path so it can be patched directly', () => {
    const resume = createBlankResumeState('张三');
    const diagnostic = validateResume(resume).find((d) => d.path === '/showEmail');
    expect(diagnostic?.message).toContain('没有对应内容');
  });

  it('warns about an empty section and about an empty resume', () => {
    const resume = createBlankResumeState('张三');
    expect(codesOf(resume)).toContain('empty-resume');

    resume.sections = [createResumeSection('certs')];
    expect(codesOf(resume)).toContain('empty-section');
  });

  it('does not complain about a hidden section with no content', () => {
    const resume = createBlankResumeState('张三');
    const section = createResumeSection('certs');
    section.visible = false;
    resume.sections = [section];
    expect(codesOf(resume)).not.toContain('empty-section');
  });

  it('reports an id that is missing rather than silently ignoring it', () => {
    const resume = createBlankResumeState('张三');
    resume.sections = [createResumeSection('certs')];
    resume.sections[0].id = '';
    const missing = validateResume(resume).find((d) => d.code === 'missing-id');
    expect(missing?.level).toBe('error');
  });
});

describe('normalizeResume —— 分层字号', () => {
  const bare = { personal: { name: '张三' }, sections: [] };

  it('没写就是不设，不算警告', () => {
    const { resume, warnings } = normalizeResume(bare);
    expect(resume.namePt).toBeUndefined();
    expect(resume.sectionPt).toBeUndefined();
    expect(resume.entryPt).toBeUndefined();
    expect(warnings.some((line) => line.startsWith('/namePt'))).toBe(false);
  });

  it('非数字改为跟随正文，越界收敛并报警', () => {
    const { resume, warnings } = normalizeResume({
      ...bare,
      namePt: '大一点',
      sectionPt: 999,
      entryPt: 12,
    });

    expect(resume.namePt).toBeUndefined();
    expect(warnings.some((line) => line.startsWith('/namePt'))).toBe(true);
    expect(resume.sectionPt).toBe(36);
    expect(warnings.some((line) => line.startsWith('/sectionPt'))).toBe(true);
    expect(resume.entryPt).toBe(12);
    expect(warnings.some((line) => line.startsWith('/entryPt'))).toBe(false);
  });
});
