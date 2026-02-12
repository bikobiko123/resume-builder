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
  ...createDefaultVisibility(),
});
