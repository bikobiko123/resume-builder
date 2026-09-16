import { useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import type { ResumeState } from '../types/resume';
import { renderResumeBody } from '../lib/html';
import { resumeFontStack } from '../lib/fonts';

interface PreviewA4Props {
  resume: ResumeState;
  measureVersion: number;
  onMeasure: (naturalHeight: number, frameHeight: number) => void;
  /**
   * Content-box width available to the sheet, reported on mount and whenever the
   * panel is resized. The sheet itself is always 210mm wide (see `a4.css`) and
   * never shrinks, so callers use this to pick a zoom that makes it fit.
   */
  onStageWidth?: (contentWidth: number) => void;
}

/**
 * The on-screen A4 preview.
 *
 * The document body is produced by `renderResumeBody` — the same function the
 * headless `measure` command and the PDF export use — so what the browser
 * measures here and what the CLI measures off-screen can never drift apart.
 * This component only owns the frame, the CSS custom properties and the
 * height measurement.
 *
 * `dangerouslySetInnerHTML` is deliberate and safe here: `renderResumeBody`
 * escapes every value it interpolates (see the escaping contract in
 * `src/lib/html.ts`) and emits only its own tags, so nothing from the resume —
 * including an imported one — reaches the DOM as markup.
 */
const PreviewA4 = ({ resume, measureVersion, onMeasure, onStageWidth }: PreviewA4Props) => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const bodyHtml = useMemo(() => renderResumeBody(resume), [resume]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;

    let rafId = 0;
    const measure = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const lastChild = content.lastElementChild as HTMLElement | null;
        const paddingBottom = Number.parseFloat(getComputedStyle(content).paddingBottom) || 0;
        const naturalHeight = lastChild
          ? lastChild.offsetTop + lastChild.offsetHeight + paddingBottom
          : content.scrollHeight;
        onMeasure(naturalHeight, frame.clientHeight);
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    Array.from(content.children).forEach((child) => observer.observe(child));

    void document.fonts.ready.then(() => {
      measure();
    });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [bodyHtml, measureVersion, onMeasure]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || !onStageWidth) return;

    const report = () => {
      const style = getComputedStyle(stage);
      const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
      onStageWidth(stage.clientWidth - padding);
    };

    // Report once synchronously so the first paint already uses the fitted zoom.
    report();

    const observer = new ResizeObserver(report);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [onStageWidth]);

  const contentStyle = {
    '--resume-font-size': `${resume.fontSizePt}pt`,
    '--resume-font-family': resumeFontStack(resume.fontFamily),
  } as CSSProperties;

  return (
    <section className="preview-document" id="print-root">
      <div className="a4-stage" ref={stageRef}>
        <div className="a4-page" ref={frameRef}>
          <div
            className="a4-content"
            ref={contentRef}
            style={contentStyle}
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </div>
      </div>
    </section>
  );
};

export default PreviewA4;
