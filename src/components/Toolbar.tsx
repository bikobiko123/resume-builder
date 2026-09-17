import { useRef } from 'react';
import AuthPanel from './AuthPanel';
import {
  MAX_LEVEL_FONT_SIZE_PT,
  MAX_RESUME_FONT_SIZE_PT,
  MIN_LEVEL_FONT_SIZE_PT,
  MIN_RESUME_FONT_SIZE_PT,
  type ResumeFontFamily,
  type ResumeHeaderAlignment,
  type ResumeLevelKey,
  type ResumeTypeScale,
} from '../types/resume';
import { RESUME_FONT_OPTIONS } from '../lib/fonts';

export type SaveStatus = 'idle' | 'saving-local' | 'saving-cloud' | 'saved' | 'offline' | 'error';

interface ToolbarProps {
  onExport: () => void;
  onReset: () => void;
  onSaveVersion: () => void;
  onOpenVersionManager: () => void;
  onExportMarkdown: () => void;
  onExportWord: () => void;
  wordExporting: boolean;
  onImportMarkdown: (file: File) => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  personName: string;
  activeVersionName: string;
  pageFillRatio: number;
  isOverflowing: boolean;
  fontSizePt: number;
  onFontSizeChange: (fontSizePt: number) => void;
  /** 四档字号换算后的实际 pt，含「哪几档在跟随正文」。 */
  typeScale: ResumeTypeScale;
  /** `pt` 为 `undefined` 表示恢复「跟随正文」。 */
  onLevelFontSizeChange: (level: ResumeLevelKey, pt: number | undefined) => void;
  fontFamily: ResumeFontFamily;
  onFontFamilyChange: (fontFamily: ResumeFontFamily) => void;
  headerAlignment: ResumeHeaderAlignment;
  onHeaderAlignmentChange: (alignment: ResumeHeaderAlignment) => void;
  authLoading: boolean;
  userEmail?: string;
  onSignedOut: () => void;
  saveStatus: SaveStatus;
  cloudNotice: string;
}

const saveStatusLabel: Record<SaveStatus, string> = {
  idle: '尚未保存',
  'saving-local': '正在保存本地…',
  'saving-cloud': '正在同步云端…',
  saved: '已保存',
  offline: '离线，已保存到本地',
  error: '云端同步失败，本地已保存',
};

/** 三档可单独设置的层级。正文那档就是原来的字号滑块，仍然是主控。 */
const LEVEL_ROWS: ReadonlyArray<{ key: ResumeLevelKey; label: string; hint: string }> = [
  { key: 'name', label: '姓名', hint: '页头姓名' },
  { key: 'section', label: '章节', hint: '「工作经历」这类标题' },
  { key: 'entry', label: '条目', hint: '公司 / 学校 / 项目名' },
];

const Toolbar = ({
  onExport,
  onReset,
  onSaveVersion,
  onOpenVersionManager,
  onExportMarkdown,
  onExportWord,
  wordExporting,
  onImportMarkdown,
  onExportJson,
  onImportJson,
  personName,
  activeVersionName,
  pageFillRatio,
  isOverflowing,
  fontSizePt,
  onFontSizeChange,
  typeScale,
  onLevelFontSizeChange,
  fontFamily,
  onFontFamilyChange,
  headerAlignment,
  onHeaderAlignmentChange,
  authLoading,
  userEmail,
  onSignedOut,
  saveStatus,
  cloudNotice,
}: ToolbarProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportMarkdown(file);
      e.target.value = '';
    }
  };

  const handleJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportJson(file);
      e.target.value = '';
    }
  };

  return (
    <header className="toolbar no-print">
      <div className="toolbar-context">
        <h1>简历生成器</h1>
        <p className="toolbar-breadcrumb">{personName || '未命名人物'} <span>/</span> {activeVersionName}</p>
        <div className="toolbar-status-line">
          <span className={`save-status save-status-${saveStatus}`}>{saveStatusLabel[saveStatus]}</span>
          <AuthPanel authLoading={authLoading} userEmail={userEmail} onSignedOut={onSignedOut} />
        </div>
        {cloudNotice ? <p className="cloud-notice">{cloudNotice}</p> : null}
      </div>
      <div className="toolbar-actions">
        <div className="header-alignment-control" role="group" aria-label="页头对齐方式">
          <span>页头</span>
          <button
            type="button"
            className={headerAlignment === 'left' ? 'active' : ''}
            aria-pressed={headerAlignment === 'left'}
            onClick={() => onHeaderAlignmentChange('left')}
          >左对齐</button>
          <button
            type="button"
            className={headerAlignment === 'center' ? 'active' : ''}
            aria-pressed={headerAlignment === 'center'}
            onClick={() => onHeaderAlignmentChange('center')}
          >居中</button>
        </div>
        <label className="font-family-control">
          <span>字体</span>
          <select
            value={fontFamily}
            onChange={(event) => onFontFamilyChange(event.target.value as ResumeFontFamily)}
            aria-label="选择简历字体"
          >
            {RESUME_FONT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="font-size-control">
          <span>正文字号 {fontSizePt.toFixed(1)}pt</span>
          <input type="range" min={MIN_RESUME_FONT_SIZE_PT} max={MAX_RESUME_FONT_SIZE_PT} step="0.1" value={fontSizePt} onChange={(event) => onFontSizeChange(Number(event.target.value))} aria-label="调整正文字号" />
        </label>
        {/*
          A popover rather than three more sliders in the bar: the toolbar is
          already at its width budget, and these are tuned occasionally to buy
          vertical space rather than dragged continuously.
        */}
        <details className="level-size-control">
          <summary aria-label="调整各层级字号">
            层级字号
            {LEVEL_ROWS.some((row) => !typeScale.following[row.key]) ? <span className="level-size-dot" aria-hidden="true" /> : null}
          </summary>
          <div className="level-size-popover">
            <p className="level-size-note">未单独设置时跟随正文，改正文会一起缩放。</p>
            {LEVEL_ROWS.map((row) => {
              const pt = row.key === 'name'
                ? typeScale.namePt
                : row.key === 'section' ? typeScale.sectionPt : typeScale.entryPt;
              const following = typeScale.following[row.key];
              return (
                <div className="level-size-row" key={row.key}>
                  <span className="level-size-label" title={row.hint}>{row.label}</span>
                  <input
                    type="range"
                    min={MIN_LEVEL_FONT_SIZE_PT}
                    max={MAX_LEVEL_FONT_SIZE_PT}
                    step="0.5"
                    value={pt}
                    onChange={(event) => onLevelFontSizeChange(row.key, Number(event.target.value))}
                    aria-label={`调整${row.label}字号`}
                  />
                  <span className="level-size-value">{pt.toFixed(1)}pt</span>
                  <button
                    type="button"
                    className="level-size-reset"
                    onClick={() => onLevelFontSizeChange(row.key, undefined)}
                    disabled={following}
                    title={following ? '已经跟随正文' : '改回跟随正文'}
                  >跟随</button>
                </div>
              );
            })}
          </div>
        </details>
        <span className={isOverflowing ? 'scale-status scale-status-warn' : 'scale-status'}>
          {isOverflowing ? `超出 ${Math.round((pageFillRatio - 1) * 100)}%` : `页面占用 ${Math.round(pageFillRatio * 100)}%`}
        </span>
        <button type="button" className="btn btn-primary" onClick={onExport}>导出 PDF</button>
        <details className="toolbar-menu">
          <summary aria-label="更多操作">•••</summary>
          <div className="toolbar-menu-popover">
            <button type="button" onClick={onReset}>重置模板</button>
            <button type="button" onClick={() => fileInputRef.current?.click()}>导入 Markdown</button>
            <button type="button" onClick={onExportMarkdown}>导出 Markdown</button>
            <button type="button" onClick={onExportWord} disabled={wordExporting}>
              {wordExporting ? '正在导出 Word…' : '导出 Word (.docx)'}
            </button>
            <button type="button" onClick={() => jsonInputRef.current?.click()}>导入 JSON</button>
            <button type="button" onClick={onExportJson}>导出 JSON</button>
            <button type="button" onClick={onSaveVersion}>保存版本</button>
            <button type="button" onClick={onOpenVersionManager}>版本管理</button>
          </div>
        </details>
        <input ref={fileInputRef} type="file" accept=".md,.markdown" onChange={handleFileChange} style={{ display: 'none' }} />
        <input ref={jsonInputRef} type="file" accept=".json,application/json" onChange={handleJsonFileChange} style={{ display: 'none' }} />
      </div>
    </header>
  );
};

export default Toolbar;
