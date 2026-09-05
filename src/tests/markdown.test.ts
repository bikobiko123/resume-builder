import { describe, expect, it } from 'vitest';
import { importFromMarkdown } from '../lib/markdown';

const frontmatter = `---
type: resume
name: 测试用户
---`;

describe('importFromMarkdown', () => {
  it('imports 项目经历 as a project section instead of work experience', () => {
    const result = importFromMarkdown(`${frontmatter}

# 测试用户

## 项目经历

### 简历排版系统

*个人项目* | 2026-01 - 至今

- 实现 Markdown 导入与在线编辑
`);

    const section = result?.sections?.[0];
    expect(section?.type).toBe('project');
    expect(section?.projectEntries).toHaveLength(1);
    expect(section?.projectEntries?.[0]).toMatchObject({
      name: '简历排版系统',
      affiliation: '个人项目',
      startDate: '2026-01',
      endDate: '至今',
      highlights: ['实现 Markdown 导入与在线编辑'],
    });
  });

  it('keeps generic 实习经历 as work experience', () => {
    const result = importFromMarkdown(`${frontmatter}

# 测试用户

## 实习经历

### 示例公司 · 杭州

**产品实习生** | 2025-01 - 2025-06

- 完成项目交付
`);

    const section = result?.sections?.[0];
    expect(section?.type).toBe('work');
    expect(section?.workEntries?.[0].organization).toBe('示例公司');
  });
});
