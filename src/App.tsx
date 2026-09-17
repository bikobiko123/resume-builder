import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { User } from '@supabase/supabase-js';
import Toolbar, { type SaveStatus } from './components/Toolbar';
import EditorPanel from './components/EditorPanel';
import PreviewA4 from './components/PreviewA4';
import VersionManagerModal from './components/VersionManagerModal';
import WorkspaceSidebar from './components/WorkspaceSidebar';
import { clampPreviewZoom, fitPreviewZoom, PREVIEW_ZOOM_STEP } from './lib/a4';
import { exportPdf, preparePrint } from './lib/pdf';
import {
  deleteCloudPerson,
  deleteCloudRows,
  isCloudSchemaError,
  loadCloudRows,
  planCloudSync,
  saveCloudPerson,
  SCHEMA_NOT_MIGRATED_MESSAGE,
  type CloudSyncPlan,
} from './lib/cloudStorage';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import {
  createPerson,
  createSnapshotFromActive,
  deletePerson,
  deleteVersion,
  getActiveResume,
  getLocalPersistenceError,
  isBlankPersonSlice,
  listPersonsMeta,
  listVersionsMeta,
  loadVersionStore,
  persistVersionStore,
  personIdsOf,
  personSlice,
  renameVersion,
  resetActiveToTemplate,
  saveActiveResume,
  switchActivePerson,
  switchActiveVersion,
  type ResumePersonMeta,
  type ResumeVersionMeta,
  type ResumeVersionStore,
} from './lib/storage';
import { exportToMarkdown, downloadMarkdown, parseMarkdownFile, importFromMarkdown } from './lib/markdown';
import { assignResumeIds } from './lib/ids';
import { normalizeResume } from './lib/resumeSchema';
import { downloadText } from './lib/download';
import {
  createDefaultResumeState,
  createResumeSection,
  normalizeLevelFontSize,
  normalizeResumeFontFamily,
  normalizeResumeFontSize,
  normalizeResumeHeaderAlignment,
  resolveResumeTypeScale,
  type ResumeFontFamily,
  type ResumeHeaderAlignment,
  type ResumeLevelKey,
  type ResumeState,
  type SectionType,
  type PhotoData,
} from './types/resume';

const TOMBSTONE_STORAGE_KEY = 'resume_builder_deleted_persons_v1';

/** 层级 key → `ResumeState` 上的字段名。 */
const LEVEL_FONT_SIZE_FIELDS: Record<ResumeLevelKey, 'namePt' | 'sectionPt' | 'entryPt'> = {
  name: 'namePt',
  section: 'sectionPt',
  entry: 'entryPt',
};

/**
 * 本地已删除的人物。没有它，另一台设备下一次同步会把已删人物重新推回云端（复活）。
 * 只在云端行确认删除后才清除。
 */
const readTombstones = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(TOMBSTONE_STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

const writeTombstones = (personIds: string[]): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOMBSTONE_STORAGE_KEY, JSON.stringify(personIds));
  } catch {
    /* 存储不可用时 tombstone 只存在内存里，最多导致已删人物被推回一次 */
  }
};

const sliceName = (slice: ResumeVersionStore): string =>
  slice.versions.find((version) => version.kind === 'draft')?.resume.personal.name?.trim() ?? '';

const storeContentChanged = (before: ResumeVersionStore, after: ResumeVersionStore): boolean =>
  before.activeVersionId !== after.activeVersionId ||
  JSON.stringify(before.versions) !== JSON.stringify(after.versions);

const App = () => {
  const [resume, setResume] = useState<ResumeState>(createDefaultResumeState);
  const [pageFillRatio, setPageFillRatio] = useState(0);
  /** Zoom that makes the 210mm sheet fit the panel, tracked from the panel's own width. */
  const [fitZoom, setFitZoom] = useState(1);
  /** A zoom the user pinned with ±; null means "follow the panel width". */
  const [manualZoom, setManualZoom] = useState<number | null>(null);
  const previewZoom = manualZoom ?? fitZoom;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [measureVersion, setMeasureVersion] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [activeVersionId, setActiveVersionId] = useState('');
  const [versionsMeta, setVersionsMeta] = useState<ResumeVersionMeta[]>([]);
  const [personsMeta, setPersonsMeta] = useState<ResumePersonMeta[]>([]);
  const [versionManagerOpen, setVersionManagerOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [cloudReady, setCloudReady] = useState(!isSupabaseConfigured);
  const [cloudNotice, setCloudNotice] = useState('');
  const [localNotice, setLocalNotice] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [wordExporting, setWordExporting] = useState(false);

  const localStoreRef = useRef<ResumeVersionStore | null>(null);
  const userRef = useRef<User | null>(null);
  const cloudReadyRef = useRef(cloudReady);
  const cloudSaveGenerationRef = useRef(0);
  const cloudSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingCloudStoreRef = useRef<ResumeVersionStore | null>(null);
  const tombstonesRef = useRef<string[]>(readTombstones());
  /** 云端是否已经有人物：用于避免全新设备的空白草稿被推成一行云端文档。 */
  const cloudHasContentRef = useRef(false);
  /** 表结构未迁移时阻断同步，避免每次编辑都失败刷屏。 */
  const cloudBlockedRef = useRef(false);

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

  const syncVersionState = (store: ResumeVersionStore, syncResume = false) => {
    localStoreRef.current = store;
    setActiveVersionId(store.activeVersionId);
    setVersionsMeta(listVersionsMeta(store));
    setPersonsMeta(listPersonsMeta(store));
    setLocalNotice(getLocalPersistenceError() ?? '');
    if (syncResume) setResume(getActiveResume(store));
  };

  const addTombstones = (personIds: string[]) => {
    const next = Array.from(new Set([...tombstonesRef.current, ...personIds]));
    tombstonesRef.current = next;
    writeTombstones(next);
  };

  const clearTombstones = (personIds: string[]) => {
    const next = tombstonesRef.current.filter((id) => !personIds.includes(id));
    tombstonesRef.current = next;
    writeTombstones(next);
  };

  /**
   * 按人物推送。删除只来自 tombstone（用户显式删除），
   * 绝不根据「本地没有这个人物」来推断删除 —— 全新设备/未 hydrate 的本地 store 会把云端人物全删掉。
   */
  const pushStoreToCloud = async (userId: string, store: ResumeVersionStore) => {
    const tombstones = tombstonesRef.current;
    for (const personId of personIdsOf(store)) {
      if (tombstones.includes(personId)) continue;
      const slice = personSlice(store, personId);
      if (isBlankPersonSlice(slice) && cloudHasContentRef.current) continue;
      const result = await saveCloudPerson(userId, personId, sliceName(slice), slice);
      if (result.error) throw result.error;
    }

    if (tombstones.length > 0) {
      const deleted: string[] = [];
      for (const personId of tombstones) {
        const { error } = await deleteCloudPerson(userId, personId);
        if (error) throw error;
        deleted.push(personId);
      }
      clearTombstones(deleted);
    }
    cloudHasContentRef.current = true;
  };

  /** 执行登录时的合并计划：推送本地较新的/云端缺失的人物，删除已删人物与已拆解的旧结构行。 */
  const applyCloudPlan = async (userId: string, plan: CloudSyncPlan) => {
    for (const item of plan.toPush) {
      const result = await saveCloudPerson(userId, item.personId, item.name, item.slice);
      if (result.error) throw result.error;
    }

    if (plan.toDeletePersonIds.length > 0) {
      const deleted: string[] = [];
      for (const personId of plan.toDeletePersonIds) {
        const { error } = await deleteCloudPerson(userId, personId);
        if (error) throw error;
        deleted.push(personId);
      }
      clearTombstones(deleted);
    }

    if (plan.toDeleteRowIds.length > 0) {
      const { error } = await deleteCloudRows(userId, plan.toDeleteRowIds);
      if (error) throw error;
    }
    cloudHasContentRef.current = true;
  };

  const syncStoreToCloud = (store: ResumeVersionStore) => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    if (cloudBlockedRef.current) return;
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
          await pushStoreToCloud(currentUser.id, store);
          if (generation !== cloudSaveGenerationRef.current) return;
          setSaveStatus('saved');
          setCloudNotice('');
        } catch (error) {
          if (generation !== cloudSaveGenerationRef.current) return;
          if (isCloudSchemaError(error as Error)) {
            cloudBlockedRef.current = true;
            setSaveStatus('error');
            setCloudNotice(SCHEMA_NOT_MIGRATED_MESSAGE);
            return;
          }
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

    loadCloudRows(user.id).then(async (result) => {
      if (cancelled) return;
      if (result.error) {
        cloudBlockedRef.current = isCloudSchemaError(result.error);
        setCloudReady(true);
        setSaveStatus(navigator.onLine ? 'error' : 'offline');
        setCloudNotice(cloudBlockedRef.current
          ? SCHEMA_NOT_MIGRATED_MESSAGE
          : `云端读取失败：${result.error.message}。当前继续使用本地数据。`);
        return;
      }

      const rows = result.data ?? [];
      cloudHasContentRef.current = rows.length > 0;
      // 纯函数合并：云端赢 + 本地分歧存成快照 + 版本并集（幂等，重复登录不会越滚越多）。
      const plan = planCloudSync(localStore, rows, tombstonesRef.current);
      const merged = plan.store;

      if (storeContentChanged(localStore, merged)) {
        persistVersionStore(merged);
        syncVersionState(merged, true);
        setMeasureVersion((prev) => prev + 1);
      } else {
        syncVersionState(merged, false);
      }

      pendingCloudStoreRef.current = null;
      setCloudReady(true);

      try {
        await applyCloudPlan(user.id, plan);
        if (cancelled) return;
        setSaveStatus('saved');
        setCloudNotice(plan.conflicts.length > 0
          ? `云端与本地都有改动：已采用云端内容，本地那份保留为快照「云端覆盖前的本地副本」（${plan.conflicts.length} 个人物）。`
          : '');
      } catch (error) {
        if (cancelled) return;
        if (isCloudSchemaError(error as Error)) {
          cloudBlockedRef.current = true;
          setSaveStatus('error');
          setCloudNotice(SCHEMA_NOT_MIGRATED_MESSAGE);
          return;
        }
        setSaveStatus(navigator.onLine ? 'error' : 'offline');
        setCloudNotice(`云端同步失败：${error instanceof Error ? error.message : '网络请求失败'}。本地数据仍已保存。`);
      }
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

  const isOverflowing = pageFillRatio > 1.001;
  const activeVersionName = useMemo(
    () => versionsMeta.find((version) => version.id === activeVersionId)?.name || '当前草稿',
    [versionsMeta, activeVersionId]
  );
  const activePersonName = useMemo(
    () => personsMeta.find((person) => person.isActive)?.name || '',
    [personsMeta]
  );
  /** 四档字号的实际 pt —— 未单独设置的层级在这里换算成「跟随正文」的结果。 */
  const typeScale = useMemo(() => resolveResumeTypeScale(resume), [resume]);

  const handleMeasure = (naturalHeight: number, frameHeight: number) => {
    const next = frameHeight > 0 ? naturalHeight / frameHeight : 0;
    setPageFillRatio((prev) => (Math.abs(prev - next) < 0.001 ? prev : next));
  };

  /**
   * The preview sheet is always a full 210mm wide (see `a4.css`), so the panel
   * decides how much of it you can see, not how it lays out. Reported on mount
   * and on every panel resize.
   */
  const handleStageWidth = useCallback((contentWidth: number) => {
    const next = fitPreviewZoom(contentWidth);
    setFitZoom((prev) => (Math.abs(prev - next) < 0.005 ? prev : next));
  }, []);

  const zoomPreviewBy = (delta: number) => {
    setManualZoom(clampPreviewZoom(previewZoom + delta));
  };

  const handleExport = async () => {
    if (isOverflowing) {
      alert(`当前内容超出 A4 ${Math.round((pageFillRatio - 1) * 100)}%，请先精简内容或降低字号。为保证预览与 PDF 一致，本次没有自动缩小或导出。`);
      return;
    }
    await preparePrint();
    exportPdf();
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

  const handleCreatePerson = () => {
    const name = window.prompt('新人物姓名（可留空，之后在左侧“个人信息”里填写）', '');
    if (name === null) return;
    const store = createPerson(name);
    syncVersionState(store, true);
    syncStoreToCloud(store);
    setMeasureVersion((prev) => prev + 1);
  };

  const handleSelectPerson = (personId: string) => {
    if (personsMeta.find((person) => person.id === personId)?.isActive) return;
    const store = switchActivePerson(personId);
    syncVersionState(store, true);
    syncStoreToCloud(store);
    setMeasureVersion((prev) => prev + 1);
  };

  const handleDeletePerson = (personId: string) => {
    const person = personsMeta.find((item) => item.id === personId);
    if (!person) return;
    if (personsMeta.length <= 1) {
      alert('至少需要保留一个人物。');
      return;
    }
    const versionCount = versionsMeta.filter((version) => version.personId === personId).length;
    if (!window.confirm(`确认删除人物“${person.name}”及其 ${versionCount} 个版本？此操作不可撤销。`)) return;
    // 先记 tombstone 再删除：否则另一台设备下一次同步会把这个人推回云端。
    addTombstones([personId]);
    const store = deletePerson(personId);
    syncVersionState(store, true);
    syncStoreToCloud(store);
    setMeasureVersion((prev) => prev + 1);
  };

  const handleExportMarkdown = () => {
    const content = exportToMarkdown(resume);
    const filename = `${resume.personal.name || '简历'}_${new Date().toISOString().split('T')[0]}`;
    downloadMarkdown(content, filename);
  };

  const handleExportWord = async () => {
    setWordExporting(true);
    try {
      const { resumeToDocxBlob, downloadDocx, buildDocxFilename } = await import('./lib/word');
      const blob = await resumeToDocxBlob(resume);
      downloadDocx(blob, buildDocxFilename(resume));
    } catch (error) {
      console.error('导出 Word 失败:', error);
      alert(`导出 Word 失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setWordExporting(false);
    }
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

  /**
   * The canonical document the CLI reads and writes: full state (photo, font
   * size, visibility toggles) plus stable ids, as plain readable JSON.
   *
   * Ids are regenerated from content on the way out (`rewrite`) so the exported
   * file is immediately addressable by an agent — the editor's own ids are
   * random uuids. The draft in the browser is untouched; it only picks up the
   * readable ids if this file is imported back.
   */
  const handleExportJson = () => {
    const canonical = assignResumeIds(normalizeResume(resume).resume, { rewrite: true }).resume;
    const filename = `${resume.personal.name || '简历'}_${new Date().toISOString().split('T')[0]}`;
    downloadText(`${JSON.stringify(canonical, null, 2)}\n`, `${filename}.json`, 'application/json');
  };

  const handleImportJson = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const { resume: incoming, warnings } = normalizeResume(parsed);
      const { resume: withIds } = assignResumeIds(incoming);

      if (!window.confirm(`导入会整体替换当前草稿（${resume.personal.name || '未命名'}）。继续吗？`)) return;

      setResume({ ...withIds, updatedAt: new Date().toISOString() });
      setMeasureVersion((prev) => prev + 1);

      if (warnings.length > 0) {
        console.warn('导入 JSON 时修正的字段：', warnings);
        alert(`导入成功，但有 ${warnings.length} 处字段类型不对已被修正，详情见控制台。`);
        return;
      }
      alert('导入成功！');
    } catch (error) {
      alert(`导入 JSON 失败：${error instanceof Error ? error.message : '未知错误'}`);
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

  /** `pt` 为 `undefined` 表示该层级改回「跟随正文」，由正文用 em 倍率换算。 */
  const updateLevelFontSize = (level: ResumeLevelKey, pt: number | undefined) => {
    const field = LEVEL_FONT_SIZE_FIELDS[level];
    setResume((prev) => ({ ...prev, [field]: normalizeLevelFontSize(pt) }));
    setMeasureVersion((prev) => prev + 1);
  };

  const updateFontFamily = (fontFamily: ResumeFontFamily) => {
    setResume((prev) => ({ ...prev, fontFamily: normalizeResumeFontFamily(fontFamily) }));
    setMeasureVersion((prev) => prev + 1);
  };

  const updateHeaderAlignment = (headerAlignment: ResumeHeaderAlignment) => {
    setResume((prev) => ({ ...prev, headerAlignment: normalizeResumeHeaderAlignment(headerAlignment) }));
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
        onExportWord={handleExportWord}
        wordExporting={wordExporting}
        onImportMarkdown={handleImportMarkdown}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        personName={activePersonName}
        activeVersionName={activeVersionName}
        pageFillRatio={pageFillRatio}
        isOverflowing={isOverflowing}
        fontSizePt={resume.fontSizePt}
        onFontSizeChange={updateFontSize}
        typeScale={typeScale}
        onLevelFontSizeChange={updateLevelFontSize}
        fontFamily={resume.fontFamily}
        onFontFamilyChange={updateFontFamily}
        headerAlignment={resume.headerAlignment}
        onHeaderAlignmentChange={updateHeaderAlignment}
        authLoading={authLoading}
        userEmail={user?.email}
        onSignedOut={() => setUser(null)}
        saveStatus={saveStatus}
        cloudNotice={localNotice || cloudNotice}
      />

      {isOverflowing ? <p className="scale-warning no-print">内容已超出 A4，系统不会自动缩小。请先精简内容或降低字号后再导出。</p> : null}

      <main className={`workspace ${sidebarCollapsed ? 'workspace-sidebar-collapsed' : ''}`}>
        <WorkspaceSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((collapsed) => !collapsed)}
          persons={personsMeta}
          versions={versionsMeta}
          activeVersionId={activeVersionId}
          onSelectPerson={handleSelectPerson}
          onSelectVersion={handleSwitchVersion}
          onCreatePerson={handleCreatePerson}
          onDeletePerson={handleDeletePerson}
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
              <button type="button" onClick={() => zoomPreviewBy(-PREVIEW_ZOOM_STEP)} aria-label="缩小预览">−</button>
              <span title={manualZoom === null ? '按面板宽度自适应' : '手动缩放'}>
                {Math.round(previewZoom * 100)}%{manualZoom === null ? ' 自适应' : ''}
              </span>
              <button type="button" onClick={() => zoomPreviewBy(PREVIEW_ZOOM_STEP)} aria-label="放大预览">＋</button>
              <button type="button" onClick={() => setManualZoom(null)} aria-label="按面板宽度自适应">适应宽度</button>
            </div>
          </div>
          <div className="preview-viewport" style={{ '--preview-zoom': previewZoom } as CSSProperties}>
            <PreviewA4
              resume={resume}
              measureVersion={measureVersion}
              onMeasure={handleMeasure}
              onStageWidth={handleStageWidth}
            />
          </div>
        </section>
      </main>

      <VersionManagerModal
        open={versionManagerOpen}
        persons={personsMeta}
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
