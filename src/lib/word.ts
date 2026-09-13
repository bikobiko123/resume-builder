import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
  convertMillimetersToTwip,
  type IParagraphOptions,
  type ISectionOptions,
  type ParagraphChild,
} from 'docx';
import type {
  AwardEntry,
  CertificateEntry,
  EducationEntry,
  ProjectEntry,
  ResumeState,
  ResumeSection,
} from '../types/resume';
import { sanitizeSkillGroups } from './skills';

/**
 * Word (.docx) export.
 *
 * Mirrors the A4 preview as closely as Word allows:
 * A4 page, 14mm margins, centered header, section headings with a bottom
 * border, entries with a right-aligned date column (via a tab stop), bold
 * org/title lines, disc bullets, and the same `**bold**` inline syntax.
 */

// 1 pt = 20 half-points (docx TextRun size unit)
const PT = 20;

const SERIF_FONTS = ['Noto Serif SC', 'Source Han Serif SC', 'STSong', 'SimSun', 'serif'];

// A4: 210mm x 297mm. docx already defaults to A4, but pin it explicitly.
const PAGE_SIZE = {
  width: convertMillimetersToTwip(210),
  height: convertMillimetersToTwip(297),
};

const scaledPt = (px: number, fontSizePt: number): number => Math.round(px * (fontSizePt / 11) * PT);

const formatDateRange = (start: string, end: string): string => {
  const startStr = start || '';
  const endStr = end === 'present' ? '至今' : (end || '');
  if (startStr && endStr) return `${startStr} - ${endStr}`;
  if (startStr) return startStr;
  return endStr;
};

/** Split `**bold**` inline markdown into docx TextRuns. */
const renderInlineRuns = (text: string, fontSizeHalfPt: number, options: { italics?: boolean } = {}): TextRun[] => {
  const runs: TextRun[] = [];
  const pattern = /\*\*(.+?)\*\*/gu;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index), size: fontSizeHalfPt, ...options }));
    }
    runs.push(new TextRun({ text: match[1], bold: true, size: fontSizeHalfPt, ...options }));
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex), size: fontSizeHalfPt, ...options }));
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text: '', size: fontSizeHalfPt, ...options }));
  }

  return runs;
};

interface EntryHeadingOptions {
  fontSizeHalfPt: number;
  /** Right-aligned text, rendered at a tab stop on the right margin (mirrors flex space-between). */
  rightText?: string;
  rightBold?: boolean;
}

/** Entry first line: bold left label + optional right-aligned text on the same line. */
const entryHeadingParagraph = (label: string, options: EntryHeadingOptions): Paragraph => {
  const { fontSizeHalfPt, rightText, rightBold = false } = options;
  const children: ParagraphChild[] = [
    new TextRun({ text: label, bold: true, size: fontSizeHalfPt }),
  ];

  if (rightText) {
    children.push(new TextRun({ text: '\t', size: fontSizeHalfPt }));
    children.push(new TextRun({ text: rightText, bold: rightBold, size: fontSizeHalfPt }));
  }

  return new Paragraph({
    children,
    spacing: { after: 40 },
    tabStops: rightText
      ? [{ type: TabStopType.RIGHT, position: convertMillimetersToTwip(182) }]
      : undefined,
  });
};

interface LineParagraphOptions extends IParagraphOptions {
  runOptions?: { italics?: boolean; bold?: boolean };
}

/** Simple single-line paragraph with the given font size. */
const lineParagraph = (text: string, fontSizeHalfPt: number, options: LineParagraphOptions = {}): Paragraph => {
  const { runOptions, ...paragraphOptions } = options;
  return new Paragraph({
    spacing: { after: 40 },
    ...paragraphOptions,
    children: renderInlineRuns(text, fontSizeHalfPt, runOptions),
  });
};

const sectionHeadingParagraph = (title: string, fontSizeHalfPt: number): Paragraph =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 160, after: 80 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 2 },
    },
    children: [new TextRun({ text: title, bold: true, size: fontSizeHalfPt })],
  });

const bulletParagraph = (highlight: string, fontSizeHalfPt: number): Paragraph =>
  new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 20, line: 276 },
    children: renderInlineRuns(highlight, fontSizeHalfPt),
  });

// --- Section renderers ------------------------------------------------------

const workSectionParagraphs = (section: ResumeSection, hp: number): Paragraph[] => {
  const paragraphs: Paragraph[] = [];
  for (const entry of section.workEntries ?? []) {
    paragraphs.push(
      entryHeadingParagraph(
        entry.location ? `${entry.organization}   ${entry.location}` : entry.organization,
        { fontSizeHalfPt: hp, rightText: '' },
      ),
    );
    for (const pos of entry.positions) {
      paragraphs.push(
        entryHeadingParagraph(pos.position, {
          fontSizeHalfPt: hp,
          rightText: formatDateRange(pos.startDate, pos.endDate),
        }),
      );
      for (const highlight of pos.highlights) {
        if (highlight.trim()) paragraphs.push(bulletParagraph(highlight, hp));
      }
    }
  }
  return paragraphs;
};

const educationSectionParagraphs = (section: ResumeSection, hp: number): Paragraph[] => {
  const paragraphs: Paragraph[] = [];
  for (const entry of (section.educationEntries ?? []) as EducationEntry[]) {
    const degree = entry.area ? `${entry.studyType} - ${entry.area}` : entry.studyType;
    paragraphs.push(
      entryHeadingParagraph(
        entry.location ? `${entry.institution}   ${entry.location}` : entry.institution,
        { fontSizeHalfPt: hp, rightText: '' },
      ),
      entryHeadingParagraph(degree, {
        fontSizeHalfPt: hp,
        rightText: formatDateRange(entry.startDate, entry.endDate),
      }),
    );

    const honorsLabel = (entry.honorsLabel || '荣誉').trim() || '荣誉';
    if (entry.honors && entry.honors.length > 0) {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: `${honorsLabel}：`, bold: true, size: hp }),
            ...renderInlineRuns(entry.honors.join('，'), hp),
          ],
        }),
      );
    }
    if (entry.courses && entry.courses.length > 0) {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: '课程：', bold: true, size: hp }),
            ...renderInlineRuns(entry.courses.join('，'), hp),
          ],
        }),
      );
    }
    for (const highlight of entry.highlights ?? []) {
      if (highlight.trim()) paragraphs.push(bulletParagraph(highlight, hp));
    }
  }
  return paragraphs;
};

const projectSectionParagraphs = (section: ResumeSection, hp: number): Paragraph[] => {
  const paragraphs: Paragraph[] = [];
  for (const entry of (section.projectEntries ?? []) as ProjectEntry[]) {
    paragraphs.push(entryHeadingParagraph(entry.name, { fontSizeHalfPt: hp, rightText: '' }));
    paragraphs.push(
      entryHeadingParagraph(entry.affiliation || '', {
        fontSizeHalfPt: hp,
        rightText: formatDateRange(entry.startDate, entry.endDate),
      }),
    );
    for (const highlight of entry.highlights) {
      if (highlight.trim()) paragraphs.push(bulletParagraph(highlight, hp));
    }
  }
  return paragraphs;
};

const awardSectionParagraphs = (section: ResumeSection, hp: number): Paragraph[] => {
  const paragraphs: Paragraph[] = [];
  for (const entry of (section.awardEntries ?? []) as AwardEntry[]) {
    paragraphs.push(
      entryHeadingParagraph(entry.title, {
        fontSizeHalfPt: hp,
        rightText: entry.date,
      }),
    );
    if (entry.issuer || entry.location) {
      const issuer = [entry.issuer, entry.location].filter(Boolean).join(' · ');
      paragraphs.push(lineParagraph(issuer, hp, { runOptions: { italics: true } }));
    }
    for (const highlight of entry.highlights ?? []) {
      if (highlight.trim()) paragraphs.push(bulletParagraph(highlight, hp));
    }
  }
  return paragraphs;
};

const certificateSectionParagraphs = (section: ResumeSection, hp: number): Paragraph[] => {
  const paragraphs: Paragraph[] = [];
  for (const entry of (section.certificateEntries ?? []) as CertificateEntry[]) {
    paragraphs.push(
      entryHeadingParagraph(entry.name, { fontSizeHalfPt: hp, rightText: entry.date }),
    );
    const parts: string[] = [];
    if (entry.issuer) parts.push(entry.issuer);
    if (entry.certId) parts.push(`ID: ${entry.certId}`);
    if (parts.length > 0) {
      paragraphs.push(lineParagraph(parts.join(' · '), hp, { runOptions: { italics: true } }));
    }
  }
  return paragraphs;
};

const affiliationSectionParagraphs = (section: ResumeSection, hp: number): Paragraph[] => {
  const paragraphs: Paragraph[] = [];
  for (const entry of section.affiliationEntries ?? []) {
    paragraphs.push(entryHeadingParagraph(entry.organization, { fontSizeHalfPt: hp, rightText: '' }));
    paragraphs.push(
      entryHeadingParagraph(entry.position, {
        fontSizeHalfPt: hp,
        rightText: formatDateRange(entry.startDate, entry.endDate),
      }),
    );
    for (const highlight of entry.highlights ?? []) {
      if (highlight.trim()) paragraphs.push(bulletParagraph(highlight, hp));
    }
  }
  return paragraphs;
};

const skillsSectionParagraphs = (section: ResumeSection, hp: number): Paragraph[] => {
  const paragraphs: Paragraph[] = [];

  if (section.languages && section.languages.length > 0) {
    const langStr = section.languages.map((l) => `${l.language} (${l.fluency})`).join('，');
    paragraphs.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({ text: '语言：', bold: true, size: hp }),
          ...renderInlineRuns(langStr, hp),
        ],
      }),
    );
  }

  for (const group of sanitizeSkillGroups(section.skillGroups)) {
    paragraphs.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({ text: `${group.category}：`, bold: true, size: hp }),
          ...renderInlineRuns(group.skills.join('，'), hp),
        ],
      }),
    );
  }

  if (section.interests && section.interests.length > 0) {
    paragraphs.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({ text: '兴趣爱好：', bold: true, size: hp }),
          new TextRun({ text: section.interests.join('，'), size: hp }),
        ],
      }),
    );
  }

  return paragraphs;
};

const customSectionParagraphs = (section: ResumeSection, hp: number): Paragraph[] =>
  (section.items ?? [])
    .map((item) => item.text.trim())
    .filter(Boolean)
    .map((text) => lineParagraph(text, hp, { spacing: { after: 60 } }));

const sectionParagraphs = (section: ResumeSection, hp: number): Paragraph[] => {
  switch (section.type) {
    case 'work':
      return workSectionParagraphs(section, hp);
    case 'education':
      return educationSectionParagraphs(section, hp);
    case 'project':
      return projectSectionParagraphs(section, hp);
    case 'awards':
      return awardSectionParagraphs(section, hp);
    case 'certs':
      return certificateSectionParagraphs(section, hp);
    case 'affiliations':
      return affiliationSectionParagraphs(section, hp);
    case 'skills':
      return skillsSectionParagraphs(section, hp);
    default:
      return customSectionParagraphs(section, hp);
  }
};

// --- Photo ------------------------------------------------------------------

interface DecodedPhoto {
  data: Uint8Array;
  width: number;
  height: number;
  type: 'jpg' | 'png';
}

const decodeDataUrl = (src: string): { type: 'jpg' | 'png'; base64: string } | null => {
  const match = src.match(/^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/);
  if (!match) return null;
  const type = match[1] === 'image/png' ? 'png' : 'jpg';
  return { type, base64: match[2] };
};

const base64ToUint8 = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/**
 * Load a PNG/JPEG data URL and measure its pixel size.
 * The crop pipeline stores photos as JPEG, so this covers the normal path.
 */
const decodePhoto = (src: string): Promise<DecodedPhoto> =>
  new Promise((resolve, reject) => {
    const decoded = decodeDataUrl(src);
    if (!decoded) {
      reject(new Error('头像格式不支持，仅支持 PNG / JPEG'));
      return;
    }

    const image = new Image();
    image.onload = () => {
      resolve({
        data: base64ToUint8(decoded.base64),
        width: image.naturalWidth || 1,
        height: image.naturalHeight || 1,
        type: decoded.type,
      });
    };
    image.onerror = () => reject(new Error('头像图片解析失败'));
    image.src = src;
  });

// --- Document ---------------------------------------------------------------

interface HeaderLines {
  nameLines: Paragraph[];
  photo?: { run: ImageRun; width: number };
}

const buildHeader = (resume: ResumeState): HeaderLines => {
  const { personal } = resume;
  const contactItems: string[] = [];
  if (personal.email && resume.showEmail) contactItems.push(personal.email);
  if (personal.phone && resume.showPhone) contactItems.push(personal.phone);
  if (personal.url && resume.showUrl) contactItems.push(personal.url);
  if (resume.showProfiles) {
    for (const profile of personal.profiles ?? []) {
      contactItems.push(`${profile.network}: ${profile.url}`);
    }
  }

  const locationParts = [personal.location?.city, personal.location?.region].filter(Boolean);
  const locationStr = locationParts.join(', ');

  const nameLines: Paragraph[] = [];
  if (resume.showName) {
    nameLines.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: personal.name, bold: true, size: scaledPt(24, resume.fontSizePt) })],
      }),
    );
  }

  if (personal.titles && personal.titles.length > 0 && resume.showTitle) {
    nameLines.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new TextRun({ text: personal.titles.join(' / '), italics: true, size: scaledPt(13, resume.fontSizePt) })],
      }),
    );
  }

  if (locationStr && resume.showAddress) {
    nameLines.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new TextRun({ text: locationStr, size: scaledPt(11, resume.fontSizePt) })],
      }),
    );
  }

  if (contactItems.length > 0) {
    nameLines.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new TextRun({ text: contactItems.join('  ◆  '), size: scaledPt(11, resume.fontSizePt) })],
      }),
    );
  }

  if (personal.summary && resume.showSummary) {
    nameLines.push(
      new Paragraph({
        spacing: { after: 60 },
        children: renderInlineRuns(personal.summary, scaledPt(11, resume.fontSizePt)),
      }),
    );
  }

  return { nameLines };
};

export const buildResumeDocx = async (resume: ResumeState): Promise<Document> => {
  const hp = scaledPt(11, resume.fontSizePt);
  const { nameLines } = buildHeader(resume);

  // Header paragraph list: with a visible photo, preview switches to a
  // two-column grid (text left, photo right); approximate with a borderless
  // table. Without a photo everything is centered full-width.
  const shouldShowPhoto = Boolean(resume.showPhoto && resume.photo?.src);
  let photo: { run: ImageRun } | undefined;
  if (shouldShowPhoto && resume.photo?.src) {
    try {
      const decoded = await decodePhoto(resume.photo.src);
      // 22mm avatar box in the preview; 1px = 15 twips in the transformation.
      const widthPx = convertMillimetersToTwip(22) / 15;
      const aspect = decoded.height / decoded.width;
      photo = {
        run: new ImageRun({
          type: decoded.type,
          data: decoded.data,
          transformation: {
            width: widthPx,
            height: widthPx * aspect,
          },
        }),
      };
    } catch (error) {
      // Photo export is best-effort; a broken image should not block the export.
      console.warn('跳过头像导出:', error);
    }
  }

  const headerParagraphs: Paragraph[] = [];
  if (photo) {
    headerParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [photo.run],
      }),
    );
  }
  headerParagraphs.push(...nameLines);

  const sectionParagraphList: Paragraph[] = [];
  for (const section of resume.sections) {
    if (!section.visible) continue;
    if (!hasSectionContent(section)) continue;
    sectionParagraphList.push(sectionHeadingParagraph(section.title, hp));
    sectionParagraphList.push(...sectionParagraphs(section, hp));
  }

  const section: ISectionOptions = {
    properties: {
      page: {
        size: PAGE_SIZE,
        margin: {
          top: convertMillimetersToTwip(14),
          bottom: convertMillimetersToTwip(14),
          left: convertMillimetersToTwip(14),
          right: convertMillimetersToTwip(14),
        },
      },
    },
    children: [...headerParagraphs, ...sectionParagraphList],
  };

  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: SERIF_FONTS[0],
            size: hp,
          },
        },
      },
    },
    sections: [section],
  });
};

const hasSectionContent = (section: ResumeSection): boolean => {
  switch (section.type) {
    case 'work':
      return (section.workEntries ?? []).length > 0;
    case 'education':
      return (section.educationEntries ?? []).length > 0;
    case 'project':
      return (section.projectEntries ?? []).length > 0;
    case 'awards':
      return (section.awardEntries ?? []).length > 0;
    case 'certs':
      return (section.certificateEntries ?? []).length > 0;
    case 'affiliations':
      return (section.affiliationEntries ?? []).length > 0;
    case 'skills':
      return (
        (section.skillGroups ?? []).length > 0 ||
        (section.languages ?? []).length > 0 ||
        (section.interests ?? []).length > 0
      );
    default:
      return (section.items ?? []).some((item) => item.text.trim());
  }
};

/** Serialize the resume to a .docx blob (browser). */
export const resumeToDocxBlob = async (resume: ResumeState): Promise<Blob> => {
  const doc = await buildResumeDocx(resume);
  return Packer.toBlob(doc);
};

/** Trigger a browser download for the generated .docx file. */
export const downloadDocx = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/** Build the export filename the same way Markdown export does. */
export const buildDocxFilename = (resume: ResumeState): string =>
  `${resume.personal.name || '简历'}_${new Date().toISOString().split('T')[0]}`;
