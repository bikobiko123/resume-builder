import { describe, expect, it } from 'vitest';
import { parseSkillGroupLine, sanitizeSkillGroups } from '../lib/skills';

describe('parseSkillGroupLine', () => {
  it('supports Chinese category separators and removes accidental trailing colons', () => {
    expect(parseSkillGroupLine('工具能力：ArcGIS、ArcGISpro、XMind、PS:')).toEqual({
      category: '工具能力',
      skills: ['ArcGIS', 'ArcGISpro', 'XMind', 'PS'],
    });
  });

  it('supports exported markdown skill rows', () => {
    expect(parseSkillGroupLine('- **数据处理**：Excel，SPSS，MATLAB')).toEqual({
      category: '数据处理',
      skills: ['Excel', 'SPSS', 'MATLAB'],
    });
  });
});

describe('sanitizeSkillGroups', () => {
  it('filters empty groups that would render as dangling labels', () => {
    expect(
      sanitizeSkillGroups([
        { category: '工具能力', skills: ['ArcGIS', ''] },
        { category: '空技能', skills: [] },
      ]),
    ).toEqual([{ category: '工具能力', skills: ['ArcGIS'] }]);
  });
});
