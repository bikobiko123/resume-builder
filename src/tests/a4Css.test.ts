import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESUME_LEVEL_RATIOS } from '../types/resume';

/**
 * Guards on `a4.css` for the two ways the preview can silently stop matching the
 * printed page.
 *
 * Both are one-word CSS regressions with no visible error: the preview keeps
 * looking plausible while wrapping text somewhere the print layout does not, and
 * `measure` — which is what an agent trusts — would then be describing a
 * document nobody can see. The behaviour itself is verified in a real browser;
 * these just make the CSS contract explicit so a tidy-up has to be deliberate.
 */

const cssPath = path.join(process.cwd(), 'src', 'styles', 'a4.css');
const css = readFileSync(cssPath, 'utf8');

/** The declarations of a rule, keyed by selector — a deliberately small parser for this one file. */
const ruleFor = (selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = css.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'mu'));
  if (!match) throw new Error(`a4.css 里找不到规则 ${selector}`);
  return match[1].replace(/\/\*[\s\S]*?\*\//gu, '');
};

describe('a4.css — the preview sheet keeps the print layout', () => {
  it('never lets the sheet shrink below 210mm', () => {
    const page = ruleFor('.a4-page');
    // A flex item shrinks by default, which squeezes the text column on a narrow
    // preview panel and re-wraps every line.
    expect(page).toMatch(/flex:\s*none/u);
    expect(page).toMatch(/width:\s*210mm/u);
  });

  it('centres the sheet without making an overflowing sheet unreachable', () => {
    const stage = ruleFor('.a4-stage');
    // `justify-content: center` on an overflowing flex container puts the start
    // of the content out of reach; `margin: 0 auto` on the sheet does not.
    expect(stage).not.toMatch(/justify-content:\s*center/u);
    expect(ruleFor('.a4-page')).toMatch(/margin:\s*0\s+auto/u);
  });

  it('resets the preview zoom for printing', () => {
    // The zoom is a viewport-only control. The document itself never scales.
    expect(css).toMatch(/zoom:\s*1\s*!important/u);
    expect(ruleFor('.a4-content')).not.toMatch(/transform/u);
  });

  it('uses a physical serif type scale instead of px masquerading as pt', () => {
    const content = ruleFor('.a4-content');
    expect(content).toMatch(/font-size:\s*var\(--resume-font-size,\s*9\.5pt\)/u);
    expect(content).toMatch(/font-family:\s*var\(--resume-font-family/u);
    expect(content).toMatch(/Source Han Serif SC/u);
    expect(css).not.toContain('--resume-font-scale');
    expect(css).not.toMatch(/font-size:\s*calc\([^)]*px/u);
  });

  it('keeps the portrait at the print dimensions used by the preview', () => {
    const avatar = ruleFor('.avatar-box');
    expect(avatar).toMatch(/width:\s*20mm/u);
    expect(avatar).toMatch(/height:\s*25mm/u);
  });

  it('supports left and centered header metadata without changing body alignment', () => {
    expect(ruleFor('.resume-header-alignment-left .header-content')).toMatch(/align-items:\s*flex-start/u);
    expect(ruleFor('.resume-header-alignment-center .header-content')).toMatch(/align-items:\s*center/u);
    expect(ruleFor('.resume-header-alignment-center .resume-contact')).toMatch(/justify-content:\s*center/u);
    expect(ruleFor('.resume-header .resume-summary')).toMatch(/text-align:\s*left/u);
  });

  it('每档层级的 em 兜底值等于 RESUME_LEVEL_RATIOS', () => {
    // CSS 读不到 TS 常量，只能在这里把两边钉住：兜底值同时也是所有存量简历
    // （三个字段都缺省）实际渲染的倍率，改了就等于改了所有人的排版。
    const levelSelectors: Array<[keyof typeof RESUME_LEVEL_RATIOS, string, string]> = [
      ['name', '.resume-header h1', '--resume-name-size'],
      ['section', '.resume-section h2', '--resume-section-size'],
      ['entry', '.entry-org', '--resume-entry-size'],
    ];

    for (const [level, selector, variable] of levelSelectors) {
      const ratio = RESUME_LEVEL_RATIOS[level];
      expect(ruleFor(selector)).toMatch(
        new RegExp(`font-size:\\s*var\\(${variable},\\s*${ratio}em\\)`, 'u'),
      );
    }
  });
});
