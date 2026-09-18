// imprecv-style resume types

export type SectionType = 'work' | 'education' | 'project' | 'skills' | 'certs' | 'awards' | 'affiliations' | 'custom';

// Personal information
export interface PersonalInfo {
  name: string;
  email?: string;
  phone?: string;
  url?: string;
  titles?: string[];
  location?: {
    city?: string;
    region?: string;
    country?: string;
  };
  profiles?: Profile[];
  summary?: string;
}

export interface Profile {
  network: string;
  username: string;
  url: string;
}

// Work experience entry (imprecv style)
export interface WorkEntry {
  id: string;
  organization: string;
  location: string;
  url?: string;
  positions: Position[];
}

export interface Position {
  id: string;
  position: string;
  startDate: string; // ISO format: YYYY-MM-DD or "present"
  endDate: string;
  highlights: string[];
}

// Education entry (imprecv style)
export interface EducationEntry {
  id: string;
  institution: string;
  location: string;
  url?: string;
  studyType: string;
  area?: string;
  startDate: string;
  endDate: string;
  honorsLabel?: string;
  honors?: string[];
  courses?: string[];
  highlights?: string[];
}

// Project entry
export interface ProjectEntry {
  id: string;
  name: string;
  affiliation?: string;
  url?: string;
  startDate: string;
  endDate: string;
  highlights: string[];
}

// Award entry
export interface AwardEntry {
  id: string;
  title: string;
  issuer: string;
  location?: string;
  url?: string;
  date: string;
  highlights?: string[];
}

// Certificate entry
export interface CertificateEntry {
  id: string;
  name: string;
  issuer: string;
  url?: string;
  date: string;
  certId?: string;
}

// Affiliation/Leadership entry
export interface AffiliationEntry {
  id: string;
  organization: string;
  position: string;
  location: string;
  url?: string;
  startDate: string;
  endDate: string;
  highlights?: string[];
}

// Skills
export interface SkillGroup {
  category: string;
  skills: string[];
}

export interface Language {
  language: string;
  fluency: string;
}

export interface CustomItem {
  id: string;
  text: string;
}

// Section wrapper
export interface ResumeSection {
  id: string;
  type: SectionType;
  title: string;
  visible: boolean;
  // Content based on type
  workEntries?: WorkEntry[];
  educationEntries?: EducationEntry[];
  projectEntries?: ProjectEntry[];
  awardEntries?: AwardEntry[];
  certificateEntries?: CertificateEntry[];
  affiliationEntries?: AffiliationEntry[];
  skillGroups?: SkillGroup[];
  languages?: Language[];
  interests?: string[];
  // Legacy support
  items?: CustomItem[];
}

// Photo
export interface PhotoData {
  src: string;
  cropMeta?: string;
  visible?: boolean;
}

// Complete resume state
export interface ResumeState {
  personal: PersonalInfo;
  sections: ResumeSection[];
  photo?: PhotoData;
  updatedAt: string;
  /** 正文字号，也是另外三档「跟随正文」时的基准。 */
  fontSizePt: number;
  /**
   * 姓名、章节标题、条目标题的字号（绝对 pt）。
   *
   * 缺省（`undefined`）表示**跟随正文**，按 `a4.css` 里原有的 em 比例缩放；
   * 一旦显式设置就固定成这个 pt，正文再变它也不动。存量简历三个字段都是缺省的，
   * 所以它们的排版和以前逐像素一致 —— 这也是这三个字段必须可选、不能填默认值的
   * 原因。
   */
  namePt?: number;
  sectionPt?: number;
  entryPt?: number;
  /**
   * 留白紧凑度：行距与各处间距的缩放系数，1.0 = `a4.css` 原本的值。
   *
   * 缺省（`undefined`）就是 1.0，走 CSS 的兜底值，存量简历排版不变。
   * 字号和间距是两条正交的杠杆 —— 字号决定字多大，这个决定字挨得多近；
   * 想把正文调大一点又不想超出一页时，收这个比缩字号有效得多。
   */
  spacing?: number;
  fontFamily: ResumeFontFamily;
  headerAlignment: ResumeHeaderAlignment;
  // User preferences - visibility toggles for personal info sections
  showPhoto: boolean;
  showName: boolean;
  showEmail: boolean;
  showPhone: boolean;
  showUrl: boolean;
  showProfiles: boolean;
  showAddress: boolean;
  showTitle: boolean;
  showSummary: boolean;
}

export const MIN_RESUME_FONT_SIZE_PT = 8.5;
export const MAX_RESUME_FONT_SIZE_PT = 13;
export const DEFAULT_RESUME_FONT_SIZE_PT = 9.5;

export type ResumeFontFamily = 'source-han-serif' | 'anthropic-serif' | 'anthropic-sans';
export const DEFAULT_RESUME_FONT_FAMILY: ResumeFontFamily = 'source-han-serif';
export type ResumeHeaderAlignment = 'left' | 'center';
export const DEFAULT_RESUME_HEADER_ALIGNMENT: ResumeHeaderAlignment = 'left';

export const normalizeResumeFontFamily = (value: unknown): ResumeFontFamily => {
  if (value === 'anthropic-serif' || value === 'anthropic-sans' || value === 'source-han-serif') {
    return value;
  }
  return DEFAULT_RESUME_FONT_FAMILY;
};

export const normalizeResumeHeaderAlignment = (value: unknown): ResumeHeaderAlignment =>
  value === 'center' ? 'center' : DEFAULT_RESUME_HEADER_ALIGNMENT;

export const normalizeResumeFontSize = (value: unknown): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_RESUME_FONT_SIZE_PT;
  const clamped = Math.min(MAX_RESUME_FONT_SIZE_PT, Math.max(MIN_RESUME_FONT_SIZE_PT, numeric));
  return Number(clamped.toFixed(1));
};

/**
 * 三档可选层级的字号边界。比正文宽：姓名字号本来就可能是正文的两倍多。
 */
export const MIN_LEVEL_FONT_SIZE_PT = 6;
export const MAX_LEVEL_FONT_SIZE_PT = 36;

export type ResumeLevelKey = 'name' | 'section' | 'entry';

/**
 * 每个层级「跟随正文」时的 em 倍率。
 *
 * **必须和 `src/styles/a4.css` 里对应选择器的 `var()` 兜底值一致** —— CSS 读不到
 * 这个常量，只能靠 `a4Css.test.ts` 把两边钉在一起。这里的值同时用于 UI 上显示的
 * 换算结果和 docx 导出。
 */
export const RESUME_LEVEL_RATIOS: Record<ResumeLevelKey, number> = {
  name: 2.21,
  section: 1.26,
  entry: 1.1,
};

/**
 * 归一化一个可选的层级字号。
 *
 * 返回 `undefined` 表示「跟随正文」：字段缺失、`null`、或者根本不是数字时都归到
 * 这一档。范围外的数字按边界收敛而不是丢弃 —— 用户明确设过值，就别悄悄丢掉。
 */
export const normalizeLevelFontSize = (value: unknown): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  const clamped = Math.min(MAX_LEVEL_FONT_SIZE_PT, Math.max(MIN_LEVEL_FONT_SIZE_PT, numeric));
  return Number(clamped.toFixed(1));
};

/** 四档字号换算后的实际 pt。`resolved` 标出哪些是跟随正文算出来的。 */
export interface ResumeTypeScale {
  bodyPt: number;
  namePt: number;
  sectionPt: number;
  entryPt: number;
  /** 哪些层级当前是「跟随正文」。 */
  following: Record<ResumeLevelKey, boolean>;
}

/** 把 `ResumeState` 解析成四档实际字号，缺省的层级用 em 倍率从正文换算。 */
export const resolveResumeTypeScale = (resume: ResumeState): ResumeTypeScale => {
  const manual: Record<ResumeLevelKey, number | undefined> = {
    name: resume.namePt,
    section: resume.sectionPt,
    entry: resume.entryPt,
  };
  const effective = (key: ResumeLevelKey): number => {
    const explicit = manual[key];
    if (explicit !== undefined) return explicit;
    return Number((resume.fontSizePt * RESUME_LEVEL_RATIOS[key]).toFixed(1));
  };
  return {
    bodyPt: resume.fontSizePt,
    namePt: effective('name'),
    sectionPt: effective('section'),
    entryPt: effective('entry'),
    following: {
      name: manual.name === undefined,
      section: manual.section === undefined,
      entry: manual.entry === undefined,
    },
  };
};

// ---------- 留白紧凑度 ----------

export const MIN_RESUME_SPACING = 0.75;
export const MAX_RESUME_SPACING = 1;
export const DEFAULT_RESUME_SPACING = 1;

/**
 * 归一化紧凑度。
 *
 * 返回 `undefined` 表示「默认间距」：字段缺失、`null`、不是数字、或者**恰好等于
 * 1.0** 时都归到这一档 —— 填一个显式的 1.0 和缺省必须完全等价，否则「拖到 100%
 * 再拖回来」会留下一串和默认值差之毫厘的间距，排版看着一样却再也回不到原样。
 */
export const normalizeResumeSpacing = (value: unknown): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  const clamped = Math.min(MAX_RESUME_SPACING, Math.max(MIN_RESUME_SPACING, numeric));
  const rounded = Number(clamped.toFixed(2));
  return rounded >= MAX_RESUME_SPACING ? undefined : rounded;
};

/** 间距各项的实际取值。系数为 1 时就是 `a4.css` 里写死的那些数。 */
export interface ResumeSpacing {
  /** 滑块上的那个值本身，0.75–1.0。UI 要拿它回填。 */
  factor: number;
  /** `line-height` 倍数。基准 1.4，随系数线性收到 1.3 为止。 */
  lineHeight: number;
  /** `.a4-content` 上下内边距，mm。左右不受影响 —— 收窄它只改换行点，不省垂直空间。 */
  pagePaddingMm: number;
  /** `.entry` 之间，mm。 */
  blockGapMm: number;
  /** 同一条目内 bullet 之间，mm。 */
  itemGapMm: number;
  /** 章节之间，mm。 */
  sectionGapMm: number;
  /** 系数本身就是 1（默认间距）。 */
  isDefault: boolean;
}

/** `a4.css` 里写死的基准值。改 CSS 必须同步改这里，`a4Css.test.ts` 会盯着。 */
export const BASE_SPACING = {
  lineHeight: 1.4,
  pagePaddingMm: 12,
  blockGapMm: 2.2,
  itemGapMm: 0.8,
  sectionGapMm: 3,
} as const;

/**
 * 行距用 `1 + 0.4 × spacing` 收缩，而不是直接乘系数。
 *
 * 行距有物理下限：中文宋体排到 1.3 以下，行与行就开始互相干扰。基准是 1.4，
 * 而 1.4 走到 1.3 正好是系数从 1.0 走到 0.75 —— 滑块拉到底也不会把行距压坏。
 * 其余几项是纯粹的留白，线性缩放即可。
 */
export const resolveResumeSpacing = (resume: ResumeState): ResumeSpacing => {
  const factor = resume.spacing ?? DEFAULT_RESUME_SPACING;
  const mm = (base: number): number => Number((base * factor).toFixed(2));
  return {
    factor,
    lineHeight: Number((1 + (BASE_SPACING.lineHeight - 1) * factor).toFixed(3)),
    pagePaddingMm: mm(BASE_SPACING.pagePaddingMm),
    blockGapMm: mm(BASE_SPACING.blockGapMm),
    itemGapMm: mm(BASE_SPACING.itemGapMm),
    sectionGapMm: mm(BASE_SPACING.sectionGapMm),
    isDefault: resume.spacing === undefined,
  };
};

// Utility functions
const uid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const createCustomItem = (overrides: Partial<CustomItem> = {}): CustomItem => ({
  id: uid(),
  text: overrides.text ?? '',
});

// Create empty structures
export const createPosition = (overrides: Partial<Position> = {}): Position => ({
  id: uid(),
  position: overrides.position ?? '',
  startDate: overrides.startDate ?? '',
  endDate: overrides.endDate ?? '',
  highlights: overrides.highlights ?? [''],
});

export const createWorkEntry = (overrides: Partial<WorkEntry> = {}): WorkEntry => ({
  id: uid(),
  organization: overrides.organization ?? '',
  location: overrides.location ?? '',
  url: overrides.url ?? '',
  positions: overrides.positions ?? [createPosition()],
});

export const createEducationEntry = (overrides: Partial<EducationEntry> = {}): EducationEntry => ({
  id: uid(),
  institution: overrides.institution ?? '',
  location: overrides.location ?? '',
  url: overrides.url ?? '',
  studyType: overrides.studyType ?? '',
  area: overrides.area ?? '',
  startDate: overrides.startDate ?? '',
  endDate: overrides.endDate ?? '',
  honorsLabel: overrides.honorsLabel ?? '荣誉',
  honors: overrides.honors ?? [],
  courses: overrides.courses ?? [],
  highlights: overrides.highlights ?? [],
});

export const createProjectEntry = (overrides: Partial<ProjectEntry> = {}): ProjectEntry => ({
  id: uid(),
  name: overrides.name ?? '',
  affiliation: overrides.affiliation ?? '',
  url: overrides.url ?? '',
  startDate: overrides.startDate ?? '',
  endDate: overrides.endDate ?? '',
  highlights: overrides.highlights ?? [''],
});

export const createAwardEntry = (overrides: Partial<AwardEntry> = {}): AwardEntry => ({
  id: uid(),
  title: overrides.title ?? '',
  issuer: overrides.issuer ?? '',
  location: overrides.location ?? '',
  url: overrides.url ?? '',
  date: overrides.date ?? '',
  highlights: overrides.highlights ?? [],
});

export const createCertificateEntry = (overrides: Partial<CertificateEntry> = {}): CertificateEntry => ({
  id: uid(),
  name: overrides.name ?? '',
  issuer: overrides.issuer ?? '',
  url: overrides.url ?? '',
  date: overrides.date ?? '',
});

export const createAffiliationEntry = (overrides: Partial<AffiliationEntry> = {}): AffiliationEntry => ({
  id: uid(),
  organization: overrides.organization ?? '',
  position: overrides.position ?? '',
  location: overrides.location ?? '',
  url: overrides.url ?? '',
  startDate: overrides.startDate ?? '',
  endDate: overrides.endDate ?? '',
  highlights: overrides.highlights ?? [],
});

export const createResumeSection = (
  type: SectionType = 'custom',
  title = '自定义模块',
): ResumeSection => {
  const base = {
    id: uid(),
    type,
    title,
    visible: true,
  };

  switch (type) {
    case 'work':
      return { ...base, workEntries: [createWorkEntry()] };
    case 'education':
      return { ...base, educationEntries: [createEducationEntry()] };
    case 'project':
      return { ...base, projectEntries: [createProjectEntry()] };
    case 'awards':
      return { ...base, awardEntries: [createAwardEntry()] };
    case 'certs':
      return { ...base, certificateEntries: [createCertificateEntry()] };
    case 'affiliations':
      return { ...base, affiliationEntries: [createAffiliationEntry()] };
    case 'skills':
      return { ...base, skillGroups: [], languages: [], interests: [] };
    default:
      return { ...base, items: [createCustomItem()] };
  }
};

// Visibility settings interface
export interface PersonalInfoVisibility {
  showPhoto: boolean;
  showName: boolean;
  showEmail: boolean;
  showPhone: boolean;
  showUrl: boolean;
  showProfiles: boolean;
  showAddress: boolean;
  showTitle: boolean;
  showSummary: boolean;
}

// Default visibility settings
const createDefaultVisibility = (): PersonalInfoVisibility => ({
  showPhoto: false,
  showName: true,
  showEmail: true,
  showPhone: true,
  showUrl: true,
  showProfiles: true,
  showAddress: true,
  showTitle: true,
  showSummary: true,
});

// Default resume state (imprecv style, Chinese)
export const createDefaultResumeState = (): ResumeState => ({
  personal: {
    name: '张三',
    email: 'zhangsan@email.com',
    phone: '138-0000-0000',
    url: 'https://zhangsan.dev',
    titles: ['产品经理', '数据分析师'],
    location: {
      city: '上海',
      region: '浦东新区',
    },
    profiles: [
      { network: 'LinkedIn', username: 'zhangsan', url: 'https://linkedin.com/in/zhangsan' },
      { network: 'GitHub', username: 'zhangsan', url: 'https://github.com/zhangsan' },
    ],
    summary: '5年互联网产品经验，擅长从用户洞察到落地上线的全流程推进。具备跨团队协同与数据驱动迭代能力。',
  },
  sections: [
    {
      id: uid(),
      type: 'work',
      title: '工作经历',
      visible: true,
      workEntries: [
        {
          id: uid(),
          organization: 'XX科技有限公司',
          location: '上海',
          url: 'https://example.com',
          positions: [
            {
              id: uid(),
              position: '高级产品经理',
              startDate: '2022-03',
              endDate: 'present',
              highlights: [
                '负责核心功能规划、需求管理与项目推进，推动关键模块月活提升 28%',
                '主导跨部门协作流程优化，将产品迭代周期从 6 周缩短至 4 周',
                '建立数据看板体系，实现核心业务指标的实时监控与分析',
              ],
            },
          ],
        },
        {
          id: uid(),
          organization: 'YY互联网公司',
          location: '北京',
          positions: [
            {
              id: uid(),
              position: '产品经理',
              startDate: '2019-06',
              endDate: '2022-02',
              highlights: [
                '负责电商增长产品线，主导新用户获取策略，实现获客成本降低 15%',
                '设计并推动会员体系改版，会员留存率提升 12%',
              ],
            },
          ],
        },
      ],
    },
    {
      id: uid(),
      type: 'education',
      title: '教育背景',
      visible: true,
      educationEntries: [
        {
          id: uid(),
          institution: 'XX大学',
          location: '北京',
          studyType: '本科',
          area: '信息管理与信息系统',
          startDate: '2015-09',
          endDate: '2019-06',
          honorsLabel: '荣誉',
          honors: ['优秀毕业生', '国家奖学金'],
          highlights: ['学生会主席', 'ACM 程序设计竞赛省赛银奖'],
        },
      ],
    },
    {
      id: uid(),
      type: 'project',
      title: '项目经历',
      visible: true,
      projectEntries: [
        {
          id: uid(),
          name: '智能推荐系统改版',
          affiliation: 'XX科技有限公司',
          startDate: '2023-01',
          endDate: '2023-06',
          highlights: [
            '主导推荐算法策略重构与 AB 实验，核心转化率提升 15%',
            '沉淀指标看板体系，实现业务数据的可视化监控',
          ],
        },
      ],
    },
    {
      id: uid(),
      type: 'skills',
      title: '技能',
      visible: true,
      skillGroups: [
        { category: '产品工具', skills: ['Axure', 'Figma', 'Sketch', 'Xmind'] },
        { category: '数据分析', skills: ['SQL', 'Python', 'Excel', 'Tableau'] },
        { category: '项目管理', skills: ['Jira', 'Confluence', '飞书', '敏捷开发'] },
      ],
      languages: [
        { language: '中文', fluency: '母语' },
        { language: '英语', fluency: '流利' },
      ],
    },
    {
      id: uid(),
      type: 'certs',
      title: '证书',
      visible: true,
      certificateEntries: [
        {
          id: uid(),
          name: 'PMP 项目管理专业人士',
          issuer: 'PMI',
          date: '2023-06',
        },
      ],
    },
  ],
  photo: undefined,
  updatedAt: new Date().toISOString(),
  fontSizePt: DEFAULT_RESUME_FONT_SIZE_PT,
  fontFamily: DEFAULT_RESUME_FONT_FAMILY,
  headerAlignment: DEFAULT_RESUME_HEADER_ALIGNMENT,
  ...createDefaultVisibility(),
});

// 新建人物时使用的空白简历：沿用模板的显示偏好，但不带任何示例内容。
export const createBlankResumeState = (name = ''): ResumeState => ({
  ...createDefaultResumeState(),
  personal: {
    name,
    email: '',
    phone: '',
    url: '',
    titles: [],
    location: {},
    profiles: [],
    summary: '',
  },
  sections: [],
  photo: undefined,
  updatedAt: new Date().toISOString(),
});
