import { useEffect, useMemo, useState } from 'react';
import Toolbar from './components/Toolbar';
import EditorPanel from './components/EditorPanel';
import PreviewA4 from './components/PreviewA4';
import VersionManagerModal from './components/VersionManagerModal';
import { computeFitScale } from './lib/fitScale';
import { exportPdf, preparePrint } from './lib/pdf';
import {
  createSnapshotFromActive,
  deleteVersion,
  getActiveResume,
  listVersionsMeta,
  loadVersionStore,
  renameVersion,
  resetActiveToTemplate,
  saveActiveResume,
  switchActiveVersion,
  type ResumeVersionMeta,
  type ResumeVersionStoreV1,
} from './lib/storage';
import { exportToMarkdown, downloadMarkdown, parseMarkdownFile, importFromMarkdown } from './lib/markdown';
import {
  createDefaultResumeState,
  createResumeSection,
  type ResumeState,
  type SectionType,
  type PhotoData,
} from './types/resume';

const App = () => {
  const [resume, setResume] = useState<ResumeState>(createDefaultResumeState);
  const [fitScale, setFitScale] = useState(1);
  const [measureVersion, setMeasureVersion] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [activeVersionId, setActiveVersionId] = useState('');
  const [versionsMeta, setVersionsMeta] = useState<ResumeVersionMeta[]>([]);
  const [versionManagerOpen, setVersionManagerOpen] = useState(false);

  const syncVersionState = (store: ResumeVersionStoreV1, syncResume = false) => {
    setActiveVersionId(store.activeVersionId);
    setVersionsMeta(listVersionsMeta());
    if (syncResume) {
      setResume(getActiveResume(store));
    }
  };

  useEffect(() => {
    const store = loadVersionStore();
    setResume(getActiveResume(store));
    setActiveVersionId(store.activeVersionId);
    setVersionsMeta(listVersionsMeta());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      const store = saveActiveResume({
        ...resume,
        updatedAt: new Date().toISOString(),
      });
      syncVersionState(store, false);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [resume, hydrated]);

  useEffect(() => {
    const cleanup = () => document.body.classList.remove('print-mode');
    window.addEventListener('afterprint', cleanup);
    return () => window.removeEventListener('afterprint', cleanup);
  }, []);

  const isScaleLow = useMemo(() => fitScale < 0.72, [fitScale]);
  const activeVersionName = useMemo(
    () => versionsMeta.find((version) => version.id === activeVersionId)?.name || '当前草稿',
    [versionsMeta, activeVersionId]
  );

  const handleMeasure = (naturalHeight: number, frameHeight: number) => {
    const next = computeFitScale(naturalHeight, frameHeight);
    setFitScale((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
  };

  const handleExport = () => {
    setMeasureVersion((prev) => prev + 1);
    window.setTimeout(() => {
      preparePrint();
      exportPdf();
    }, 80);
  };

  const handleReset = () => {
    const store = resetActiveToTemplate();
    syncVersionState(store, true);
    setMeasureVersion((prev) => prev + 1);
  };

  const handleSaveVersion = () => {
    const store = createSnapshotFromActive();
    syncVersionState(store, false);
    alert('版本已保存');
  };

  const handleSwitchVersion = (versionId: string) => {
    const store = switchActiveVersion(versionId);
    syncVersionState(store, true);
    setMeasureVersion((prev) => prev + 1);
  };

  const handleRenameVersion = (versionId: string, name: string) => {
    const store = renameVersion(versionId, name);
    syncVersionState(store, false);
  };

  const handleDeleteVersion = (versionId: string) => {
    const store = deleteVersion(versionId);
    syncVersionState(store, true);
    setMeasureVersion((prev) => prev + 1);
  };

  // Markdown export/import
  const handleExportMarkdown = () => {
    const content = exportToMarkdown(resume);
    const filename = `${resume.personal.name || '简历'}_${new Date().toISOString().split('T')[0]}`;
    downloadMarkdown(content, filename);
  };

  const handleImportMarkdown = async (file: File) => {
    try {
      const content = await parseMarkdownFile(file);
      const imported = importFromMarkdown(content);
      if (imported) {
        const defaults = createDefaultResumeState();
        setResume({
          ...defaults,
          ...imported,
          personal: { ...defaults.personal, ...imported.personal },
          sections: imported.sections || defaults.sections,
          updatedAt: new Date().toISOString(),
        } as ResumeState);
        setMeasureVersion((prev) => prev + 1);
        alert('导入成功！');
      } else {
        alert('导入失败：无法解析文件内容');
      }
    } catch (error) {
      alert(`导入失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // Personal info updates
  const updatePersonal = (updates: Partial<ResumeState['personal']>) => {
    setResume((prev) => ({
      ...prev,
      personal: { ...prev.personal, ...updates },
    }));
  };

  const updatePhoto = (photo?: PhotoData) => {
    setResume((prev) => ({ ...prev, photo }));
  };

  const toggleShowPhoto = () => {
    setResume((prev) => ({ ...prev, showPhoto: !prev.showPhoto }));
  };

  const toggleShowAddress = () => {
    setResume((prev) => ({ ...prev, showAddress: !prev.showAddress }));
  };

  const toggleShowPhone = () => {
    setResume((prev) => ({ ...prev, showPhone: !prev.showPhone }));
  };

  const toggleShowTitle = () => {
    setResume((prev) => ({ ...prev, showTitle: !prev.showTitle }));
  };

  const toggleShowName = () => {
    setResume((prev) => ({ ...prev, showName: !prev.showName }));
  };

  const toggleShowEmail = () => {
    setResume((prev) => ({ ...prev, showEmail: !prev.showEmail }));
  };

  const toggleShowUrl = () => {
    setResume((prev) => ({ ...prev, showUrl: !prev.showUrl }));
  };

  const toggleShowProfiles = () => {
    setResume((prev) => ({ ...prev, showProfiles: !prev.showProfiles }));
  };

  const toggleShowSummary = () => {
    setResume((prev) => ({ ...prev, showSummary: !prev.showSummary }));
  };

  // Section operations
  const addSection = (type: SectionType) => {
    setResume((prev) => ({
      ...prev,
      sections: [...prev.sections, createResumeSection(type)],
    }));
  };

  const removeSection = (sectionId: string) => {
    setResume((prev) => ({
      ...prev,
      sections: prev.sections.filter((section) => section.id !== sectionId),
    }));
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    setResume((prev) => {
      const sections = [...prev.sections];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= sections.length) return prev;
      [sections[index], sections[newIndex]] = [sections[newIndex], sections[index]];
      return { ...prev, sections };
    });
  };

  const toggleSectionVisible = (sectionId: string) => {
    setResume((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId ? { ...section, visible: !section.visible } : section
      ),
    }));
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    setResume((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId ? { ...section, title } : section
      ),
    }));
  };

  const updateSection = (sectionId: string, updates: Partial<ResumeState['sections'][0]>) => {
    setResume((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId ? { ...section, ...updates } : section
      ),
    }));
  };

  return (
    <div className="app-shell">
      <Toolbar
        onExport={handleExport}
        onReset={handleReset}
        onSaveVersion={handleSaveVersion}
        onOpenVersionManager={() => setVersionManagerOpen(true)}
        onExportMarkdown={handleExportMarkdown}
        onImportMarkdown={handleImportMarkdown}
        activeVersionName={activeVersionName}
        fitScale={fitScale}
        isScaleLow={isScaleLow}
      />

      {isScaleLow ? (
        <p className="scale-warning no-print">内容较多，当前缩放低于 72%，建议精简内容以保证可读性。</p>
      ) : null}

      <main className="workspace">
        <EditorPanel
          resume={resume}
          onUpdatePersonal={updatePersonal}
          onPhotoChange={updatePhoto}
          onToggleShowPhoto={toggleShowPhoto}
          onToggleShowName={toggleShowName}
          onToggleShowEmail={toggleShowEmail}
          onToggleShowPhone={toggleShowPhone}
          onToggleShowUrl={toggleShowUrl}
          onToggleShowProfiles={toggleShowProfiles}
          onToggleShowAddress={toggleShowAddress}
          onToggleShowTitle={toggleShowTitle}
          onToggleShowSummary={toggleShowSummary}
          onAddSection={addSection}
          onRemoveSection={removeSection}
          onMoveSection={moveSection}
          onToggleVisible={toggleSectionVisible}
          onSectionTitleChange={updateSectionTitle}
          onUpdateSection={updateSection}
        />

        <PreviewA4
          resume={resume}
          fitScale={fitScale}
          measureVersion={measureVersion}
          onMeasure={handleMeasure}
        />
      </main>

      <VersionManagerModal
        open={versionManagerOpen}
        versions={versionsMeta}
        activeVersionId={activeVersionId}
        onClose={() => setVersionManagerOpen(false)}
        onSwitch={handleSwitchVersion}
        onRename={handleRenameVersion}
        onDelete={handleDeleteVersion}
      />
    </div>
  );
};

export default App;
