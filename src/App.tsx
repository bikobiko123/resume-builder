import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { User } from '@supabase/supabase-js';
import Toolbar, { type SaveStatus } from './components/Toolbar';
import EditorPanel from './components/EditorPanel';
import PreviewA4 from './components/PreviewA4';
import VersionManagerModal from './components/VersionManagerModal';
import WorkspaceSidebar from './components/WorkspaceSidebar';
import { computeFitScale } from './lib/fitScale';
import { exportPdf, preparePrint } from './lib/pdf';
import { loadCloudStore, resolveCloudBootstrap, saveCloudStore } from './lib/cloudStorage';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import {
  backupVersionStore,
  createSnapshotFromActive,
  deleteVersion,
  getActiveResume,
  getLocalPersistenceError,
  listVersionsMeta,
  loadVersionStore,
  normalizeStore,
  persistVersionStore,
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
  normalizeResumeFontSize,
  type ResumeState,
  type SectionType,
  type PhotoData,
} from './types/resume';

const App = () => {
  const [resume, setResume] = useState<ResumeState>(createDefaultResumeState);
  const [fitScale, setFitScale] = useState(1);
  const [previewZoom, setPreviewZoom] = useState(0.72);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [measureVersion, setMeasureVersion] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [activeVersionId, setActiveVersionId] = useState('');
  const [versionsMeta, setVersionsMeta] = useState<ResumeVersionMeta[]>([]);
  const [versionManagerOpen, setVersionManagerOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [cloudReady, setCloudReady] = useState(!isSupabaseConfigured);
  const [cloudNotice, setCloudNotice] = useState('');
  const [localNotice, setLocalNotice] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const localStoreRef = useRef<ResumeVersionStoreV1 | null>(null);
  const userRef = useRef<User | null>(null);
  const cloudReadyRef = useRef(cloudReady);
  const cloudSaveGenerationRef = useRef(0);
  const cloudSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingCloudStoreRef = useRef<ResumeVersionStoreV1 | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    cloudReadyRef.current = cloudReady;
  }, [cloudReady]);

  useEffect(() => {
    cloudSaveGenerationRef.current += 1;
    pendingCloudStoreRef.current = null;
  }, [user?.id]);

  const syncVersionState = (store: ResumeVersionStoreV1, syncResume = false) => {
    localStoreRef.current = store;
    setActiveVersionId(store.activeVersionId);
    setVersionsMeta(listVersionsMeta(store));
    setLocalNotice(getLocalPersistenceError() ?? '');
    if (syncResume) setResume(getActiveResume(store));
  };

  const syncStoreToCloud = (store: ResumeVersionStoreV1) => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    if (!cloudReadyRef.current) {
      pendingCloudStoreRef.current = store;
      return;
    }

    const generation = ++cloudSaveGenerationRef.current;
    cloudSaveQueueRef.current = cloudSaveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (generation !== cloudSaveGenerationRef.current) return;
        setSaveStatus('saving-cloud');
        try {
          const result = await saveCloudStore(currentUser.id, store);
          if (generation !== cloudSaveGenerationRef.current) return;
          if (result.error) {
            setSaveStatus(navigator.onLine ? 'error' : 'offline');
            setCloudNotice(`云端同步失败：${result.error.message}。本地数据仍已保存。`);
            return;
          }
          setSaveStatus('saved');
          setCloudNotice('');
        } catch (error) {
          if (generation !== cloudSaveGenerationRef.current) return;
          setSaveStatus(navigator.onLine ? 'error' : 'offline');
          setCloudNotice(`云端同步失败：${error instanceof Error ? error.message : '网络请求失败'}。本地数据仍已保存。`);
        }
      });
  };

  useEffect(() => {
    const store = loadVersionStore();
    syncVersionState(store, true);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      setCloudReady(true);
      return;
    }

    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      if (!session) {
        setCloudReady(true);
        setSaveStatus('idle');
      }
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !user) {
      if (!user) setCloudReady(true);
      return;
    }

    let cancelled = false;
    const localStore = localStoreRef.current ?? loadVersionStore();
    setCloudReady(false);
    setCloudNotice('正在读取云端简历…');
    setSaveStatus('saving-cloud');

    loadCloudStore(user.id).then(async (result) => {
      if (cancelled) return;
      if (result.error) {
        setCloudReady(true);
        setSaveStatus(navigator.onLine ? 'error' : 'offline');
        setCloudNotice(`云端读取失败：${result.error.message}。当前继续使用本地数据。`);
        return;
      }

      const decision = resolveCloudBootstrap(localStore, result.data);
      if (!decision.shouldUploadLocal) {
        if (decision.hasConflict && !backupVersionStore(localStore)) {
          setSaveStatus('error');
          setCloudNotice('本地与云端不同，但浏览器无法创建安全备份。已保留本地简历并暂停同步，请先导出 Markdown，再处理存储空间。');
          return;
        }
        pendingCloudStoreRef.current = null;
        setCloudNotice(decision.hasConflict
          ? '当前使用云端版本；切换前的本地简历已保留为浏览器备份。'
          : '');
        const normalized = normalizeStore(decision.store);
        persistVersionStore(normalized);
        syncVersionState(normalized, true);
        setSaveStatus('saved');
        setCloudReady(true);
        return;
      }

      const uploadStore = pendingCloudStoreRef.current ?? decision.store;
      pendingCloudStoreRef.current = null;
      const upload = await saveCloudStore(user.id, uploadStore);
      if (cancelled) return;
      setCloudReady(true);
      if (upload.error) {
        setSaveStatus(navigator.onLine ? 'error' : 'offline');
        setCloudNotice(`首次同步失败：${upload.error.message}。本地数据仍已保存。`);
        return;
      }
      setSaveStatus('saved');
      setCloudNotice('本地简历已首次同步到云端。');
    }).catch((error: unknown) => {
      if (cancelled) return;
      setCloudReady(true);
      setSaveStatus(navigator.onLine ? 'error' : 'offline');
      setCloudNotice(`云端同步失败：${error instanceof Error ? error.message : '网络请求失败'}。当前继续使用本地数据。`);
    });

    return () => {
      cancelled = true;
    };
  }, [hydrated, user?.id]);

  useEffect(() => {
    if (!cloudReady || !userRef.current || !pendingCloudStoreRef.current) return;
    const pendingStore = pendingCloudStoreRef.current;
    pendingCloudStoreRef.current = null;
    syncStoreToCloud(pendingStore);
  }, [cloudReady]);

  useEffect(() => {
    if (!hydrated) return;
    setSaveStatus((status) => status === 'saving-cloud' ? status : 'saving-local');
    const timer = window.setTimeout(() => {
      const store = saveActiveResume({ ...resume, updatedAt: new Date().toISOString() });
      syncVersionState(store, false);
      if (userRef.current && cloudReadyRef.current) {
        syncStoreToCloud(store);
      } else {
        setSaveStatus(navigator.onLine ? 'saved' : 'offline');
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [resume, hydrated]);

  useEffect(() => {
    const handleOnline = () => {
      const store = localStoreRef.current;
      if (store && userRef.current && cloudReadyRef.current) syncStoreToCloud(store);
    };
    const handleOffline = () => setSaveStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
    syncStoreToCloud(store);
    setMeasureVersion((prev) => prev + 1);
  };

  const handleSaveVersion = () => {
    const store = createSnapshotFromActive();
    syncVersionState(store, false);
    syncStoreToCloud(store);
    setSaveStatus(userRef.current ? 'saving-cloud' : 'saved');
    alert('版本已保存');
  };

  const handleSwitchVersion = (versionId: string) => {
    const store = switchActiveVersion(versionId);
    syncVersionState(store, true);
    syncStoreToCloud(store);
    setMeasureVersion((prev) => prev + 1);
  };

  const handleRenameVersion = (versionId: string, name: string) => {
    const store = renameVersion(versionId, name);
    syncVersionState(store, false);
    syncStoreToCloud(store);
  };

  const handleDeleteVersion = (versionId: string) => {
    const store = deleteVersion(versionId);
    syncVersionState(store, true);
    syncStoreToCloud(store);
    setMeasureVersion((prev) => prev + 1);
  };

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

  const updatePersonal = (updates: Partial<ResumeState['personal']>) => {
    setResume((prev) => ({ ...prev, personal: { ...prev.personal, ...updates } }));
  };
  const updatePhoto = (photo?: PhotoData) => setResume((prev) => ({ ...prev, photo }));
  const toggleShowPhoto = () => setResume((prev) => ({ ...prev, showPhoto: !prev.showPhoto }));
  const toggleShowAddress = () => setResume((prev) => ({ ...prev, showAddress: !prev.showAddress }));
  const toggleShowPhone = () => setResume((prev) => ({ ...prev, showPhone: !prev.showPhone }));
  const toggleShowTitle = () => setResume((prev) => ({ ...prev, showTitle: !prev.showTitle }));
  const toggleShowName = () => setResume((prev) => ({ ...prev, showName: !prev.showName }));
  const toggleShowEmail = () => setResume((prev) => ({ ...prev, showEmail: !prev.showEmail }));
  const toggleShowUrl = () => setResume((prev) => ({ ...prev, showUrl: !prev.showUrl }));
  const toggleShowProfiles = () => setResume((prev) => ({ ...prev, showProfiles: !prev.showProfiles }));
  const toggleShowSummary = () => setResume((prev) => ({ ...prev, showSummary: !prev.showSummary }));

  const updateFontSize = (fontSizePt: number) => {
    setResume((prev) => ({ ...prev, fontSizePt: normalizeResumeFontSize(fontSizePt) }));
    setMeasureVersion((prev) => prev + 1);
  };

  const addSection = (type: SectionType) => {
    setResume((prev) => ({ ...prev, sections: [...prev.sections, createResumeSection(type)] }));
  };
  const removeSection = (sectionId: string) => {
    setResume((prev) => ({ ...prev, sections: prev.sections.filter((section) => section.id !== sectionId) }));
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
      sections: prev.sections.map((section) => section.id === sectionId ? { ...section, visible: !section.visible } : section),
    }));
  };
  const updateSectionTitle = (sectionId: string, title: string) => {
    setResume((prev) => ({
      ...prev,
      sections: prev.sections.map((section) => section.id === sectionId ? { ...section, title } : section),
    }));
  };
  const updateSection = (sectionId: string, updates: Partial<ResumeState['sections'][0]>) => {
    setResume((prev) => ({
      ...prev,
      sections: prev.sections.map((section) => section.id === sectionId ? { ...section, ...updates } : section),
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
        fontSizePt={resume.fontSizePt}
        onFontSizeChange={updateFontSize}
        authLoading={authLoading}
        userEmail={user?.email}
        onSignedOut={() => setUser(null)}
        saveStatus={saveStatus}
        cloudNotice={localNotice || cloudNotice}
      />

      {isScaleLow ? <p className="scale-warning no-print">内容较多，当前缩放低于 72%，建议精简内容以保证可读性。</p> : null}

      <main className={`workspace ${sidebarCollapsed ? 'workspace-sidebar-collapsed' : ''}`}>
        <WorkspaceSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((collapsed) => !collapsed)}
          personName={resume.personal.name}
          activeVersionId={activeVersionId}
          versions={versionsMeta}
          onOpenVersionManager={() => setVersionManagerOpen(true)}
          onSaveVersion={handleSaveVersion}
        />
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
        <section className="preview-panel">
          <div className="preview-panel-header no-print">
            <div>
              <span className="preview-eyebrow">实时预览</span>
              <strong>A4 页面</strong>
            </div>
            <div className="preview-controls">
              <button type="button" onClick={() => setPreviewZoom((zoom) => Math.max(0.45, Number((zoom - 0.1).toFixed(2))))} aria-label="缩小预览">−</button>
              <span>{Math.round(previewZoom * 100)}%</span>
              <button type="button" onClick={() => setPreviewZoom((zoom) => Math.min(1.4, Number((zoom + 0.1).toFixed(2))))} aria-label="放大预览">＋</button>
              <button type="button" onClick={() => setPreviewZoom(0.72)} aria-label="重置预览缩放">重置</button>
            </div>
          </div>
          <div className="preview-viewport" style={{ '--preview-zoom': previewZoom } as CSSProperties}>
            <PreviewA4 resume={resume} fitScale={fitScale} measureVersion={measureVersion} onMeasure={handleMeasure} />
          </div>
        </section>
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
