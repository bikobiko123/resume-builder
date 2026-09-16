import type {
  ResumeSection,
  ResumeState,
  SectionType,
} from '../types/resume';

/**
 * Stable, human-readable entry ids.
 *
 * Why this exists: an agent editing a resume has to point at one bullet or one
 * entry. Random UUIDs (what the editor generates for new entries) are fine for
 * React keys but useless as an address an agent can reason about, re-read and
 * reuse between commands.
 *
 * Rules:
 * - An id that is already set is never rewritten (unless `rewrite` is asked
 *   for), so ids survive every edit — a patch that renames an organization does
 *   not invalidate an id something else already referenced.
 * - Missing ids are derived from content: `work-acme-1`, `edu-清华大学-1`.
 * - Collisions get a numeric suffix, assigned in document order, so
 *   regenerating from the same content always produces the same ids.
 */

export interface AssignIdsOptions {
  /** Regenerate every id from content, including ids that are already set. */
  rewrite?: boolean;
}

export interface AssignIdsResult {
  resume: ResumeState;
  /** Ids that were created or replaced by this call. */
  assigned: string[];
}

const SLUG_KEEP = /[a-z0-9぀-ヿ㐀-䶿一-鿿豈-﫿]/u;

/** Lowercase, keep CJK/ASCII alphanumerics, collapse everything else into `-`. */
export const slugify = (value: string, maxLength = 24): string => {
  const normalized = Array.from(value.trim().toLowerCase())
    .map((char) => (SLUG_KEEP.test(char) ? char : '-'))
    .join('')
    .replace(/-+/gu, '-')
    .replace(/^-|-$/gu, '');
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength).replace(/-+$/u, '');
};

export const createIdFactory = () => {
  const used = new Set<string>();

  return (prefix: string, label: string, current?: string): { id: string; created: boolean } => {
    if (current && !used.has(current)) {
      used.add(current);
      return { id: current, created: false };
    }

    const slug = slugify(label);
    const base = slug ? `${prefix}-${slug}` : prefix;
    let candidate = base;
    let counter = 1;
    while (used.has(candidate)) {
      counter += 1;
      candidate = `${base}-${counter}`;
    }
    used.add(candidate);
    return { id: candidate, created: true };
  };
};

const SECTION_FALLBACK_LABEL: Record<SectionType, string> = {
  work: 'work',
  education: 'education',
  project: 'project',
  skills: 'skills',
  certs: 'certs',
  awards: 'awards',
  affiliations: 'affiliations',
  custom: 'custom',
};

/**
 * Fill in missing ids across the whole resume. Returns a new object; the input
 * is not mutated.
 */
export const assignResumeIds = (
  resume: ResumeState,
  options: AssignIdsOptions = {},
): AssignIdsResult => {
  const next = createIdFactory();
  const assigned: string[] = [];
  const rewrite = options.rewrite === true;

  // Ids that are already set are kept verbatim: only regenerate when asked to,
  // or when the id is missing/blank.
  const keep = (current: string | undefined): string | undefined =>
    rewrite ? undefined : (current && current.trim() ? current : undefined);

  const take = (prefix: string, label: string, current?: string): string => {
    const result = next(prefix, label, keep(current));
    if (result.created) assigned.push(result.id);
    return result.id;
  };

  const sections: ResumeSection[] = resume.sections.map((section) => {
    const sectionId = take('sec', section.title || SECTION_FALLBACK_LABEL[section.type] || section.type, section.id);

    return {
      ...section,
      id: sectionId,
      workEntries: section.workEntries?.map((entry) => ({
        ...entry,
        id: take('work', entry.organization, entry.id),
        positions: entry.positions.map((position) => ({
          ...position,
          id: take('pos', position.position, position.id),
        })),
      })),
      educationEntries: section.educationEntries?.map((entry) => ({
        ...entry,
        id: take('edu', entry.institution, entry.id),
      })),
      projectEntries: section.projectEntries?.map((entry) => ({
        ...entry,
        id: take('proj', entry.name, entry.id),
      })),
      awardEntries: section.awardEntries?.map((entry) => ({
        ...entry,
        id: take('award', entry.title, entry.id),
      })),
      certificateEntries: section.certificateEntries?.map((entry) => ({
        ...entry,
        id: take('cert', entry.name, entry.id),
      })),
      affiliationEntries: section.affiliationEntries?.map((entry) => ({
        ...entry,
        id: take('affil', entry.organization, entry.id),
      })),
      items: section.items?.map((item) => ({
        ...item,
        id: take('item', item.text, item.id),
      })),
    };
  });

  return { resume: { ...resume, sections }, assigned };
};

export interface IdOccurrence {
  id: string;
  path: string;
}

/**
 * Every id in the resume, in document order — the same order `assignResumeIds`
 * hands out collision suffixes in, so `validate` can spot duplicates.
 */
export const collectIds = (resume: ResumeState): IdOccurrence[] => {
  const found: IdOccurrence[] = [];

  const push = (id: string, path: string) => found.push({ id, path });

  resume.sections.forEach((section, sectionIndex) => {
    const base = `/sections/${sectionIndex}`;
    push(section.id, base);

    section.workEntries?.forEach((entry, entryIndex) => {
      const entryPath = `${base}/workEntries/${entryIndex}`;
      push(entry.id, entryPath);
      entry.positions.forEach((position, positionIndex) => {
        push(position.id, `${entryPath}/positions/${positionIndex}`);
      });
    });

    section.educationEntries?.forEach((entry, entryIndex) =>
      push(entry.id, `${base}/educationEntries/${entryIndex}`));
    section.projectEntries?.forEach((entry, entryIndex) =>
      push(entry.id, `${base}/projectEntries/${entryIndex}`));
    section.awardEntries?.forEach((entry, entryIndex) =>
      push(entry.id, `${base}/awardEntries/${entryIndex}`));
    section.certificateEntries?.forEach((entry, entryIndex) =>
      push(entry.id, `${base}/certificateEntries/${entryIndex}`));
    section.affiliationEntries?.forEach((entry, entryIndex) =>
      push(entry.id, `${base}/affiliationEntries/${entryIndex}`));
    section.items?.forEach((item, itemIndex) =>
      push(item.id, `${base}/items/${itemIndex}`));
  });

  return found;
};
