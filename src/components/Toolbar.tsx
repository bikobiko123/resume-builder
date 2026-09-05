import { useRef } from 'react';
import AuthPanel from './AuthPanel';
import { MAX_RESUME_FONT_SIZE_PT, MIN_RESUME_FONT_SIZE_PT } from '../types/resume';

export type SaveStatus = 'idle' | 'saving-local' | 'saving-cloud' | 'saved' | 'offline' | 'error';

interface ToolbarProps {
  onExport: () => void;
  onReset: () => void;
  onSaveVersion: () => void;
  onOpenVersionManager: () => void;
  onExportMarkdown: () => void;
  onImportMarkdown: (file: File) => void;
  activeVersionName: string;
  fitScale: number;
  isScaleLow: boolean;
  fontSizePt: number;
  onFontSizeChange: (fontSizePt: number) => void;
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

const Toolbar = ({
  onExport,
  onReset,
  onSaveVersion,
  onOpenVersionManager,
  onExportMarkdown,
  onImportMarkdown,
  activeVersionName,
  fitScale,
  isScaleLow,
  fontSizePt,
  onFontSizeChange,
  authLoading,
  userEmail,
  onSignedOut,
  saveStatus,
  cloudNotice,
}: ToolbarProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportMarkdown(file);
      e.target.value = '';
    }
  };

  return (
    <header className="toolbar no-print">
      <div>
        <h1>简历生成器</h1>
        <p>A4 单页排版 + PDF/Markdown 导出</p>
        <p className="toolbar-subtle">当前版本：{activeVersionName}</p>
        <div className="toolbar-status-line">
          <span className={`save-status save-status-${saveStatus}`}>{saveStatusLabel[saveStatus]}</span>
          <AuthPanel authLoading={authLoading} userEmail={userEmail} onSignedOut={onSignedOut} />
        </div>
        {cloudNotice ? <p className="cloud-notice">{cloudNotice}</p> : null}
      </div>
      <div className="toolbar-actions">
        <label className="font-size-control">
          <span>字号 {fontSizePt.toFixed(1)}pt</span>
          <input
            type="range"
            min={MIN_RESUME_FONT_SIZE_PT}
            max={MAX_RESUME_FONT_SIZE_PT}
            step="0.1"
            value={fontSizePt}
            onChange={(event) => onFontSizeChange(Number(event.target.value))}
            aria-label="调整简历字号"
          />
        </label>
        <span className={isScaleLow ? 'scale-status scale-status-warn' : 'scale-status'}>
          当前缩放 {Math.round(fitScale * 100)}%
        </span>
        <button type="button" className="btn btn-light" onClick={onReset}>重置模板</button>
        <button type="button" className="btn btn-light" onClick={() => fileInputRef.current?.click()}>导入 Markdown</button>
        <button type="button" className="btn btn-light" onClick={onExportMarkdown}>导出 Markdown</button>
        <button type="button" className="btn btn-light" onClick={onSaveVersion}>保存版本</button>
        <button type="button" className="btn btn-light" onClick={onOpenVersionManager}>版本管理</button>
        <button type="button" className="btn btn-primary" onClick={onExport}>导出 PDF</button>
        <input ref={fileInputRef} type="file" accept=".md,.markdown" onChange={handleFileChange} style={{ display: 'none' }} />
      </div>
    </header>
  );
};

export default Toolbar;
