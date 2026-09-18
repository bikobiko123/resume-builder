import {
  MAX_LEVEL_FONT_SIZE_PT,
  MAX_RESUME_FONT_SIZE_PT,
  MAX_RESUME_SPACING,
  MIN_LEVEL_FONT_SIZE_PT,
  MIN_RESUME_FONT_SIZE_PT,
  MIN_RESUME_SPACING,
  normalizeLevelFontSize,
  normalizeResumeFontFamily,
  normalizeResumeFontSize,
  normalizeResumeHeaderAlignment,
  normalizeResumeSpacing,
  type AffiliationEntry,
  type AwardEntry,
  type CertificateEntry,
  type CustomItem,
  type EducationEntry,
  type Language,
  type PhotoData,
  type Position,
  type Profile,
  type ProjectEntry,
  type ResumeSection,
  type ResumeState,
  type SectionType,
  type SkillGroup,
  type WorkEntry,
} from '../types/resume';
import { collectIds } from './ids';
import { renderResumeSection } from './html';

/**
 * Reading a resume off disk (or out of an agent's JSON) and making it safe to
 * render.
 *
 * Two separate jobs, deliberately kept apart:
 *
 * - `normalizeResume` coerces a loosely-shaped document into a complete
 *   `ResumeState` so rendering can never crash. It repairs types, fills missing
 *   booleans, and records every repair as a warning — it never invents content.
 * - `validateResume` reports on content: empty fields, placeholder bullets,
 *   toggles that render nothing, dates it cannot read. Warnings only, except for
 *   duplicate ids, which break patch addressing and are therefore errors.
 */

export class ResumeSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResumeSchemaError';
  }
}

export const SECTION_TYPES: readonly SectionType[] = [
  'work',
  'education',
  'project',
  'skills',
  'certs',
  'awards',
  'affiliations',
  'custom',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  isRecord(value) ? value : undefined;

class Normalizer {
  readonly warnings: string[] = [];

  warn(path: string, message: string): void {
    this.warnings.push(`${path}: ${message}`);
  }

  str(value: unknown, path: string, fallback = ''): string {
    if (typeof value === 'string') return value;
    if (value !== undefined && value !== null) this.warn(path, `应为字符串，已按空字符串处理`);
    return fallback;
  }

  optStr(value: unknown, path: string): string | undefined {
    if (typeof value === 'string') return value.length > 0 ? value : undefined;
    if (value !== undefined && value !== null) this.warn(path, `应为字符串，已忽略`);
    return undefined;
  }

  bool(value: unknown, path: string, fallback: boolean): boolean {
    if (typeof value === 'boolean') return value;
    if (value !== undefined && value !== null) this.warn(path, `应为布尔值，已按 ${fallback} 处理`);
    return fallback;
  }

  strList(value: unknown, path: string): string[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) {
      this.warn(path, '应为字符串数组，已按空数组处理');
      return [];
    }
    const kept: string[] = [];
    value.forEach((item, index) => {
      if (typeof item === 'string') {
        kept.push(item);
        return;
      }
      this.warn(`${path}/${index}`, '应为字符串，已丢弃');
    });
    return kept;
  }

  list(value: unknown, path: string): unknown[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) {
      this.warn(path, '应为数组，已按空数组处理');
      return [];
    }
    return value;
  }
}

const normalizeProfile = (raw: unknown): Profile | null => {
  const record = asRecord(raw);
  if (!record) return null;
  return {
    network: typeof record.network === 'string' ? record.network : '',
    username: typeof record.username === 'string' ? record.username : '',
    url: typeof record.url === 'string' ? record.url : '',
  };
};

const normalizePosition = (raw: unknown, normalizer: Normalizer, path: string): Position => {
  const record = asRecord(raw) ?? {};
  return {
    id: normalizer.str(record.id, `${path}/id`),
    position: normalizer.str(record.position, `${path}/position`),
    startDate: normalizer.str(record.startDate, `${path}/startDate`),
    endDate: normalizer.str(record.endDate, `${path}/endDate`),
    highlights: normalizer.strList(record.highlights, `${path}/highlights`),
  };
};

const normalizeWorkEntry = (raw: unknown, normalizer: Normalizer, path: string): WorkEntry => {
  const record = asRecord(raw) ?? {};
  return {
    id: normalizer.str(record.id, `${path}/id`),
    organization: normalizer.str(record.organization, `${path}/organization`),
    location: normalizer.str(record.location, `${path}/location`),
    url: normalizer.optStr(record.url, `${path}/url`),
    positions: normalizer
      .list(record.positions, `${path}/positions`)
      .map((position, index) => normalizePosition(position, normalizer, `${path}/positions/${index}`)),
  };
};

const normalizeEducationEntry = (raw: unknown, normalizer: Normalizer, path: string): EducationEntry => {
  const record = asRecord(raw) ?? {};
  return {
    id: normalizer.str(record.id, `${path}/id`),
    institution: normalizer.str(record.institution, `${path}/institution`),
    location: normalizer.str(record.location, `${path}/location`),
    url: normalizer.optStr(record.url, `${path}/url`),
    studyType: normalizer.str(record.studyType, `${path}/studyType`),
    area: normalizer.optStr(record.area, `${path}/area`) ?? '',
    startDate: normalizer.str(record.startDate, `${path}/startDate`),
    endDate: normalizer.str(record.endDate, `${path}/endDate`),
    honorsLabel: normalizer.optStr(record.honorsLabel, `${path}/honorsLabel`) ?? '荣誉',
    honors: normalizer.strList(record.honors, `${path}/honors`),
    courses: normalizer.strList(record.courses, `${path}/courses`),
    highlights: normalizer.strList(record.highlights, `${path}/highlights`),
  };
};

const normalizeProjectEntry = (raw: unknown, normalizer: Normalizer, path: string): ProjectEntry => {
  const record = asRecord(raw) ?? {};
  return {
    id: normalizer.str(record.id, `${path}/id`),
    name: normalizer.str(record.name, `${path}/name`),
    affiliation: normalizer.optStr(record.affiliation, `${path}/affiliation`) ?? '',
    url: normalizer.optStr(record.url, `${path}/url`),
    startDate: normalizer.str(record.startDate, `${path}/startDate`),
    endDate: normalizer.str(record.endDate, `${path}/endDate`),
    highlights: normalizer.strList(record.highlights, `${path}/highlights`),
  };
};

const normalizeAwardEntry = (raw: unknown, normalizer: Normalizer, path: string): AwardEntry => {
  const record = asRecord(raw) ?? {};
  return {
    id: normalizer.str(record.id, `${path}/id`),
    title: normalizer.str(record.title, `${path}/title`),
    issuer: normalizer.str(record.issuer, `${path}/issuer`),
    location: normalizer.optStr(record.location, `${path}/location`),
    url: normalizer.optStr(record.url, `${path}/url`),
    date: normalizer.str(record.date, `${path}/date`),
    highlights: normalizer.strList(record.highlights, `${path}/highlights`),
  };
};

const normalizeCertificateEntry = (raw: unknown, normalizer: Normalizer, path: string): CertificateEntry => {
  const record = asRecord(raw) ?? {};
  return {
    id: normalizer.str(record.id, `${path}/id`),
    name: normalizer.str(record.name, `${path}/name`),
    issuer: normalizer.str(record.issuer, `${path}/issuer`),
    url: normalizer.optStr(record.url, `${path}/url`),
    date: normalizer.str(record.date, `${path}/date`),
    certId: normalizer.optStr(record.certId, `${path}/certId`),
  };
};

const normalizeAffiliationEntry = (raw: unknown, normalizer: Normalizer, path: string): AffiliationEntry => {
  const record = asRecord(raw) ?? {};
  return {
    id: normalizer.str(record.id, `${path}/id`),
    organization: normalizer.str(record.organization, `${path}/organization`),
    position: normalizer.str(record.position, `${path}/position`),
    location: normalizer.str(record.location, `${path}/location`),
    url: normalizer.optStr(record.url, `${path}/url`),
    startDate: normalizer.str(record.startDate, `${path}/startDate`),
    endDate: normalizer.str(record.endDate, `${path}/endDate`),
    highlights: normalizer.strList(record.highlights, `${path}/highlights`),
  };
};

const normalizeSkillGroup = (raw: unknown, normalizer: Normalizer, path: string): SkillGroup => {
  const record = asRecord(raw) ?? {};
  return {
    category: normalizer.str(record.category, `${path}/category`),
    skills: normalizer.strList(record.skills, `${path}/skills`),
  };
};

const normalizeLanguage = (raw: unknown, normalizer: Normalizer, path: string): Language => {
  const record = asRecord(raw) ?? {};
  return {
    language: normalizer.str(record.language, `${path}/language`),
    fluency: normalizer.str(record.fluency, `${path}/fluency`),
  };
};

const normalizeCustomItem = (raw: unknown, normalizer: Normalizer, path: string): CustomItem => {
  const record = asRecord(raw) ?? {};
  return { id: normalizer.str(record.id, `${path}/id`), text: normalizer.str(record.text, `${path}/text`) };
};

const normalizeSection = (raw: unknown, normalizer: Normalizer, path: string): ResumeSection => {
  const record = asRecord(raw) ?? {};

  const rawType = record.type;
  let type: SectionType = 'custom';
  if (typeof rawType === 'string' && (SECTION_TYPES as readonly string[]).includes(rawType)) {
    type = rawType as SectionType;
  } else if (rawType !== undefined) {
    normalizer.warn(`${path}/type`, `未知章节类型 "${String(rawType)}"，已按 custom 处理`);
  }

  const section: ResumeSection = {
    id: normalizer.str(record.id, `${path}/id`),
    type,
    title: normalizer.str(record.title, `${path}/title`),
    visible: normalizer.bool(record.visible, `${path}/visible`, true),
  };

  const workEntries = normalizer.list(record.workEntries, `${path}/workEntries`);
  if (workEntries.length > 0) {
    section.workEntries = workEntries.map((entry, index) =>
      normalizeWorkEntry(entry, normalizer, `${path}/workEntries/${index}`));
  }

  const educationEntries = normalizer.list(record.educationEntries, `${path}/educationEntries`);
  if (educationEntries.length > 0) {
    section.educationEntries = educationEntries.map((entry, index) =>
      normalizeEducationEntry(entry, normalizer, `${path}/educationEntries/${index}`));
  }

  const projectEntries = normalizer.list(record.projectEntries, `${path}/projectEntries`);
  if (projectEntries.length > 0) {
    section.projectEntries = projectEntries.map((entry, index) =>
      normalizeProjectEntry(entry, normalizer, `${path}/projectEntries/${index}`));
  }

  const awardEntries = normalizer.list(record.awardEntries, `${path}/awardEntries`);
  if (awardEntries.length > 0) {
    section.awardEntries = awardEntries.map((entry, index) =>
      normalizeAwardEntry(entry, normalizer, `${path}/awardEntries/${index}`));
  }

  const certificateEntries = normalizer.list(record.certificateEntries, `${path}/certificateEntries`);
  if (certificateEntries.length > 0) {
    section.certificateEntries = certificateEntries.map((entry, index) =>
      normalizeCertificateEntry(entry, normalizer, `${path}/certificateEntries/${index}`));
  }

  const affiliationEntries = normalizer.list(record.affiliationEntries, `${path}/affiliationEntries`);
  if (affiliationEntries.length > 0) {
    section.affiliationEntries = affiliationEntries.map((entry, index) =>
      normalizeAffiliationEntry(entry, normalizer, `${path}/affiliationEntries/${index}`));
  }

  const itemList = normalizer.list(record.items, `${path}/items`);
  if (itemList.length > 0) {
    section.items = itemList.map((item, index) => normalizeCustomItem(item, normalizer, `${path}/items/${index}`));
  }

  const skillGroups = normalizer.list(record.skillGroups, `${path}/skillGroups`);
  if (skillGroups.length > 0) {
    section.skillGroups = skillGroups.map((group, index) =>
      normalizeSkillGroup(group, normalizer, `${path}/skillGroups/${index}`));
  }

  const languages = normalizer.list(record.languages, `${path}/languages`);
  if (languages.length > 0) {
    section.languages = languages.map((language, index) =>
      normalizeLanguage(language, normalizer, `${path}/languages/${index}`));
  }

  const interests = normalizer.list(record.interests, `${path}/interests`);
  if (interests.length > 0) {
    section.interests = normalizer.strList(record.interests, `${path}/interests`);
  }

  return section;
};

const normalizePhoto = (raw: unknown, normalizer: Normalizer): PhotoData | undefined => {
  const record = asRecord(raw);
  if (!record) {
    if (raw !== undefined && raw !== null) normalizer.warn('/photo', '应为对象，已忽略');
    return undefined;
  }
  const src = normalizer.str(record.src, '/photo/src');
  if (!src) return undefined;
  const photo: PhotoData = { src };
  const cropMeta = normalizer.optStr(record.cropMeta, '/photo/cropMeta');
  if (cropMeta) photo.cropMeta = cropMeta;
  if (typeof record.visible === 'boolean') photo.visible = record.visible;
  return photo;
};

export interface NormalizeResult {
  resume: ResumeState;
  warnings: string[];
}

/**
 * Coerce an arbitrary JSON value into a complete, render-safe `ResumeState`.
 * Throws `ResumeSchemaError` only when the input cannot be a resume at all.
 */
export const normalizeResume = (raw: unknown): NormalizeResult => {
  if (!isRecord(raw)) {
    throw new ResumeSchemaError('简历 JSON 必须是一个对象（顶层为 { personal, sections, ... }）');
  }

  const normalizer = new Normalizer();

  const personalRecord = asRecord(raw.personal) ?? {};
  if (raw.personal !== undefined && !isRecord(raw.personal)) {
    normalizer.warn('/personal', '应为对象，已按空个人信息处理');
  }

  const locationRecord = asRecord(personalRecord.location) ?? {};
  const location: ResumeState['personal']['location'] = {};
  const city = normalizer.optStr(locationRecord.city, '/personal/location/city');
  const region = normalizer.optStr(locationRecord.region, '/personal/location/region');
  const country = normalizer.optStr(locationRecord.country, '/personal/location/country');
  if (city) location.city = city;
  if (region) location.region = region;
  if (country) location.country = country;

  const profiles = normalizer
    .list(personalRecord.profiles, '/personal/profiles')
    .map((profile) => normalizeProfile(profile))
    .filter((profile): profile is Profile => profile !== null);

  const personal: ResumeState['personal'] = {
    name: normalizer.str(personalRecord.name, '/personal/name'),
    email: normalizer.optStr(personalRecord.email, '/personal/email'),
    phone: normalizer.optStr(personalRecord.phone, '/personal/phone'),
    url: normalizer.optStr(personalRecord.url, '/personal/url'),
    titles: normalizer.strList(personalRecord.titles, '/personal/titles'),
    location,
    profiles,
    summary: normalizer.optStr(personalRecord.summary, '/personal/summary'),
  };

  const rawSections = raw.sections;
  if (rawSections !== undefined && !Array.isArray(rawSections)) {
    throw new ResumeSchemaError('/sections 必须是数组');
  }
  const sections = (rawSections ?? []).map((section, index) =>
    normalizeSection(section, normalizer, `/sections/${index}`));

  const normalizedFontSize = normalizeResumeFontSize(raw.fontSizePt);
  if (raw.fontSizePt !== undefined) {
    const numeric = Number(raw.fontSizePt);
    if (!Number.isFinite(numeric) || numeric < MIN_RESUME_FONT_SIZE_PT || numeric > MAX_RESUME_FONT_SIZE_PT) {
      normalizer.warn(
        '/fontSizePt',
        `超出 ${MIN_RESUME_FONT_SIZE_PT}-${MAX_RESUME_FONT_SIZE_PT}pt，已收敛为 ${normalizedFontSize}pt`,
      );
    }
  } else {
    normalizer.warn('/fontSizePt', '缺失，已按默认字号处理');
  }

  const normalizedFontFamily = normalizeResumeFontFamily(raw.fontFamily);
  if (raw.fontFamily !== undefined && raw.fontFamily !== normalizedFontFamily) {
    normalizer.warn('/fontFamily', '不支持的字体，已按思源宋体处理');
  }

  const normalizedHeaderAlignment = normalizeResumeHeaderAlignment(raw.headerAlignment);
  if (raw.headerAlignment !== undefined && raw.headerAlignment !== normalizedHeaderAlignment) {
    normalizer.warn('/headerAlignment', '不支持的页头对齐方式，已按左对齐处理');
  }

  // 三档可选层级字号：缺省表示跟随正文。只校验用户真的写了的值。
  const levelFontSize = (key: 'namePt' | 'sectionPt' | 'entryPt'): number | undefined => {
    const value = raw[key];
    if (value === undefined || value === null) return undefined;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      normalizer.warn(`/${key}`, '不是数字，已改为跟随正文');
      return undefined;
    }
    if (numeric < MIN_LEVEL_FONT_SIZE_PT || numeric > MAX_LEVEL_FONT_SIZE_PT) {
      normalizer.warn(
        `/${key}`,
        `超出 ${MIN_LEVEL_FONT_SIZE_PT}-${MAX_LEVEL_FONT_SIZE_PT}pt，已收敛为 ${numeric > MAX_LEVEL_FONT_SIZE_PT ? MAX_LEVEL_FONT_SIZE_PT : MIN_LEVEL_FONT_SIZE_PT}pt`,
      );
    }
    return normalizeLevelFontSize(value);
  };
  const namePt = levelFontSize('namePt');
  const sectionPt = levelFontSize('sectionPt');
  const entryPt = levelFontSize('entryPt');

  // 紧凑度：缺省 = 默认间距。只校验真的写了的值。
  let spacing: number | undefined;
  if (raw.spacing !== undefined && raw.spacing !== null) {
    const numeric = Number(raw.spacing);
    if (!Number.isFinite(numeric)) {
      normalizer.warn('/spacing', '不是数字，已改为默认间距');
    } else if (numeric < MIN_RESUME_SPACING || numeric > MAX_RESUME_SPACING) {
      normalizer.warn(
        '/spacing',
        `超出 ${MIN_RESUME_SPACING}-${MAX_RESUME_SPACING}，已收敛为 ${Math.min(MAX_RESUME_SPACING, Math.max(MIN_RESUME_SPACING, numeric))}`,
      );
    }
    spacing = normalizeResumeSpacing(raw.spacing);
  }

  const visibility = {
    showPhoto: normalizer.bool(raw.showPhoto, '/showPhoto', false),
    showName: normalizer.bool(raw.showName, '/showName', true),
    showEmail: normalizer.bool(raw.showEmail, '/showEmail', true),
    showPhone: normalizer.bool(raw.showPhone, '/showPhone', true),
    showUrl: normalizer.bool(raw.showUrl, '/showUrl', true),
    showProfiles: normalizer.bool(raw.showProfiles, '/showProfiles', true),
    showAddress: normalizer.bool(raw.showAddress, '/showAddress', true),
    showTitle: normalizer.bool(raw.showTitle, '/showTitle', true),
    showSummary: normalizer.bool(raw.showSummary, '/showSummary', true),
  };

  const resume: ResumeState = {
    personal,
    sections,
    photo: normalizePhoto(raw.photo, normalizer),
    updatedAt: normalizer.str(raw.updatedAt, '/updatedAt', new Date().toISOString()),
    fontSizePt: normalizedFontSize,
    namePt,
    sectionPt,
    entryPt,
    spacing,
    fontFamily: normalizedFontFamily,
    headerAlignment: normalizedHeaderAlignment,
    ...visibility,
  };

  return { resume, warnings: normalizer.warnings };
};

export interface Diagnostic {
  level: 'error' | 'warning';
  code: string;
  path: string;
  message: string;
}

/** A bullet longer than this is hard to skim and usually a wrapped paragraph in disguise. */
export const MAX_HIGHLIGHT_LENGTH = 160;

const DATE_PATTERN = /^(\d{4}(-\d{2}(-\d{2})?)?|present)$/u;

const hasText = (value: string | undefined): boolean => Boolean(value && value.trim());

/**
 * Would this section show anything?
 *
 * Asked of the renderer rather than re-derived here: the two used to disagree
 * (a section holding one empty certificate has no visible content, but a count
 * of entries says otherwise), and a validator that lies about what prints is
 * worse than no validator.
 */
const sectionRendersNothing = (section: ResumeSection): boolean => {
  const withoutHeading = renderResumeSection(section).replace(/<h2>[\s\S]*?<\/h2>/u, '');
  return withoutHeading.replace(/<[^>]*>/gu, '').trim().length === 0;
};

/** Content-level checks. Errors are limited to problems that break addressing. */
export const validateResume = (resume: ResumeState): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];
  const warn = (code: string, path: string, message: string) =>
    diagnostics.push({ level: 'warning', code, path, message });
  const fail = (code: string, path: string, message: string) =>
    diagnostics.push({ level: 'error', code, path, message });

  const seen = new Map<string, string>();
  for (const { id, path } of collectIds(resume)) {
    if (!id) {
      fail('missing-id', path, '缺少 id；用 resume ids 补全后再用路径/id 寻址');
      continue;
    }
    const first = seen.get(id);
    if (first) fail('duplicate-id', path, `id "${id}" 与 ${first} 重复，会让 patch 指向错误的条目`);
    else seen.set(id, path);
  }

  const writeDate = (value: string, path: string, label: string) => {
    if (!value) return;
    if (!DATE_PATTERN.test(value)) {
      warn('bad-date', path, `${label} "${value}" 不是 YYYY-MM / YYYY-MM-DD / present`);
    }
  };

  const checkHighlights = (highlights: string[] | undefined, path: string) => {
    highlights?.forEach((highlight, index) => {
      if (!highlight.trim()) {
        warn('empty-highlight', `${path}/${index}`, '空条目不会出现在预览和导出里，建议删除占位空串');
        return;
      }
      if (highlight.length > MAX_HIGHLIGHT_LENGTH) {
        warn(
          'long-highlight',
          `${path}/${index}`,
          `长度 ${highlight.length} 超过 ${MAX_HIGHLIGHT_LENGTH}，一行放不下会折成两三行`,
        );
      }
    });
  };

  if (!hasText(resume.personal.name)) warn('missing-name', '/personal/name', '简历没有姓名');
  if (resume.sections.length === 0) warn('empty-resume', '/sections', '简历还没有任何章节');

  const visibleSections = resume.sections.filter((section) => section.visible);
  if (resume.sections.length > 0 && visibleSections.length === 0) {
    warn('all-sections-hidden', '/sections', '所有章节都是隐藏状态，预览里会是空白');
  }

  const toggles: Array<[keyof ResumeState, string, boolean]> = [
    ['showPhoto', '/showPhoto', Boolean(resume.showPhoto && resume.photo?.src)],
    ['showName', '/showName', hasText(resume.personal.name)],
    ['showEmail', '/showEmail', hasText(resume.personal.email)],
    ['showPhone', '/showPhone', hasText(resume.personal.phone)],
    ['showUrl', '/showUrl', hasText(resume.personal.url)],
    ['showProfiles', '/showProfiles', (resume.personal.profiles?.length ?? 0) > 0],
    ['showAddress', '/showAddress', hasText(resume.personal.location?.city) || hasText(resume.personal.location?.region)],
    ['showTitle', '/showTitle', (resume.personal.titles?.length ?? 0) > 0],
    ['showSummary', '/showSummary', hasText(resume.personal.summary)],
  ];
  for (const [key, path, hasContent] of toggles) {
    if (resume[key] === true && !hasContent) {
      warn('toggle-without-content', path, '开关是打开的，但没有对应内容，预览里不会显示任何东西');
    }
  }

  resume.sections.forEach((section, sectionIndex) => {
    const base = `/sections/${sectionIndex}`;
    if (!section.visible) return;

    if (!hasText(section.title)) warn('empty-section-title', `${base}/title`, '章节没有标题');

    section.workEntries?.forEach((entry, entryIndex) => {
      const entryPath = `${base}/workEntries/${entryIndex}`;
      if (!hasText(entry.organization)) warn('empty-field', `${entryPath}/organization`, '工作经历缺少公司名');
      if (entry.positions.length === 0) warn('empty-field', `${entryPath}/positions`, '该公司下没有任何职位');
      entry.positions.forEach((position, positionIndex) => {
        const positionPath = `${entryPath}/positions/${positionIndex}`;
        if (!hasText(position.position)) warn('empty-field', `${positionPath}/position`, '职位名为空');
        writeDate(position.startDate, `${positionPath}/startDate`, '开始时间');
        writeDate(position.endDate, `${positionPath}/endDate`, '结束时间');
        checkHighlights(position.highlights, `${positionPath}/highlights`);
      });
    });

    section.educationEntries?.forEach((entry, entryIndex) => {
      const entryPath = `${base}/educationEntries/${entryIndex}`;
      if (!hasText(entry.institution)) warn('empty-field', `${entryPath}/institution`, '教育经历缺少学校名');
      writeDate(entry.startDate, `${entryPath}/startDate`, '开始时间');
      writeDate(entry.endDate, `${entryPath}/endDate`, '结束时间');
      checkHighlights(entry.highlights, `${entryPath}/highlights`);
    });

    section.projectEntries?.forEach((entry, entryIndex) => {
      const entryPath = `${base}/projectEntries/${entryIndex}`;
      if (!hasText(entry.name)) warn('empty-field', `${entryPath}/name`, '项目经历缺少项目名');
      writeDate(entry.startDate, `${entryPath}/startDate`, '开始时间');
      writeDate(entry.endDate, `${entryPath}/endDate`, '结束时间');
      checkHighlights(entry.highlights, `${entryPath}/highlights`);
    });

    section.awardEntries?.forEach((entry, entryIndex) => {
      const entryPath = `${base}/awardEntries/${entryIndex}`;
      if (!hasText(entry.title)) warn('empty-field', `${entryPath}/title`, '奖项名称为空');
      if (!hasText(entry.issuer)) warn('empty-field', `${entryPath}/issuer`, '奖项缺少颁发方');
      writeDate(entry.date, `${entryPath}/date`, '获奖时间');
      checkHighlights(entry.highlights, `${entryPath}/highlights`);
    });

    section.certificateEntries?.forEach((entry, entryIndex) => {
      const entryPath = `${base}/certificateEntries/${entryIndex}`;
      if (!hasText(entry.name)) warn('empty-field', `${entryPath}/name`, '证书名称为空');
      if (!hasText(entry.issuer)) warn('empty-field', `${entryPath}/issuer`, '证书缺少颁发机构');
      writeDate(entry.date, `${entryPath}/date`, '获得时间');
    });

    section.affiliationEntries?.forEach((entry, entryIndex) => {
      const entryPath = `${base}/affiliationEntries/${entryIndex}`;
      if (!hasText(entry.organization)) warn('empty-field', `${entryPath}/organization`, '社团/组织名称为空');
      writeDate(entry.startDate, `${entryPath}/startDate`, '开始时间');
      writeDate(entry.endDate, `${entryPath}/endDate`, '结束时间');
      checkHighlights(entry.highlights, `${entryPath}/highlights`);
    });

    const skillGroups = section.skillGroups ?? [];
    if (skillGroups.length > 0) {
      skillGroups.forEach((group, groupIndex) => {
        if (!hasText(group.category)) warn('empty-field', `${base}/skillGroups/${groupIndex}/category`, '技能分类为空');
        if (group.skills.filter((skill) => skill.trim()).length === 0) {
          warn('empty-field', `${base}/skillGroups/${groupIndex}/skills`, `技能分类 "${group.category}" 下没有技能`);
        }
      });
    }

    if (sectionRendersNothing(section)) {
      warn('empty-section', base, `章节「${section.title || section.type}」渲染出来是空的`);
    }
  });

  return diagnostics;
};

/** Convenience for callers that just need a yes/no. */
export const hasErrors = (diagnostics: Diagnostic[]): boolean =>
  diagnostics.some((diagnostic) => diagnostic.level === 'error');
