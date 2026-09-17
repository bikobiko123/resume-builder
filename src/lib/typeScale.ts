import type { ResumeState } from '../types/resume';
import { resumeFontStack } from './fonts';

/**
 * The one place that turns a `ResumeState`'s typography into CSS custom
 * properties.
 *
 * The preview (`PreviewA4`) and the headless document (`renderResumeDocument`,
 * which `measure` and the PDF export both lay out) must set *exactly* the same
 * variables, or the two renderers silently disagree about where a line wraps and
 * `measure` starts describing a document nobody can see. They used to build this
 * object separately; this module is why they no longer can.
 *
 * AN OPTIONAL LEVEL EMITS NOTHING. When `namePt` and friends are unset, the
 * variable is left out entirely so the `var()` fallback written into `a4.css`
 * (`2.21em` etc.) takes over — which is what every resume written before the
 * per-level controls existed relies on. Emitting a resolved `pt` instead would
 * freeze those documents at today's ratios and make them render differently the
 * next time the body size changed.
 */
export const resumeCssVariables = (resume: ResumeState): Record<string, string> => {
  const variables: Record<string, string> = {
    '--resume-font-size': `${resume.fontSizePt}pt`,
    '--resume-font-family': resumeFontStack(resume.fontFamily),
  };

  if (resume.namePt !== undefined) variables['--resume-name-size'] = `${resume.namePt}pt`;
  if (resume.sectionPt !== undefined) variables['--resume-section-size'] = `${resume.sectionPt}pt`;
  if (resume.entryPt !== undefined) variables['--resume-entry-size'] = `${resume.entryPt}pt`;

  return variables;
};

/** `resumeCssVariables` as a single inline `style` attribute value. */
export const resumeCssVariableStyle = (resume: ResumeState): string =>
  Object.entries(resumeCssVariables(resume))
    .map(([name, value]) => `${name}: ${value}`)
    .join('; ');
