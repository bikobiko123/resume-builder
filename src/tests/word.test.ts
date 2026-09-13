import { describe, expect, it } from 'vitest';
import jszip from 'jszip';
import {
  buildDocxFilename,
  buildResumeDocx,
  resumeToDocxBlob,
} from '../lib/word';
import { createDefaultResumeState, createResumeSection } from '../types/resume';

const extractDocumentXml = async (resume: ReturnType<typeof createDefaultResumeState>): Promise<string> => {
  const blob = await resumeToDocxBlob(resume);
  const zip = await jszip.loadAsync(await blob.arrayBuffer());
  const docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) throw new Error('word/document.xml missing from .docx package');
  return docXml;
};

describe('Word export', () => {
  it('produces a valid docx (zip) package with A4 page settings', async () => {
    const docXml = await extractDocumentXml(createDefaultResumeState());

    // A4 ≈ 11906 x 16838 twips (docx rounds to 11905 x 16837)
    expect(docXml).toContain('w:w="11905"');
    expect(docXml).toContain('w:h="16837"');
    // 14mm margins ≈ 794 twips (docx rounds to 793)
    expect(docXml).toContain('w:top="793"');
  });

  it('renders personal info, sections, and entry lines', async () => {
    const docXml = await extractDocumentXml(createDefaultResumeState());

    expect(docXml).toContain('张三');
    expect(docXml).toContain('产品经理 / 数据分析师');
    expect(docXml).toContain('工作经历');
    expect(docXml).toContain('XX科技有限公司');
    expect(docXml).toContain('高级产品经理');
    expect(docXml).toContain('2022-03 - 至今');
    expect(docXml).toContain('教育背景');
    expect(docXml).toContain('项目经历');
    expect(docXml).toContain('技能');
  });

  it('keeps **bold** inline syntax as real bold runs', async () => {
    const resume = createDefaultResumeState();
    resume.personal.summary = '负责**核心系统**的搭建';
    const docXml = await extractDocumentXml(resume);

    expect(docXml).toContain('<w:b/>');
    expect(docXml).toContain('核心系统');
  });

  it('skips hidden sections and empty custom sections', async () => {
    const resume = createDefaultResumeState();
    resume.sections = [
      { ...createResumeSection('work', '工作经历'), visible: false, workEntries: [] },
      createResumeSection('custom', '自定义模块'),
    ];
    const docXml = await extractDocumentXml(resume);

    expect(docXml).not.toContain('工作经历');
    expect(docXml).not.toContain('自定义模块');
  });

  it('exports skill groups with bold category labels', async () => {
    const resume = createDefaultResumeState();
    resume.sections = [createResumeSection('skills', '技能')];
    const skillsSection = resume.sections[0];
    skillsSection.skillGroups = [{ category: '数据分析', skills: ['SQL', 'Python'] }];
    skillsSection.languages = [{ language: '英语', fluency: '流利' }];

    const docXml = await extractDocumentXml(resume);
    expect(docXml).toContain('数据分析：');
    expect(docXml).toContain('SQL，Python');
    expect(docXml).toContain('语言：');
    expect(docXml).toContain('英语 (流利)');
  });

  it('handles certificates, awards and affiliations', async () => {
    const resume = createDefaultResumeState();
    const certs = createResumeSection('certs', '证书');
    certs.certificateEntries = [
      { id: 'c1', name: 'PMP', issuer: 'PMI', url: '', date: '2023-06', certId: '12345' },
    ];
    const awards = createResumeSection('awards', '奖项');
    awards.awardEntries = [
      { id: 'a1', title: '一等奖', issuer: '组委会', location: '上海', url: '', date: '2024-05', highlights: ['获奖作品'] },
    ];
    const affiliations = createResumeSection('affiliations', '社团经历');
    affiliations.affiliationEntries = [
      { id: 'f1', organization: '学生会', position: '主席', location: '北京', url: '', startDate: '2018-09', endDate: '2019-06', highlights: [] },
    ];
    resume.sections = [certs, awards, affiliations];

    const docXml = await extractDocumentXml(resume);
    expect(docXml).toContain('PMP');
    expect(docXml).toContain('ID: 12345');
    expect(docXml).toContain('一等奖');
    expect(docXml).toContain('学生会');
    expect(docXml).toContain('主席');
  });

  it('omits the photo when hidden or unsupported, without failing the export', async () => {
    const resume = createDefaultResumeState();
    resume.showPhoto = true;
    resume.photo = { src: 'data:image/webp;base64,AAAA' };

    const doc = await buildResumeDocx(resume);
    expect(doc).toBeTruthy();

    const docXml = await extractDocumentXml(resume);
    expect(docXml).not.toContain('<w:drawing>');
  });

  it('builds the same filename pattern as Markdown export', () => {
    const resume = createDefaultResumeState();
    resume.personal.name = '李四';
    const filename = buildDocxFilename(resume);
    expect(filename).toBe(`李四_${new Date().toISOString().split('T')[0]}`);
  });
});
