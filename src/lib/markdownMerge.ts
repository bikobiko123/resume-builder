import type { ResumeSection, ResumeState, WorkEntry } from '../types/resume';
import { assignResumeIds } from './ids';
import { importFromMarkdown } from './markdown';

/**
 * Merge an edited Markdown view back into the canonical JSON.
 *
 * Markdown is a lossy view on purpose — it carries no photo, no font size, no
 * visibility toggles — so it must never be the source of truth. This merges
 * **sections only** and leaves personal info and preferences alone; those are
 * edited in the UI or through `patch`.
 *
 * Alignment is positional: the Markdown's nth section is matched against the
 * nth visible section of the canonical document, and only when the inferred
 * type matches. That covers the intended use — rewriting bullets and adding
 * entries — without any fuzzy matching that could silently retarget an edit.
 * Structural changes (reordering, deleting a section) belong in `patch`.
 *
 * Ids are the interesting part: an entry that lines up with a canonical entry
 * keeps that entry's id, so a prose edit never invalidates the addresses other
 * tools hold. Genuinely new entries get a blank id here and a deterministic one
 * from `assignResumeIds`, which is also what discards the random uuids the
 * Markdown parser generates.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Recursively replace every `id` string with `''` so it can be regenerated deterministically. */
const blankIds = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(blankIds);
  if (!isRecord(value)) return value;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = key === 'id' && typeof entry === 'string' ? '' : blankIds(entry);
  }
  return result;
};

/**
 * Keep the canonical id for the entry in the same position; blank the rest so
 * `assignResumeIds` names them from their content.
 */
const mergeIds = <T extends { id: string }>(incoming: T[] | undefined, current: T[] | undefined): T[] | undefined => {
  if (!incoming) return undefined;
  return incoming.map((entry, index) => ({ ...entry, id: current?.[index]?.id ?? '' }));
};

const mergeWorkEntries = (incoming: WorkEntry[], current: WorkEntry[] | undefined): WorkEntry[] =>
  incoming.map((entry, index) => {
    const previous = current?.[index];
    return {
      ...entry,
      id: previous?.id ?? '',
      positions: entry.positions.map((position, positionIndex) => ({
        ...position,
        id: previous?.positions?.[positionIndex]?.id ?? '',
      })),
    };
  });

/** Content fields to carry over, per section type. Nothing else is touched. */
const mergeSection = (current: ResumeSection, incoming: ResumeSection): ResumeSection => {
  const merged: ResumeSection = { ...current, title: incoming.title };

  switch (incoming.type) {
    case 'work':
      merged.workEntries = mergeWorkEntries(incoming.workEntries ?? [], current.workEntries);
      break;
    case 'education':
      merged.educationEntries = mergeIds(incoming.educationEntries, current.educationEntries);
      break;
    case 'project':
      merged.projectEntries = mergeIds(incoming.projectEntries, current.projectEntries);
      break;
    case 'awards':
      merged.awardEntries = mergeIds(incoming.awardEntries, current.awardEntries);
      break;
    case 'certs':
      merged.certificateEntries = mergeIds(incoming.certificateEntries, current.certificateEntries);
      break;
    case 'affiliations':
      merged.affiliationEntries = mergeIds(incoming.affiliationEntries, current.affiliationEntries);
      break;
    case 'skills':
      merged.skillGroups = incoming.skillGroups ?? [];
      merged.languages = incoming.languages ?? [];
      merged.interests = incoming.interests ?? [];
      break;
    default:
      merged.items = mergeIds(incoming.items, current.items);
      break;
  }

  return merged;
};

export interface MarkdownMergeReport {
  action: 'replaced' | 'added';
  /** Index in the canonical `sections` array, or `null` when the section was appended. */
  index: number | null;
  title: string;
  type: ResumeSection['type'];
}

export interface MarkdownMergeResult {
  /** False when the Markdown could not be parsed — `resume` is then the untouched input. */
  parsed: boolean;
  resume: ResumeState;
  report: MarkdownMergeReport[];
  /** Canonical visible sections the Markdown did not mention; they are left as they were. */
  unmentioned: number;
  warnings: string[];
}

export const mergeMarkdownIntoResume = (canonical: ResumeState, markdown: string): MarkdownMergeResult => {
  const parsed = importFromMarkdown(markdown);
  if (!parsed) {
    return {
      parsed: false,
      resume: canonical,
      report: [],
      unmentioned: 0,
      warnings: ['无法解析 Markdown：缺少 YAML frontmatter，或 frontmatter 的 type 不是 "resume"'],
    };
  }

  const warnings: string[] = [];
  const incomingSections = (parsed.sections ?? []).map((section) => blankIds(section) as ResumeSection);
  const sections = [...canonical.sections];
  const report: MarkdownMergeReport[] = [];

  const visibleTargets = canonical.sections
    .map((section, index) => ({ section, index }))
    .filter((entry) => entry.section.visible);

  let matched = 0;

  incomingSections.forEach((incoming, markdownIndex) => {
    const target = visibleTargets[markdownIndex];

    if (target && target.section.type === incoming.type) {
      sections[target.index] = mergeSection(target.section, incoming);
      report.push({ action: 'replaced', index: target.index, title: incoming.title, type: incoming.type });
      matched += 1;
      return;
    }

    sections.push({ ...incoming, visible: true });
    report.push({ action: 'added', index: null, title: incoming.title, type: incoming.type });

    if (target) {
      warnings.push(
        `第 ${markdownIndex + 1} 个章节「${incoming.title}」(${incoming.type}) 与文档中同位置的「${target.section.title}」(${target.section.type}) 类型不同，已作为新章节追加。`,
      );
    }
  });

  const unmentioned = visibleTargets.length - matched;
  if (unmentioned > 0) {
    warnings.push(
      `有 ${unmentioned} 个可见章节没有出现在 Markdown 里，已保持原样；Markdown 不支持删除章节，删除请用 patch。`,
    );
  }

  const { resume } = assignResumeIds({ ...canonical, sections });
  return { parsed: true, resume, report, unmentioned, warnings };
};
