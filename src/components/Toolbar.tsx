import { useRef } from 'react';
import { MAX_RESUME_FONT_SIZE_PT, MIN_RESUME_FONT_SIZE_PT } from '../types/resume';

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
}

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
}: ToolbarProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportMarkdown(file);
      // Reset input so the same file can be selected again
      e.target.value = '';
    }
  };

  return (
    <header className="toolbar no-print">
      <div>
        <h1>简历生成器</h1>
        <p>A4 单页排版 + PDF/Markdown 导出</p>
        <p className="toolbar-subtle">当前版本：{activeVersionName}</p>
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
        <button type="button" className="btn btn-light" onClick={onReset}>
          重置模板
        </button>
        <button type="button" className="btn btn-light" onClick={handleImportClick}>
          导入 Markdown
        </button>
        <button type="button" className="btn btn-light" onClick={onExportMarkdown}>
          导出 Markdown
        </button>
        <button type="button" className="btn btn-light" onClick={onSaveVersion}>
          保存版本
        </button>
        <button type="button" className="btn btn-light" onClick={onOpenVersionManager}>
          版本管理
        </button>
        <button type="button" className="btn btn-primary" onClick={onExport}>
          导出 PDF
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>
    </header>
  );
};

export default Toolbar;
