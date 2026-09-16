import {
  type AwardEntry,
  type CertificateEntry,
  type EducationEntry,
  type ProjectEntry,
  type ResumeSection,
  type ResumeState,
  type WorkEntry,
} from '../types/resume';
import { resumeFontStack } from './fonts';
import { formatDateRange } from './format';
import { escapeHtml, renderInlineHtml } from './inline';
import { sanitizeSkillGroups } from './skills';

/**
 * The one place that turns a `ResumeState` into the A4 markup.
 *
 * The React preview, the headless `measure` command and the future PDF export
 * all render this output, so there is exactly one layout implementation to keep
 * honest. If the preview and the measurement ever disagree, the measurement is
 * worthless — that is the whole reason this module exists rather than a second
 * renderer written for Node.
 *
 * The markup mirrors `src/styles/a4.css` class names and nesting exactly;
 * changing it without changing the stylesheet (or the other way round) will
 * move the layout.
 *
 * ESCAPING CONTRACT — this output is rendered with `dangerouslySetInnerHTML` in
 * `PreviewA4` and written to a file by the CLI, so a resume loaded from disk or
 * written by an agent is untrusted input. Every interpolated value must go
 * through `escapeHtml` (text and attributes) or `renderInlineHtml` (text that
 * may contain `**bold**`, which escapes internally). The only raw HTML in the
 * result is the tags written in this file. Do not add an interpolation without
 * one of those two wrappers.
 *
 * The `css` and `extraCss` options of `renderResumeDocument` are injected into a
 * `<style>` element verbatim — they are for the repository's own stylesheets,
 * never for anything that came out of a resume.
 */

const nonEmpty = (values: readonly string[]): string[] => values.filter((value) => value.trim().length > 0);

const list = (highlights: readonly string[] | undefined, indent = ''): string => {
  const visible = nonEmpty(highlights ?? []);
  if (visible.length === 0) return '';
  const items = visible
    .map((highlight) => `${indent}  <li>${renderInlineHtml(highlight)}</li>`)
    .join('\n');
  return `${indent}<ul class="entry-highlights">\n${items}\n${indent}</ul>`;
};

const workSection = (section: ResumeSection): string => {
  const entries = section.workEntries;
  if (!entries) return '';

  const body = entries
    .map((entry: WorkEntry) => {
      const positions = entry.positions
        .map((position) => {
          const highlights = list(position.highlights, '        ');
          const line2 = `<div class="entry-line2"><span class="entry-position">${escapeHtml(position.position)}</span><span class="entry-date">${escapeHtml(formatDateRange(position.startDate, position.endDate))}</span></div>`;
          return highlights
            ? `      <div>\n        ${line2}\n${highlights}\n      </div>`
            : `      <div>${line2}</div>`;
        })
        .join('\n');

      return [
        '    <div class="entry">',
        `      <div class="entry-line1"><span class="entry-org">${escapeHtml(entry.organization)}</span><span class="entry-location">${escapeHtml(entry.location)}</span></div>`,
        positions,
        '    </div>',
      ].join('\n');
    })
    .join('\n');

  return `  <div class="entries">\n${body}\n  </div>`;
};

const educationSection = (section: ResumeSection): string => {
  const entries = section.educationEntries;
  if (!entries) return '';

  const body = entries
    .map((entry: EducationEntry) => {
      const honorsLabel = (entry.honorsLabel || '荣誉').trim() || '荣誉';
      const honors = nonEmpty(entry.honors ?? []);
      const courses = nonEmpty(entry.courses ?? []);
      const highlights = nonEmpty(entry.highlights ?? []);

      const details: string[] = [];
      if (honors.length > 0) {
        details.push(`        <div class="detail-item"><strong>${escapeHtml(honorsLabel)}：</strong>${renderInlineHtml(honors.join('，'))}</div>`);
      }
      if (courses.length > 0) {
        details.push(`        <div class="detail-item"><strong>课程：</strong>${renderInlineHtml(courses.join('，'))}</div>`);
      }
      if (highlights.length > 0) {
        details.push(`        <ul class="entry-highlights">\n${highlights.map((highlight) => `          <li>${renderInlineHtml(highlight)}</li>`).join('\n')}\n        </ul>`);
      }

      const lines = [
        '    <div class="entry">',
        `      <div class="entry-line1"><span class="entry-org">${escapeHtml(entry.institution)}</span><span class="entry-location">${escapeHtml(entry.location)}</span></div>`,
        `      <div class="entry-line2"><span class="edu-degree">${escapeHtml(entry.studyType)}${entry.area ? ` - ${escapeHtml(entry.area)}` : ''}</span><span class="entry-date">${escapeHtml(formatDateRange(entry.startDate, entry.endDate))}</span></div>`,
      ];
      if (details.length > 0) {
        lines.push(`      <div class="edu-details">\n${details.join('\n')}\n      </div>`);
      }
      lines.push('    </div>');
      return lines.join('\n');
    })
    .join('\n');

  return `  <div class="entries">\n${body}\n  </div>`;
};

const projectSection = (section: ResumeSection): string => {
  const entries = section.projectEntries;
  if (!entries) return '';

  const body = entries
    .map((entry: ProjectEntry) => {
      const highlights = list(entry.highlights, '      ');
      const lines = [
        '    <div class="entry">',
        `      <div class="entry-line1"><span class="entry-org">${escapeHtml(entry.name)}</span></div>`,
        `      <div class="entry-line2"><span class="entry-position">${escapeHtml(entry.affiliation ?? '')}</span><span class="entry-date">${escapeHtml(formatDateRange(entry.startDate, entry.endDate))}</span></div>`,
      ];
      if (highlights) lines.push(highlights);
      lines.push('    </div>');
      return lines.join('\n');
    })
    .join('\n');

  return `  <div class="entries">\n${body}\n  </div>`;
};

const awardSection = (section: ResumeSection): string => {
  const entries = section.awardEntries;
  if (!entries) return '';

  const body = entries
    .map((entry: AwardEntry) => {
      const highlights = list(entry.highlights, '      ');
      const lines = [
        '    <div class="entry">',
        `      <div class="award-line1"><span class="award-title">${escapeHtml(entry.title)}</span><span class="entry-date">${escapeHtml(entry.date)}</span></div>`,
        `      <div class="award-issuer"><em>${escapeHtml(entry.issuer)}</em>${entry.location ? ` · ${escapeHtml(entry.location)}` : ''}</div>`,
      ];
      if (highlights) lines.push(highlights);
      lines.push('    </div>');
      return lines.join('\n');
    })
    .join('\n');

  return `  <div class="entries">\n${body}\n  </div>`;
};

const certificateSection = (section: ResumeSection): string => {
  const entries = section.certificateEntries;
  if (!entries) return '';

  const body = entries
    .map((entry: CertificateEntry) => [
      '    <div class="entry">',
      `      <div class="cert-line1"><span class="cert-name">${escapeHtml(entry.name)}</span><span class="entry-date">${escapeHtml(entry.date)}</span></div>`,
      // `certId` — the previous preview rendered the entry's internal uuid here,
      // which is what the .docx exporter already disagreed with.
      `      <div class="cert-issuer"><em>${escapeHtml(entry.issuer)}</em>${entry.certId ? ` · ID: ${escapeHtml(entry.certId)}` : ''}</div>`,
      '    </div>',
    ].join('\n'))
    .join('\n');

  return `  <div class="entries">\n${body}\n  </div>`;
};

const skillsSection = (section: ResumeSection): string => {
  const rows: string[] = [];

  if (section.languages && section.languages.length > 0) {
    const languages = section.languages.map((language) => `${language.language} (${language.fluency})`).join('，');
    rows.push(`    <div class="skill-category"><span class="skill-label">语言：</span>${renderInlineHtml(languages)}</div>`);
  }

  for (const group of sanitizeSkillGroups(section.skillGroups)) {
    rows.push(`    <div class="skill-category"><span class="skill-label">${escapeHtml(group.category)}：</span>${renderInlineHtml(group.skills.join('，'))}</div>`);
  }

  if (section.interests && section.interests.length > 0) {
    rows.push(`    <div class="skill-category"><span class="skill-label">兴趣爱好：</span>${escapeHtml(section.interests.join('，'))}</div>`);
  }

  return rows.length > 0 ? `  <div class="skills-content">\n${rows.join('\n')}\n  </div>` : '  <div class="skills-content"></div>';
};

const customSection = (section: ResumeSection): string => {
  const items = (section.items ?? []).map((item) => item.text.trim()).filter(Boolean);
  if (items.length === 0) return '';
  const rows = items.map((text) => `    <div style="margin-bottom: 4px">${renderInlineHtml(text)}</div>`);
  return `  <div class="custom-content">\n${rows.join('\n')}\n  </div>`;
};

const sectionBlock = (section: ResumeSection): string => {
  const inner: string[] = [];

  switch (section.type) {
    case 'work':
      inner.push(workSection(section));
      break;
    case 'education':
      inner.push(educationSection(section));
      break;
    case 'project':
      inner.push(projectSection(section));
      break;
    case 'awards':
      inner.push(awardSection(section));
      break;
    case 'certs':
      inner.push(certificateSection(section));
      break;
    case 'skills':
      inner.push(skillsSection(section));
      break;
    default:
      break;
  }

  inner.push(customSection(section));

  const children = inner.filter(Boolean).join('\n');

  return [
    `  <section class="resume-section">`,
    `    <h2>${escapeHtml(section.title)}</h2>`,
    children,
    '  </section>',
  ]
    .filter(Boolean)
    .join('\n');
};

/** One `<section class="resume-section">` block. Exported so `validate` can ask the
 * renderer — rather than a second copy of the rules — whether a section would
 * actually show anything. */
export const renderResumeSection = sectionBlock;

/** Everything inside `.a4-content` — the header plus every visible section. */
export const renderResumeBody = (resume: ResumeState): string => {
  const { personal } = resume;
  const shouldShowPhoto = Boolean(resume.showPhoto && resume.photo?.src);

  const contactItems: string[] = [];
  if (personal.email && resume.showEmail) contactItems.push(personal.email);
  if (personal.phone && resume.showPhone) contactItems.push(personal.phone);
  if (personal.url && resume.showUrl) contactItems.push(personal.url);
  if (resume.showProfiles) {
    personal.profiles?.forEach((profile) => contactItems.push(`${profile.network}: ${profile.url}`));
  }

  const locationParts: string[] = [];
  if (personal.location?.city) locationParts.push(personal.location.city);
  if (personal.location?.region) locationParts.push(personal.location.region);
  const locationStr = locationParts.join(', ');

  const headerContent: string[] = [];
  if (resume.showName) headerContent.push(`      <h1>${escapeHtml(personal.name)}</h1>`);
  if (personal.titles && personal.titles.length > 0 && resume.showTitle) {
    headerContent.push(`      <div class="resume-titles">${escapeHtml(personal.titles.join(' / '))}</div>`);
  }
  if (locationStr && resume.showAddress) {
    headerContent.push(`      <div class="resume-location">${escapeHtml(locationStr)}</div>`);
  }
  if (contactItems.length > 0) {
    const spans = contactItems
      .map((item, index) => {
        const separator = index < contactItems.length - 1 ? '<span class="separator">◆</span>' : '';
        return `        <span class="contact-item">${escapeHtml(item)}${separator}</span>`;
      })
      .join('\n');
    headerContent.push(`      <div class="resume-contact">\n${spans}\n      </div>`);
  }
  if (personal.summary && resume.showSummary) {
    headerContent.push(`      <div class="resume-summary">${renderInlineHtml(personal.summary)}</div>`);
  }

  const headerClass = [
    'resume-header',
    `resume-header-alignment-${resume.headerAlignment}`,
    shouldShowPhoto ? 'resume-header-with-photo' : '',
  ].filter(Boolean).join(' ');
  const headerLines = [
    `  <header class="${headerClass}">`,
    '    <div class="header-content">',
    headerContent.join('\n'),
    '    </div>',
  ];
  if (shouldShowPhoto && resume.photo) {
    headerLines.push(`    <div class="avatar-box"><img src="${escapeHtml(resume.photo.src)}" alt="头像"></div>`);
  }
  headerLines.push('  </header>');

  const sections = resume.sections.filter((section) => section.visible).map(sectionBlock);

  return [headerLines.join('\n'), ...sections].filter(Boolean).join('\n');
};

export interface ResumeDocumentOptions {
  /** Stylesheet text. The CLI reads `base.css` + `a4.css` off disk and passes them in. */
  css: string;
  /** Extra rules appended after `css` — `measure` uses this to relax `min-height`. */
  extraCss?: string;
  title?: string;
}

/**
 * A standalone HTML document. `measure` loads this in a real browser, and it is
 * what the PDF export will print.
 */
export const renderResumeDocument = (resume: ResumeState, options: ResumeDocumentOptions): string => {
  const style = [
    `--resume-font-size: ${resume.fontSizePt}pt`,
    `--resume-font-family: ${resumeFontStack(resume.fontFamily)}`,
  ];

  const title = options.title ?? (resume.personal.name || '简历');

  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(title)}</title>`,
    '<style>',
    options.css,
    '</style>',
    ...(options.extraCss ? ['<style>', options.extraCss, '</style>'] : []),
    '</head>',
    '<body>',
    '<section class="preview-document" id="print-root">',
    '  <div class="a4-stage">',
    '    <div class="a4-page">',
    `      <div class="a4-content" style="${style.join('; ')}">`,
    renderResumeBody(resume),
    '      </div>',
    '    </div>',
    '  </div>',
    '</section>',
    '</body>',
    '</html>',
  ].join('\n');
};

/** Relax `min-height` so the measured height is the content's, not the page's. */
export const MEASURE_EXTRA_CSS = '.a4-content { min-height: 0 !important; }';
