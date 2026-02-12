import yaml from 'js-yaml';
import type {
  ResumeState,
  ResumeSection,
  WorkEntry,
  EducationEntry,
  ProjectEntry,
  AwardEntry,
  CertificateEntry,
  SkillGroup,
  Language,
} from '../types/resume';
import { createResumeSection } from '../types/resume';

// Export resume to Markdown format
export const exportToMarkdown = (resume: ResumeState): string => {
  const { personal } = resume;

  // Build YAML frontmatter
  const frontmatter = {
    type: 'resume',
    name: personal.name,
    email: personal.email,
    phone: personal.phone,
    url: personal.url,
    titles: personal.titles,
    location: personal.location,
    summary: personal.summary,
    showPhoto: resume.showPhoto,
    showAddress: resume.showAddress,
    showPhone: resume.showPhone,
    showTitle: resume.showTitle,
    updatedAt: resume.updatedAt,
  };

  let markdown = '---\n';
  markdown += yaml.dump(frontmatter, { lineWidth: -1, noRefs: true });
  markdown += '---\n\n';

  // Header
  markdown += `# ${personal.name}\n\n`;

  if (personal.summary) {
    markdown += `> ${personal.summary}\n\n`;
  }

  // Sections
  for (const section of resume.sections) {
    if (!section.visible) continue;

    markdown += `## ${section.title}\n\n`;

    switch (section.type) {
      case 'work':
        markdown += exportWorkSection(section.workEntries);
        break;
      case 'education':
        markdown += exportEducationSection(section.educationEntries);
        break;
      case 'project':
        markdown += exportProjectSection(section.projectEntries);
        break;
      case 'skills':
        markdown += exportSkillsSection(section.skillGroups, section.languages);
        break;
      case 'awards':
        markdown += exportAwardsSection(section.awardEntries);
        break;
      case 'certs':
        markdown += exportCertificatesSection(section.certificateEntries);
        break;
      case 'custom':
        markdown += exportCustomSection(section.items);
        break;
    }
  }

  return markdown.trim();
};

// Export work experience section
const exportWorkSection = (entries?: WorkEntry[]): string => {
  if (!entries || entries.length === 0) return '';

  let md = '';
  for (const entry of entries) {
    md += `### ${entry.organization} · ${entry.location}\n\n`;

    for (const pos of entry.positions) {
      const dateRange = `${pos.startDate || ''} - ${pos.endDate || ''}`;
      md += `**${pos.position}** | ${dateRange}\n\n`;

      for (const highlight of pos.highlights) {
        if (highlight.trim()) {
          md += `- ${highlight}\n`;
        }
      }
      md += '\n';
    }
  }
  return md;
};

// Export education section
const exportEducationSection = (entries?: EducationEntry[]): string => {
  if (!entries || entries.length === 0) return '';

  let md = '';
  for (const entry of entries) {
    md += `### ${entry.institution} · ${entry.location}\n\n`;

    const degree = entry.area ? `${entry.studyType} - ${entry.area}` : entry.studyType;
    const dateRange = `${entry.startDate || ''} - ${entry.endDate || ''}`;
    md += `**${degree}** | ${dateRange}\n\n`;

    if (entry.honors && entry.honors.length > 0) {
      md += `- 荣誉：${entry.honors.join('，')}\n`;
    }
    if (entry.courses && entry.courses.length > 0) {
      md += `- 课程：${entry.courses.join('，')}\n`;
    }
    if (entry.highlights) {
      for (const highlight of entry.highlights) {
        if (highlight.trim()) {
          md += `- ${highlight}\n`;
        }
      }
    }
    md += '\n';
  }
  return md;
};

// Export project section
const exportProjectSection = (entries?: ProjectEntry[]): string => {
  if (!entries || entries.length === 0) return '';

  let md = '';
  for (const entry of entries) {
    md += `### ${entry.name}\n\n`;

    const dateRange = `${entry.startDate || ''} - ${entry.endDate || ''}`;
    if (entry.affiliation) {
      md += `*${entry.affiliation}* | ${dateRange}\n\n`;
    } else {
      md += `${dateRange}\n\n`;
    }

    for (const highlight of entry.highlights) {
      if (highlight.trim()) {
        md += `- ${highlight}\n`;
      }
    }
    md += '\n';
  }
  return md;
};

// Export skills section
const exportSkillsSection = (skillGroups?: SkillGroup[], languages?: Language[]): string => {
  let md = '';

  if (languages && languages.length > 0) {
    const langStr = languages.map(l => `${l.language} (${l.fluency})`).join('，');
    md += `- **语言**：${langStr}\n`;
  }

  if (skillGroups) {
    for (const group of skillGroups) {
      md += `- **${group.category}**：${group.skills.join('，')}\n`;
    }
  }

  return md + '\n';
};

// Export awards section
const exportAwardsSection = (entries?: AwardEntry[]): string => {
  if (!entries || entries.length === 0) return '';

  let md = '';
  for (const entry of entries) {
    md += `### ${entry.title} | ${entry.date}\n\n`;
    md += `*${entry.issuer}*`;
    if (entry.location) {
      md += ` · ${entry.location}`;
    }
    md += '\n\n';

    if (entry.highlights) {
      for (const highlight of entry.highlights) {
        if (highlight.trim()) {
          md += `- ${highlight}\n`;
        }
      }
    }
    md += '\n';
  }
  return md;
};

// Export certificates section
const exportCertificatesSection = (entries?: CertificateEntry[]): string => {
  if (!entries || entries.length === 0) return '';

  let md = '';
  for (const entry of entries) {
    md += `### ${entry.name} | ${entry.date}\n\n`;
    md += `*${entry.issuer}*`;
    if (entry.certId) {
      md += ` · ID: ${entry.certId}`;
    }
    md += '\n\n';
  }
  return md;
};

// Export custom section
const exportCustomSection = (items?: { id: string; text: string }[]): string => {
  if (!items || items.length === 0) return '';

  let md = '';
  for (const item of items) {
    if (item.text.trim()) {
      md += `- ${item.text}\n`;
    }
  }
  return md + '\n';
};

// Download markdown file
export const downloadMarkdown = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.md') ? filename : `${filename}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Parse markdown file
export const parseMarkdownFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.name.endsWith('.md')) {
      reject(new Error('请选择 Markdown 文件 (.md)'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      resolve(content);
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file);
  });
};

// Import resume from Markdown
export const importFromMarkdown = (content: string): Partial<ResumeState> | null => {
  try {
    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
    if (!frontmatterMatch) {
      console.warn('未找到 YAML frontmatter');
      return null;
    }

    const frontmatter = yaml.load(frontmatterMatch[1]) as Record<string, unknown>;

    // Check type
    if (frontmatter.type !== 'resume') {
      console.warn('文件类型不是简历');
      return null;
    }

    // Parse body content
    const bodyContent = content.slice(frontmatterMatch[0].length).trim();
    const sections = parseBodyContent(bodyContent);

    // Build resume state
    const resume: Partial<ResumeState> = {
      personal: {
        name: (frontmatter.name as string) || '',
        email: frontmatter.email as string,
        phone: frontmatter.phone as string,
        url: frontmatter.url as string,
        titles: (frontmatter.titles as string[]) || [],
        location: frontmatter.location as { city?: string; region?: string; country?: string },
        summary: frontmatter.summary as string,
        profiles: [],
      },
      sections,
      showPhoto: (frontmatter.showPhoto as boolean) ?? false,
      showAddress: (frontmatter.showAddress as boolean) ?? true,
      showPhone: (frontmatter.showPhone as boolean) ?? true,
      showTitle: (frontmatter.showTitle as boolean) ?? true,
      updatedAt: (frontmatter.updatedAt as string) || new Date().toISOString(),
    };

    return resume;
  } catch (error) {
    console.error('解析 Markdown 失败:', error);
    return null;
  }
};

// Parse body content into sections
const parseBodyContent = (content: string): ResumeSection[] => {
  const sections: ResumeSection[] = [];

  // Split by h2 headers (##)
  const sectionRegex = /^## (.+)$/gm;
  const matches = [...content.matchAll(sectionRegex)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const title = match[1].trim();
    const startIndex = match.index! + match[0].length;
    const endIndex = i < matches.length - 1 ? matches[i + 1].index! : content.length;
    const sectionContent = content.slice(startIndex, endIndex).trim();

    // Determine section type by title
    const sectionType = inferSectionType(title);
    const section = createResumeSection(sectionType, title);
    section.visible = true;

    // Parse section content based on type
    switch (sectionType) {
      case 'work':
        section.workEntries = parseWorkSection(sectionContent);
        break;
      case 'education':
        section.educationEntries = parseEducationSection(sectionContent);
        break;
      case 'project':
        section.projectEntries = parseProjectSection(sectionContent);
        break;
      case 'skills':
        const { skillGroups, languages } = parseSkillsSection(sectionContent);
        section.skillGroups = skillGroups;
        section.languages = languages;
        break;
      case 'awards':
        section.awardEntries = parseAwardsSection(sectionContent);
        break;
      case 'certs':
        section.certificateEntries = parseCertificatesSection(sectionContent);
        break;
      default:
        section.items = parseCustomSection(sectionContent);
    }

    sections.push(section);
  }

  return sections;
};

// Infer section type from title
const inferSectionType = (title: string): ResumeSection['type'] => {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('工作') || lowerTitle.includes('work') || lowerTitle.includes('经历')) {
    return 'work';
  }
  if (lowerTitle.includes('教育') || lowerTitle.includes('education') || lowerTitle.includes('学历')) {
    return 'education';
  }
  if (lowerTitle.includes('项目') || lowerTitle.includes('project')) {
    return 'project';
  }
  if (lowerTitle.includes('技能') || lowerTitle.includes('skills') || lowerTitle.includes('技术')) {
    return 'skills';
  }
  if (lowerTitle.includes('证书') || lowerTitle.includes('cert') || lowerTitle.includes('认证')) {
    return 'certs';
  }
  if (lowerTitle.includes('奖项') || lowerTitle.includes('award') || lowerTitle.includes('荣誉')) {
    return 'awards';
  }
  if (lowerTitle.includes('社团') || lowerTitle.includes('affiliation') || lowerTitle.includes('活动')) {
    return 'affiliations';
  }
  return 'custom';
};

// Parse work section
const parseWorkSection = (content: string): WorkEntry[] => {
  const entries: WorkEntry[] = [];
  const lines = content.split('\n');

  let currentEntry: WorkEntry | null = null;
  let currentPosition: { position: string; startDate: string; endDate: string; highlights: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Match company header: ### Company · Location
    const companyMatch = trimmed.match(/^### (.+?) · (.+)$/);
    if (companyMatch) {
      if (currentEntry && currentPosition) {
        currentEntry.positions.push({
          id: crypto.randomUUID(),
          ...currentPosition,
        });
      }
      if (currentEntry) {
        entries.push(currentEntry);
      }
      currentEntry = {
        id: crypto.randomUUID(),
        organization: companyMatch[1].trim(),
        location: companyMatch[2].trim(),
        positions: [],
      };
      currentPosition = null;
      continue;
    }

    // Match position line: **Position** | Date - Date
    const positionMatch = trimmed.match(/^\*\*(.+?)\*\* \| (.+?) - (.+)$/);
    if (positionMatch && currentEntry) {
      if (currentPosition) {
        currentEntry.positions.push({
          id: crypto.randomUUID(),
          ...currentPosition,
        });
      }
      currentPosition = {
        position: positionMatch[1].trim(),
        startDate: positionMatch[2].trim(),
        endDate: positionMatch[3].trim(),
        highlights: [],
      };
      continue;
    }

    // Match highlight: - something
    const highlightMatch = trimmed.match(/^- (.+)$/);
    if (highlightMatch && currentPosition) {
      currentPosition.highlights.push(highlightMatch[1].trim());
    }
  }

  if (currentEntry && currentPosition) {
    currentEntry.positions.push({
      id: crypto.randomUUID(),
      ...currentPosition,
    });
  }
  if (currentEntry) {
    entries.push(currentEntry);
  }

  return entries;
};

// Parse education section
const parseEducationSection = (content: string): EducationEntry[] => {
  const entries: EducationEntry[] = [];
  const lines = content.split('\n');

  let currentEntry: EducationEntry | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Match institution header
    const instMatch = trimmed.match(/^### (.+?) · (.+)$/);
    if (instMatch) {
      if (currentEntry) {
        entries.push(currentEntry);
      }
      currentEntry = {
        id: crypto.randomUUID(),
        institution: instMatch[1].trim(),
        location: instMatch[2].trim(),
        studyType: '',
        area: '',
        startDate: '',
        endDate: '',
        honors: [],
        courses: [],
        highlights: [],
      };
      continue;
    }

    // Match degree line
    const degreeMatch = trimmed.match(/^\*\*(.+?)\*\* \| (.+?) - (.+)$/);
    if (degreeMatch && currentEntry) {
      const degreeParts = degreeMatch[1].split(' - ');
      currentEntry.studyType = degreeParts[0].trim();
      currentEntry.area = degreeParts[1]?.trim() || '';
      currentEntry.startDate = degreeMatch[2].trim();
      currentEntry.endDate = degreeMatch[3].trim();
      continue;
    }

    // Match honors/courses/highlights
    const itemMatch = trimmed.match(/^- (荣誉|课程)：(.+)$/);
    if (itemMatch && currentEntry) {
      const type = itemMatch[1];
      const values = itemMatch[2].split('，').map(s => s.trim());
      if (type === '荣誉') {
        currentEntry.honors = values;
      } else if (type === '课程') {
        currentEntry.courses = values;
      }
      continue;
    }

    const highlightMatch = trimmed.match(/^- (.+)$/);
    if (highlightMatch && currentEntry) {
      currentEntry.highlights!.push(highlightMatch[1].trim());
    }
  }

  if (currentEntry) {
    entries.push(currentEntry);
  }

  return entries;
};

// Parse project section
const parseProjectSection = (content: string): ProjectEntry[] => {
  const entries: ProjectEntry[] = [];
  const lines = content.split('\n');

  let currentEntry: ProjectEntry | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const nameMatch = trimmed.match(/^### (.+)$/);
    if (nameMatch) {
      if (currentEntry) {
        entries.push(currentEntry);
      }
      currentEntry = {
        id: crypto.randomUUID(),
        name: nameMatch[1].trim(),
        startDate: '',
        endDate: '',
        highlights: [],
      };
      continue;
    }

    const metaMatch = trimmed.match(/^\*(.+?)\* \| (.+?) - (.+)$/);
    if (metaMatch && currentEntry) {
      currentEntry.affiliation = metaMatch[1].trim();
      currentEntry.startDate = metaMatch[2].trim();
      currentEntry.endDate = metaMatch[3].trim();
      continue;
    }

    const highlightMatch = trimmed.match(/^- (.+)$/);
    if (highlightMatch && currentEntry) {
      currentEntry.highlights.push(highlightMatch[1].trim());
    }
  }

  if (currentEntry) {
    entries.push(currentEntry);
  }

  return entries;
};

// Parse skills section
const parseSkillsSection = (content: string): { skillGroups: SkillGroup[]; languages: Language[] } => {
  const skillGroups: SkillGroup[] = [];
  const languages: Language[] = [];

  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^- \*\*(.+?)\*\*：(.+)$/);
    if (match) {
      const category = match[1].trim();
      const values = match[2].split('，').map(s => s.trim());

      if (category === '语言') {
        for (const val of values) {
          const langMatch = val.match(/(.+?) \((.+?)\)/);
          if (langMatch) {
            languages.push({
              language: langMatch[1].trim(),
              fluency: langMatch[2].trim(),
            });
          }
        }
      } else {
        skillGroups.push({
          category,
          skills: values,
        });
      }
    }
  }

  return { skillGroups, languages };
};

// Parse awards section
const parseAwardsSection = (content: string): AwardEntry[] => {
  const entries: AwardEntry[] = [];
  const lines = content.split('\n');

  let currentEntry: AwardEntry | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const titleMatch = trimmed.match(/^### (.+?) \| (.+)$/);
    if (titleMatch) {
      if (currentEntry) {
        entries.push(currentEntry);
      }
      currentEntry = {
        id: crypto.randomUUID(),
        title: titleMatch[1].trim(),
        date: titleMatch[2].trim(),
        issuer: '',
        highlights: [],
      };
      continue;
    }

    const issuerMatch = trimmed.match(/^\*(.+?)\*(?: · (.+))?$/);
    if (issuerMatch && currentEntry) {
      currentEntry.issuer = issuerMatch[1].trim();
      currentEntry.location = issuerMatch[2]?.trim();
      continue;
    }

    const highlightMatch = trimmed.match(/^- (.+)$/);
    if (highlightMatch && currentEntry) {
      currentEntry.highlights!.push(highlightMatch[1].trim());
    }
  }

  if (currentEntry) {
    entries.push(currentEntry);
  }

  return entries;
};

// Parse certificates section
const parseCertificatesSection = (content: string): CertificateEntry[] => {
  const entries: CertificateEntry[] = [];
  const lines = content.split('\n');

  let currentEntry: CertificateEntry | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const nameMatch = trimmed.match(/^### (.+?) \| (.+)$/);
    if (nameMatch) {
      if (currentEntry) {
        entries.push(currentEntry);
      }
      currentEntry = {
        id: crypto.randomUUID(),
        name: nameMatch[1].trim(),
        date: nameMatch[2].trim(),
        issuer: '',
      };
      continue;
    }

    const issuerMatch = trimmed.match(/^\*(.+?)\*(?: · ID: (.+))?$/);
    if (issuerMatch && currentEntry) {
      currentEntry.issuer = issuerMatch[1].trim();
      currentEntry.certId = issuerMatch[2]?.trim();
    }
  }

  if (currentEntry) {
    entries.push(currentEntry);
  }

  return entries;
};

// Parse custom section
const parseCustomSection = (content: string): { id: string; text: string }[] => {
  const items: { id: string; text: string }[] = [];

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^- (.+)$/);
    if (match) {
      items.push({
        id: crypto.randomUUID(),
        text: match[1].trim(),
      });
    }
  }

  return items;
};
