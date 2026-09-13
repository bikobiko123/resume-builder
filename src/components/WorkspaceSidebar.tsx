import { useState } from 'react';
import type { ResumePersonMeta, ResumeVersionMeta } from '../lib/storage';

interface WorkspaceSidebarProps {
  persons: ResumePersonMeta[];
  versions: ResumeVersionMeta[];
  activeVersionId: string;
  onSelectPerson: (personId: string) => void;
  onSelectVersion: (versionId: string) => void;
  onCreatePerson: () => void;
  onDeletePerson: (personId: string) => void;
  onOpenVersionManager: () => void;
  onSaveVersion: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const VISIBLE_SNAPSHOTS = 3;

const WorkspaceSidebar = ({
  persons,
  versions,
  activeVersionId,
  onSelectPerson,
  onSelectVersion,
  onCreatePerson,
  onDeletePerson,
  onOpenVersionManager,
  onSaveVersion,
  collapsed,
  onToggleCollapse,
}: WorkspaceSidebarProps) => {
  const [collapsedPersons, setCollapsedPersons] = useState<Record<string, boolean>>({});
  const isOpen = (personId: string) => !collapsedPersons[personId];
  const togglePerson = (personId: string) =>
    setCollapsedPersons((prev) => ({ ...prev, [personId]: !prev[personId] }));

  return (
  <aside className={`workspace-sidebar no-print ${collapsed ? 'workspace-sidebar-is-collapsed' : ''}`} aria-label="简历工作区导航">
    <div className="sidebar-heading">
      <span className="sidebar-eyebrow">工作区</span>
      <strong>我的简历</strong>
      <button type="button" className="sidebar-collapse-button" onClick={onToggleCollapse} aria-label={collapsed ? '展开侧栏' : '收起侧栏'}>{collapsed ? '→' : '←'}</button>
    </div>

    <div className="sidebar-section-label">所有简历</div>
    <div className="sidebar-tree">
      {persons.map((person) => {
        const owned = versions.filter((version) => version.personId === person.id);
        const draft = owned.find((version) => version.kind === 'draft');
        const snapshots = owned.filter((version) => version.kind === 'snapshot');
        const open = isOpen(person.id);

        return (
          <div key={person.id} className="tree-person-group">
            <div className={`tree-person ${person.isActive ? 'tree-item-active' : ''}`}>
              <button
                type="button"
                className="tree-toggle"
                onClick={() => togglePerson(person.id)}
                aria-label={open ? `收起 ${person.name}` : `展开 ${person.name}`}
                aria-expanded={open}
              >
                {open ? '⌄' : '›'}
              </button>
              <span className="tree-avatar">{person.name.slice(0, 1) || '我'}</span>
              <button
                type="button"
                className="tree-label tree-label-button"
                onClick={() => onSelectPerson(person.id)}
                title={person.name}
              >
                {person.name}
              </button>
              {persons.length > 1 ? (
                <button
                  type="button"
                  className="tree-delete"
                  onClick={() => onDeletePerson(person.id)}
                  aria-label={`删除人物 ${person.name}`}
                  title="删除该人物及其全部版本"
                >
                  ×
                </button>
              ) : null}
            </div>

            {open ? (
              <div className="tree-resume-group">
                <div className={`tree-resume ${person.isActive ? 'tree-item-active' : ''}`}>
                  <span className="tree-document">▤</span>
                  <button
                    type="button"
                    className="tree-label tree-label-button"
                    onClick={() => draft && onSelectVersion(draft.id)}
                    title={draft?.name ?? '默认简历'}
                  >
                    {draft?.name ?? '默认简历'}
                  </button>
                </div>

                {snapshots.length > 0 ? (
                  <div className="tree-versions">
                    {snapshots.slice(0, VISIBLE_SNAPSHOTS).map((version) => (
                      <button
                        key={version.id}
                        type="button"
                        className={`tree-version ${version.id === activeVersionId ? 'tree-version-active' : ''}`}
                        onClick={() => onSelectVersion(version.id)}
                        title={version.name}
                      >
                        <span className="tree-dot" />
                        <span className="tree-version-label">{version.name}</span>
                      </button>
                    ))}
                    {snapshots.length > VISIBLE_SNAPSHOTS ? (
                      <button type="button" className="tree-version tree-version-more" onClick={onOpenVersionManager}>
                        还有 {snapshots.length - VISIBLE_SNAPSHOTS} 个版本…
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>

    <div className="sidebar-actions">
      <button type="button" className="sidebar-action sidebar-action-primary" onClick={onCreatePerson}>＋ 新建人物</button>
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
