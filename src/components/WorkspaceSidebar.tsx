import { useState } from 'react';
import type { ResumeVersionMeta } from '../lib/storage';

interface WorkspaceSidebarProps {
  personName: string;
  activeVersionId: string;
  versions: ResumeVersionMeta[];
  onOpenVersionManager: () => void;
  onSaveVersion: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const WorkspaceSidebar = ({
  personName,
  activeVersionId,
  versions,
  onOpenVersionManager,
  onSaveVersion,
  collapsed,
  onToggleCollapse,
}: WorkspaceSidebarProps) => {
  const [personOpen, setPersonOpen] = useState(true);
  const [resumeOpen, setResumeOpen] = useState(true);

  return (
  <aside className={`workspace-sidebar no-print ${collapsed ? 'workspace-sidebar-is-collapsed' : ''}`} aria-label="简历工作区导航">
    <div className="sidebar-heading">
      <span className="sidebar-eyebrow">工作区</span>
      <strong>我的简历</strong>
      <button type="button" className="sidebar-collapse-button" onClick={onToggleCollapse} aria-label={collapsed ? '展开侧栏' : '收起侧栏'}>{collapsed ? '→' : '←'}</button>
    </div>

    <div className="sidebar-section-label">所有简历</div>
    <div className="sidebar-tree">
      <div className="tree-person tree-item-active">
        <button type="button" className="tree-toggle" onClick={() => setPersonOpen((open) => !open)} aria-label={personOpen ? '收起人物' : '展开人物'}>{personOpen ? '⌄' : '›'}</button>
        <span className="tree-avatar">{personName.slice(0, 1) || '我'}</span>
        <span className="tree-label">{personName || '未命名人物'}</span>
      </div>
      {personOpen ? <div className="tree-resume-group">
        <div className="tree-resume tree-item-active">
          <button type="button" className="tree-toggle" onClick={() => setResumeOpen((open) => !open)} aria-label={resumeOpen ? '收起简历' : '展开简历'}>{resumeOpen ? '⌄' : '›'}</button>
          <span className="tree-document">▤</span>
          <span className="tree-label">默认简历</span>
        </div>
        {resumeOpen ? <div className="tree-versions">
          {versions.slice(0, 3).map((version) => (
            <button
              key={version.id}
              type="button"
              className={`tree-version ${version.id === activeVersionId ? 'tree-version-active' : ''}`}
              onClick={onOpenVersionManager}
            >
              <span className="tree-dot" />
              <span>{version.name}</span>
            </button>
          ))}
        </div> : null}
      </div> : null}
    </div>

    <div className="sidebar-actions">
      <button type="button" className="sidebar-action" onClick={onSaveVersion}>＋ 新建版本</button>
      <button type="button" className="sidebar-action" onClick={onOpenVersionManager}>⚙ 管理版本</button>
    </div>

    <div className="sidebar-footer">
      <span className="sidebar-footer-icon">⌘</span>
      <span>自动保存已开启</span>
    </div>
  </aside>
  );
};

export default WorkspaceSidebar;
