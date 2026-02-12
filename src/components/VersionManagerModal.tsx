import type { ResumeVersionMeta } from '../lib/storage';

interface VersionManagerModalProps {
  open: boolean;
  versions: ResumeVersionMeta[];
  activeVersionId: string;
  onClose: () => void;
  onSwitch: (versionId: string) => void;
  onRename: (versionId: string, name: string) => void;
  onDelete: (versionId: string) => void;
}

const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('zh-CN', { hour12: false });
};

const VersionManagerModal = ({
  open,
  versions,
  activeVersionId,
  onClose,
  onSwitch,
  onRename,
  onDelete,
}: VersionManagerModalProps) => {
  if (!open) return null;

  return (
    <div className="modal-backdrop no-print" role="dialog" aria-modal="true" aria-label="版本管理">
      <section className="modal-card version-modal-card">
        <div className="section-title-line">
          <h4>版本管理</h4>
          <button type="button" className="btn btn-mini btn-light" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="version-list">
          {versions.map((version) => (
            <div
              key={version.id}
              data-testid={`version-row-${version.id}`}
              className={version.id === activeVersionId ? 'version-row version-row-active' : 'version-row'}
            >
              <div className="version-main">
                <div className="version-name-line">
                  <strong>{version.name}</strong>
                  <span
                    className={
                      version.kind === 'draft'
                        ? 'version-kind-badge version-kind-draft'
                        : 'version-kind-badge version-kind-snapshot'
                    }
                  >
                    {version.kind === 'draft' ? '草稿' : '快照'}
                  </span>
                  {version.id === activeVersionId ? (
                    <span className="version-active-badge">当前编辑中</span>
                  ) : null}
                </div>
                <p className="version-time">更新时间：{formatDateTime(version.updatedAt)}</p>
              </div>

              <div className="version-actions">
                {version.id !== activeVersionId ? (
                  <button type="button" className="btn btn-mini btn-light" onClick={() => onSwitch(version.id)}>
                    进入编辑
                  </button>
                ) : null}

                <button
                  type="button"
                  className="btn btn-mini btn-light"
                  onClick={() => {
                    const nextName = window.prompt('请输入新的版本名', version.name);
                    if (nextName === null) return;
                    const trimmed = nextName.trim();
                    if (!trimmed) {
                      alert('版本名不能为空');
                      return;
                    }
                    onRename(version.id, trimmed);
                  }}
                >
                  重命名
                </button>

                {version.kind === 'snapshot' ? (
                  <button
                    type="button"
                    className="btn btn-mini btn-danger"
                    onClick={() => {
                      if (!window.confirm(`确认删除版本“${version.name}”？`)) return;
                      onDelete(version.id);
                    }}
                  >
                    删除
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default VersionManagerModal;
