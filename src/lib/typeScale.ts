import type { ResumeState } from '../types/resume';
import { resolveResumeSpacing } from '../types/resume';
import { resumeFontStack } from './fonts';

/**
 * The one place that turns a `ResumeState`'s typography and spacing into CSS
 * custom properties.
 *
 * The preview (`PreviewA4`) and the headless document (`renderResumeDocument`,
 * which `measure` and the PDF export both lay out) must set *exactly* the same
 * variables, or the two renderers silently disagree about where a line wraps and
 * `measure` starts describing a document nobody can see. They used to build this
 * object separately; this module is why they no longer can.
 *
 * AN OPTIONAL SETTING EMITS NOTHING. When `namePt` / `spacing` and friends are
 * unset, the variable is left out entirely so the `var()` fallback written into
 * `a4.css` (`2.21em`, `1.4`, `12mm` …) takes over — which is what every resume
 * written before these controls existed relies on. Emitting a resolved value
 * instead would freeze those documents at today's numbers and make them render
 * differently the next time a default changed.
 */
export const resumeCssVariables = (resume: ResumeState): Record<string, string> => {
  const variables: Record<string, string> = {
    '--resume-font-size': `${resume.fontSizePt}pt`,
    '--resume-font-family': resumeFontStack(resume.fontFamily),
  };

  if (resume.namePt !== undefined) variables['--resume-name-size'] = `${resume.namePt}pt`;
  if (resume.sectionPt !== undefined) variables['--resume-section-size'] = `${resume.sectionPt}pt`;
  if (resume.entryPt !== undefined) variables['--resume-entry-size'] = `${resume.entryPt}pt`;

  if (resume.spacing !== undefined) {
    const spacing = resolveResumeSpacing(resume);
    variables['--resume-line-height'] = String(spacing.lineHeight);
    variables['--resume-page-gap-y'] = `${spacing.pagePaddingMm}mm`;
    variables['--resume-block-gap'] = `${spacing.blockGapMm}mm`;
    variables['--resume-item-gap'] = `${spacing.itemGapMm}mm`;
    variables['--resume-section-gap'] = `${spacing.sectionGapMm}mm`;
  }

  return variables;
};

/** `resumeCssVariables` as a single inline `style` attribute value. */
export const resumeCssVariableStyle = (resume: ResumeState): string =>
  Object.entries(resumeCssVariables(resume))
    .map(([name, value]) => `${name}: ${value}`)
    .join('; ');
