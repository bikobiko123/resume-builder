import { describe, expect, it } from 'vitest';
import { assignResumeIds } from '../lib/ids';
import { exportToMarkdown } from '../lib/markdown';
import { mergeMarkdownIntoResume } from '../lib/markdownMerge';
import { createBlankResumeState, createResumeSection, type ResumeState } from '../types/resume';

const fixture = (): ResumeState => {
  const resume = createBlankResumeState('张三');
  resume.personal.summary = '一句话简介';
  resume.showPhoto = true;
  resume.photo = { src: 'data:image/png;base64,AA' };
  resume.fontSizePt = 10.5;

  const work = createResumeSection('work');
  work.id = 'sec-work';
  work.title = '工作经历';
  work.workEntries = [
    {
      id: 'work-acme',
      organization: 'Acme',
      location: '上海',
      positions: [
        { id: 'pos-pm', position: '产品经理', startDate: '2022-03', endDate: 'present', highlights: ['第一条', '第二条'] },
      ],
    },
  ];

  const hidden = createResumeSection('custom');
  hidden.id = 'sec-hidden';
  hidden.title = '隐藏章节';
  hidden.visible = false;
  hidden.items = [{ id: 'item-1', text: '不该出现在 Markdown 里' }];

  resume.sections = [work, hidden];
  return assignResumeIds(resume).resume;
};

const merge = (resume: ResumeState, markdown: string) => mergeMarkdownIntoResume(resume, markdown);

describe('mergeMarkdownIntoResume', () => {
  it('reports a parse failure instead of replacing the document', () => {
    const resume = fixture();
    const result = merge(resume, '就是一段没有 frontmatter 的文字');

    expect(result.parsed).toBe(false);
    expect(result.resume).toBe(resume);
    expect(result.warnings[0]).toContain('frontmatter');
  });

  it('keeps the canonical id when a bullet is rewritten', () => {
    const resume = fixture();
    const markdown = exportToMarkdown(resume).replace('第一条', '改成了一条全新的战绩');

    const result = merge(resume, markdown);
    const position = result.resume.sections[0].workEntries![0].positions[0];

    expect(position.id).toBe('pos-pm');
    expect(position.highlights).toEqual(['改成了一条全新的战绩', '第二条']);
    expect(result.report).toEqual([{ action: 'replaced', index: 0, title: '工作经历', type: 'work' }]);
  });

  it('leaves the fields Markdown cannot carry alone', () => {
    const resume = fixture();
    const result = merge(resume, exportToMarkdown(resume));

    expect(result.resume.photo).toEqual(resume.photo);
    expect(result.resume.fontSizePt).toBe(10.5);
    expect(result.resume.showPhoto).toBe(true);
    expect(result.resume.updatedAt).toBe(resume.updatedAt);
    expect(result.resume.personal.summary).toBe('一句话简介');
  });

  it('leaves hidden sections out of the merge and says so', () => {
    const resume = fixture();
    const result = merge(resume, exportToMarkdown(resume));

    expect(result.resume.sections[1].items).toEqual([{ id: 'item-1', text: '不该出现在 Markdown 里' }]);
    expect(result.resume.sections[1].visible).toBe(false);
    expect(result.unmentioned).toBe(0);
  });

  it('gives a section that is new in Markdown a deterministic id', () => {
    const resume = fixture();
    const markdown = `${exportToMarkdown(resume)}\n## 证书\n\n### PMP | 2023-06\n\n*PMI*\n`;

    const first = merge(resume, markdown);
    const second = merge(resume, markdown);

    const added = first.resume.sections.at(-1)!;
    expect(added.title).toBe('证书');
    expect(first.report.at(-1)).toMatchObject({ action: 'added', index: null });
    expect(second.resume.sections.at(-1)!.id).toBe(added.id);
  });

  it('discards the uuids the Markdown parser invents, so repeated merges agree', () => {
    const resume = fixture();
    const markdown = `${exportToMarkdown(resume)}\n## 项目经历\n\n### 新项目\n\n2024-01 - 2024-06\n\n- 一条战绩\n`;

    const first = merge(resume, markdown).resume;
    const second = merge(resume, markdown).resume;
    const project = first.sections.at(-1)!;

    expect(project.projectEntries![0].id).toBe(second.sections.at(-1)!.projectEntries![0].id);
    expect(project.projectEntries![0].id).toMatch(/^proj-/u);
  });

  it('warns when a section moved or changed type, and appends it', () => {
    const resume = fixture();
    // Same position, different type: the merge must not overwrite 工作经历.
    const markdown = exportToMarkdown(resume).replace('## 工作经历', '## 教育背景');

    const result = merge(resume, markdown);
    expect(result.report[0]).toMatchObject({ action: 'added', title: '教育背景' });
    expect(result.warnings.some((line) => line.includes('类型不同'))).toBe(true);
    expect(result.resume.sections[0].workEntries![0].positions[0].highlights).toEqual(['第一条', '第二条']);
  });
});
