import { describe, expect, it } from 'vitest';
import { renderResumeBody, renderResumeDocument } from '../lib/html';
import { createBlankResumeState, createResumeSection, type ResumeState } from '../types/resume';

const fixture = (): ResumeState => {
  const resume = createBlankResumeState('张三');
  resume.personal.email = 'zhangsan@email.com';
  resume.personal.phone = '138-0000-0000';
  resume.personal.url = 'https://zhangsan.dev';
  resume.personal.titles = ['产品经理', '数据分析师'];
  resume.personal.location = { city: '上海', region: '浦东新区' };
  resume.personal.summary = '擅长**数据驱动**迭代';
  resume.personal.profiles = [{ network: 'GitHub', username: 'zhangsan', url: 'https://github.com/zhangsan' }];

  const work = createResumeSection('work');
  work.id = 'sec-work';
  work.title = '工作经历';
  work.workEntries = [
    {
      id: 'work-acme',
      organization: 'Acme',
      location: '上海',
      positions: [
        {
          id: 'pos-pm',
          position: '产品经理',
          startDate: '2022-03',
          endDate: 'present',
          highlights: ['月活提升 **28%**', '把迭代周期压到 2 周'],
        },
      ],
    },
  ];

  const certs = createResumeSection('certs');
  certs.id = 'sec-certs';
  certs.title = '证书';
  certs.certificateEntries = [
    { id: 'cert-pmp', name: 'PMP', issuer: 'PMI', date: '2023-06', certId: 'C-12345' },
    { id: 'cert-other', name: '软考', issuer: '工信部', date: '2022-05' },
  ];

  resume.sections = [work, certs];
  return resume;
};

describe('renderResumeBody — structure', () => {
  it('renders the header, contact row and visible sections', () => {
    const html = renderResumeBody(fixture());

    expect(html).toContain('<h1>张三</h1>');
    expect(html).toContain('<header class="resume-header resume-header-alignment-left">');
    expect(html).toContain('<div class="resume-titles">产品经理 / 数据分析师</div>');
    expect(html).toContain('<div class="resume-location">上海, 浦东新区</div>');
    expect(html).toContain('<span class="contact-item">zhangsan@email.com<span class="separator">◆</span></span>');
    // The last contact item carries no separator.
    expect(html).toContain('<span class="contact-item">GitHub: https://github.com/zhangsan</span>');
    expect(html).toContain('<section class="resume-section">');
    expect(html).toContain('<h2>工作经历</h2>');
  });

  it('adds a shared header alignment class for preview and PDF', () => {
    const resume = fixture();
    resume.headerAlignment = 'center';
    expect(renderResumeBody(resume)).toContain(
      '<header class="resume-header resume-header-alignment-center">',
    );
  });

  it('renders inline bold through <strong>, exactly like the preview', () => {
    const html = renderResumeBody(fixture());
    expect(html).toContain('<div class="resume-summary">擅长<strong>数据驱动</strong>迭代</div>');
    expect(html).toContain('<li>月活提升 <strong>28%</strong></li>');
  });

  it('turns a present end date into 至今', () => {
    expect(renderResumeBody(fixture())).toContain('<span class="entry-date">2022-03 - 至今</span>');
  });

  it('skips invisible sections', () => {
    const resume = fixture();
    resume.sections[0].visible = false;
    const html = renderResumeBody(resume);
    expect(html).not.toContain('工作经历');
    expect(html).toContain('证书');
  });

  it('omits the header fields that are switched off', () => {
    const resume = fixture();
    resume.showEmail = false;
    resume.showSummary = false;
    const html = renderResumeBody(resume);
    expect(html).not.toContain('zhangsan@email.com');
    expect(html).not.toContain('resume-summary');
    expect(html).toContain('138-0000-0000');
  });
});

describe('renderResumeBody — escaping', () => {
  it('escapes markup coming from the resume', () => {
    const resume = fixture();
    resume.personal.name = '<script>alert(1)</script>';
    resume.personal.summary = 'a & b < c';
    const html = renderResumeBody(resume);

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('a &amp; b &lt; c');
  });

  it('escapes a photo url so it cannot break out of the attribute', () => {
    const resume = fixture();
    resume.showPhoto = true;
    resume.photo = { src: 'x" onerror="alert(1)' };
    const html = renderResumeBody(resume);

    expect(html).not.toContain('onerror="alert(1)"');
    expect(html).toContain('&quot;');
    expect(html).toContain('resume-header-with-photo');
  });

  it('escapes a bold run without letting the tags through', () => {
    const resume = fixture();
    resume.personal.summary = '**<b>x</b>**';
    expect(renderResumeBody(resume)).toContain('<strong>&lt;b&gt;x&lt;/b&gt;</strong>');
  });
});

describe('renderResumeBody — certificates', () => {
  it('prints the certificate id when there is one, and nothing when there is not', () => {
    const html = renderResumeBody(fixture());
    expect(html).toContain('<div class="cert-issuer"><em>PMI</em> · ID: C-12345</div>');
    // `cert-other` has no certId: the entry's internal id must never be printed.
    expect(html).toContain('<span class="cert-name">软考</span>');
    expect(html).not.toContain('cert-other');
    expect(html).not.toContain('cert-pmp<');
  });
});

describe('renderResumeBody — highlights', () => {
  it('renders bullets when only a later highlight has content', () => {
    const resume = fixture();
    // The editor seeds new entries with one empty placeholder bullet, so this
    // shape is common. The old preview dropped the whole list here.
    resume.sections[0].workEntries![0].positions[0].highlights = ['', '第二条才是有内容的'];
    const html = renderResumeBody(resume);

    expect(html).toContain('<li>第二条才是有内容的</li>');
    expect(html).not.toContain('<li></li>');
  });

  it('renders no list at all when every highlight is blank', () => {
    const resume = fixture();
    resume.sections[0].workEntries![0].positions[0].highlights = ['', '  '];
    expect(renderResumeBody(resume)).not.toContain('entry-highlights');
  });
});

describe('renderResumeDocument', () => {
  it('wraps the body in the same frame the preview uses', () => {
    const html = renderResumeDocument(fixture(), { css: '/* css */' });
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<style>\n/* css */\n</style>');
    expect(html).toContain('<div class="a4-stage">');
    expect(html).toContain('<div class="a4-page">');
    expect(html).toContain(
      '<div class="a4-content" style="--resume-font-size: 9.5pt; --resume-font-family: \'Source Han Serif SC\', \'Source Han Serif CN\', \'Songti SC\', \'Noto Serif SC\', STSong, SimSun, serif">',
    );
  });

  it('passes the physical font size through without a document scale', () => {
    const resume = fixture();
    resume.fontSizePt = 10;
    const html = renderResumeDocument(resume, { css: '' });
    expect(html).toContain('--resume-font-size: 10pt');
    expect(html).not.toContain('--resume-font-scale');
    expect(html).not.toContain('transform: scale');
  });

  it('passes the chosen Anthropic family to preview and PDF rendering', () => {
    const resume = fixture();
    resume.fontFamily = 'anthropic-sans';
    const html = renderResumeDocument(resume, { css: '' });
    expect(html).toContain("--resume-font-family: 'Anthropic Sans', 'PingFang SC'");
  });

  it('appends the extra stylesheet after the main one', () => {
    const html = renderResumeDocument(fixture(), { css: 'a{}', extraCss: 'b{}' });
    expect(html.indexOf('a{}')).toBeLessThan(html.indexOf('b{}'));
  });
});

describe('renderResumeBody — custom and skills sections', () => {
  it('drops empty custom items and keeps the rest', () => {
    const resume = fixture();
    const custom = createResumeSection('custom');
    custom.id = 'sec-custom';
    custom.title = '其他';
    custom.items = [
      { id: 'item-1', text: '  ' },
      { id: 'item-2', text: ' 有内容 ' },
    ];
    resume.sections = [custom];

    const html = renderResumeBody(resume);
    expect(html).toContain('<div style="margin-bottom: 4px">有内容</div>');
    expect(html.match(/margin-bottom: 4px/gu)).toHaveLength(1);
  });
});

describe('renderResumeBody — 字段类型不对时也不抛错', () => {
  it('数字电话不会被当成字符串调 .replace', () => {
    const resume = fixture();
    // 类型上不允许，但 localStorage / 云端存的是 JSON.parse 的结果。
    (resume.personal as { phone: unknown }).phone = 17366901793;

    expect(() => renderResumeBody(resume)).not.toThrow();
    expect(renderResumeBody(resume)).toContain('17366901793');
  });
});
