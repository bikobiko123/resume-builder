import type { SkillGroup } from '../types/resume';

const stripTrailingColon = (value: string): string => value.trim().replace(/[：:]+$/u, '').trim();

export const splitSkillValues = (value: string): string[] =>
  value
    .split(/[，,、]/u)
    .map(stripTrailingColon)
    .filter(Boolean);

export const sanitizeSkillGroups = (groups?: SkillGroup[]): SkillGroup[] =>
  (groups || [])
    .map((group) => ({
      category: stripTrailingColon(group.category),
      skills: splitSkillValues(group.skills.join('，')),
    }))
    .filter((group) => group.category && group.skills.length > 0);

export const parseSkillGroupLine = (line: string): SkillGroup | null => {
  const normalized = line.trim().replace(/^[-*]\s*/u, '');
  if (!normalized) return null;

  const boldMatch = normalized.match(/^\*\*(.+?)\*\*\s*[：:]\s*(.*)$/u);
  const category = boldMatch ? boldMatch[1] : normalized.slice(0, normalized.search(/[：:]/u));
  const values = boldMatch ? boldMatch[2] : normalized.slice(normalized.search(/[：:]/u) + 1);

  if (!boldMatch && normalized.search(/[：:]/u) === -1) return null;

  const skillGroup = {
    category: stripTrailingColon(category),
    skills: splitSkillValues(values),
  };

  return skillGroup.category && skillGroup.skills.length > 0 ? skillGroup : null;
};

export const formatSkillGroupLine = (group: SkillGroup): string =>
  `${group.category}: ${group.skills.join(', ')}`;
