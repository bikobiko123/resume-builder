import { describe, expect, it } from 'vitest';
import { renderInlineText } from '../components/InlineText';

describe('renderInlineText', () => {
  it('turns markdown bold markers into strong nodes', () => {
    const nodes = renderInlineText('负责**数据分析**与报告撰写');
    const parts = Array.isArray(nodes) ? nodes : [];

    expect(parts).toHaveLength(3);
    expect(parts[1]).toMatchObject({
      type: 'strong',
      props: { children: '数据分析' },
    });
  });
});
