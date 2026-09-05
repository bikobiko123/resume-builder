import { createDefaultResumeState, normalizeResumeFontSize, type ResumeState } from '../types/resume';

const LEGACY_STORAGE_KEY = 'resume_builder_v2';
const VERSION_STORAGE_KEY = 'resume_builder_versions_v1';
const SCHEMA_VERSION = 1;
const DRAFT_NAME = '当前草稿';
const SNAPSHOT_LIMIT = 30;

export type ResumeVersionKind = 'draft' | 'snapshot';

export interface ResumeVersionRecord {
  id: string;
  name: string;
  kind: ResumeVersionKind;
  resume: ResumeState;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeVersionStoreV1 {
  schemaVersion: 1;
  activeVersionId: string;
  versions: ResumeVersionRecord[];
}

export interface ResumeVersionMeta {
  id: string;
  name: string;
  kind: ResumeVersionKind;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const nowIso = (): string => new Date().toISOString();

const uid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const cloneResume = (resume: ResumeState): ResumeState => {
  if (typeof structuredClone === 'function') {
    return structuredClone(resume);
  }
  return JSON.parse(JSON.stringify(resume)) as ResumeState;
};

const normalizeResume = (input: ResumeState): ResumeState => {
  const defaults = createDefaultResumeState();
  return {
    ...defaults,
    ...input,
    personal: { ...defaults.personal, ...input.personal },
    sections: input.sections || defaults.sections,
    fontSizePt: normalizeResumeFontSize(input.fontSizePt),
    showPhoto: input.showPhoto ?? false,
    showName: input.showName ?? true,
    showEmail: input.showEmail ?? true,
    showPhone: input.showPhone ?? true,
    showUrl: input.showUrl ?? true,
    showProfiles: input.showProfiles ?? true,
    showAddress: input.showAddress ?? true,
    showTitle: input.showTitle ?? true,
    showSummary: input.showSummary ?? true,
    updatedAt: input.updatedAt || nowIso(),
  };
};

const isResumeState = (value: unknown): value is ResumeState => {
  if (!isRecord(value)) return false;
  if (!isRecord(value.personal) || !Array.isArray(value.sections)) return false;
  return typeof value.updatedAt === 'string';
};

const isVersionKind = (value: unknown): value is ResumeVersionKind =>
  value === 'draft' || value === 'snapshot';

const isVersionRecord = (value: unknown): value is ResumeVersionRecord => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isVersionKind(value.kind) &&
    isResumeState(value.resume) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
};

export const isVersionStore = (value: unknown): value is ResumeVersionStoreV1 => {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== SCHEMA_VERSION) return false;
  if (typeof value.activeVersionId !== 'string' || !Array.isArray(value.versions)) return false;
  return value.versions.every(isVersionRecord);
};

let volatileStore: ResumeVersionStoreV1 | null = null;
let persistenceError: string | null = null;
export const getLocalPersistenceError = () => persistenceError;

const persistStore = (store: ResumeVersionStoreV1): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(store));
    volatileStore = null;
    persistenceError = null;
  } catch {
    // Keep editing in memory, without destroying the last durable copy.
    volatileStore = store;
    persistenceError = '浏览器存储已满或不可用。修改暂存在当前页面，请导出 Markdown 备份，暂勿关闭页面。';
  }
};

export const persistVersionStore = persistStore;

const createDraft = (resume: ResumeState): ResumeVersionRecord => {
  const timestamp = nowIso();
  return {
    id: uid(),
    name: DRAFT_NAME,
    kind: 'draft',
    resume: normalizeResume(resume),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createInitialStore = (seed?: ResumeState): ResumeVersionStoreV1 => {
  const draft = createDraft(seed ?? createDefaultResumeState());
  return {
    schemaVersion: SCHEMA_VERSION,
    activeVersionId: draft.id,
    versions: [draft],
  };
};

export const normalizeStore = (raw: ResumeVersionStoreV1): ResumeVersionStoreV1 => {
  const normalizedVersions = raw.versions.map((version) => ({
    ...version,
    resume: normalizeResume(version.resume),
    name: version.name.trim() || (version.kind === 'draft' ? DRAFT_NAME : '未命名版本'),
  }));

  let versions = normalizedVersions;
  const draft = versions.find((version) => version.kind === 'draft');
  if (!draft) {
    versions = [createDraft(createDefaultResumeState()), ...versions];
  }

  const activeExists = versions.some((version) => version.id === raw.activeVersionId);
  const fallbackActive = versions.find((version) => version.kind === 'draft')?.id ?? versions[0].id;

  return {
    schemaVersion: SCHEMA_VERSION,
    activeVersionId: activeExists ? raw.activeVersionId : fallbackActive,
    versions,
  };
};

const getActiveVersionRecord = (store: ResumeVersionStoreV1): ResumeVersionRecord => {
  return store.versions.find((version) => version.id === store.activeVersionId) ?? store.versions[0];
};

const sortVersionsForDisplay = (versions: ResumeVersionRecord[]): ResumeVersionRecord[] => {
  return versions
    .slice()
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'draft' ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
};

const pruneSnapshots = (versions: ResumeVersionRecord[]): ResumeVersionRecord[] => {
  const drafts = versions.filter((version) => version.kind === 'draft');
  const snapshots = versions
    .filter((version) => version.kind === 'snapshot')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, SNAPSHOT_LIMIT);
  return [...drafts, ...snapshots];
};

const defaultSnapshotName = (timestamp: string): string => {
  const date = new Date(timestamp);
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getDate()}`.padStart(2, '0');
  const hh = `${date.getHours()}`.padStart(2, '0');
  const mi = `${date.getMinutes()}`.padStart(2, '0');
  return `简历 ${yyyy}-${mm}-${dd} ${hh}:${mi}`;
};

export const getActiveResume = (store: ResumeVersionStoreV1): ResumeState => {
  return cloneResume(getActiveVersionRecord(store).resume);
};

export const parseVersionStore = (value: unknown): ResumeVersionStoreV1 | null => {
  if (!isVersionStore(value)) return null;
  return normalizeStore(value);
};

export const backupVersionStore = (store: ResumeVersionStoreV1): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const storage = window.localStorage;
    const serialized = JSON.stringify(store);
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
      .filter((key): key is string => Boolean(key?.startsWith('resume_builder_migration_backup_')));
    const duplicate = keys.find((key) => storage.getItem(key) === serialized);
    if (duplicate) return duplicate;
    // Never silently delete older user backups to make room.
    if (keys.length >= 2) return null;
    let timestamp = Date.now();
    while (storage.getItem(`resume_builder_migration_backup_${timestamp}`)) timestamp += 1;
    const key = `resume_builder_migration_backup_${timestamp}`;
    storage.setItem(key, serialized);
    return key;
  } catch {
    // A best-effort migration backup must never unmount the entire app.
    return null;
  }
};

export const loadVersionStore = (): ResumeVersionStoreV1 => {
  if (typeof window === 'undefined') {
    return createInitialStore();
  }

  if (volatileStore) return volatileStore;
  let rawStore: string | null = null;
  try { rawStore = window.localStorage.getItem(VERSION_STORAGE_KEY); } catch { /* private/restricted storage */ }
  if (rawStore) {
    try {
      const parsed: unknown = JSON.parse(rawStore);
      if (isVersionStore(parsed)) {
        return normalizeStore(parsed);
      }
    } catch {
      // Fall through and try migration path.
    }
  }

  let rawLegacy: string | null = null;
  try { rawLegacy = window.localStorage.getItem(LEGACY_STORAGE_KEY); } catch { /* restricted storage */ }
  let initial = createInitialStore();
  if (rawLegacy) {
    try {
      const parsedLegacy: unknown = JSON.parse(rawLegacy);
      if (isResumeState(parsedLegacy)) {
        initial = createInitialStore(parsedLegacy);
      }
    } catch {
      initial = createInitialStore();
    }
  }

  persistStore(initial);
  if (!persistenceError) window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  return initial;
};

export const listVersionsMeta = (store = loadVersionStore()): ResumeVersionMeta[] => {
  return sortVersionsForDisplay(store.versions).map((version) => ({
    id: version.id,
    name: version.name,
    kind: version.kind,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
    isActive: version.id === store.activeVersionId,
  }));
};

export const saveActiveResume = (resume: ResumeState): ResumeVersionStoreV1 => {
  const store = loadVersionStore();
  const active = getActiveVersionRecord(store);
  const timestamp = nowIso();

  const versions = store.versions.map((version) =>
    version.id === active.id
      ? {
          ...version,
          resume: normalizeResume({ ...resume, updatedAt: timestamp }),
          updatedAt: timestamp,
        }
      : version
  );

  const nextStore: ResumeVersionStoreV1 = {
    ...store,
    versions,
  };
  persistStore(nextStore);
  return nextStore;
};

export const createSnapshotFromActive = (name?: string): ResumeVersionStoreV1 => {
  const store = loadVersionStore();
  const active = getActiveVersionRecord(store);
  const timestamp = nowIso();

  const snapshot: ResumeVersionRecord = {
    id: uid(),
    name: name?.trim() || defaultSnapshotName(timestamp),
    kind: 'snapshot',
    resume: cloneResume(active.resume),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const nextStore: ResumeVersionStoreV1 = {
    ...store,
    versions: pruneSnapshots([...store.versions, snapshot]),
  };

  persistStore(nextStore);
  return nextStore;
};

export const switchActiveVersion = (versionId: string): ResumeVersionStoreV1 => {
  const store = loadVersionStore();
  const exists = store.versions.some((version) => version.id === versionId);
  if (!exists || store.activeVersionId === versionId) return store;

  const nextStore: ResumeVersionStoreV1 = {
    ...store,
    activeVersionId: versionId,
  };
  persistStore(nextStore);
  return nextStore;
};

export const renameVersion = (versionId: string, name: string): ResumeVersionStoreV1 => {
  const trimmed = name.trim();
  if (!trimmed) return loadVersionStore();

  const store = loadVersionStore();
  const timestamp = nowIso();
  const versions = store.versions.map((version) =>
    version.id === versionId ? { ...version, name: trimmed, updatedAt: timestamp } : version
  );
  const nextStore: ResumeVersionStoreV1 = { ...store, versions };
  persistStore(nextStore);
  return nextStore;
};

export const deleteVersion = (versionId: string): ResumeVersionStoreV1 => {
  const store = loadVersionStore();
  const target = store.versions.find((version) => version.id === versionId);
  if (!target || target.kind === 'draft') return store;

  const versions = store.versions.filter((version) => version.id !== versionId);
  const draftId = versions.find((version) => version.kind === 'draft')?.id ?? versions[0]?.id;
  const activeVersionId = store.activeVersionId === versionId ? draftId : store.activeVersionId;

  const nextStore: ResumeVersionStoreV1 = {
    ...store,
    activeVersionId,
    versions,
  };
  persistStore(nextStore);
  return nextStore;
};

export const resetActiveToTemplate = (): ResumeVersionStoreV1 => {
  const store = loadVersionStore();
  const active = getActiveVersionRecord(store);
  const timestamp = nowIso();

  const versions = store.versions.map((version) =>
    version.id === active.id
      ? {
          ...version,
          resume: createDefaultResumeState(),
          updatedAt: timestamp,
        }
      : version
  );

  const nextStore: ResumeVersionStoreV1 = {
    ...store,
    versions,
  };
  persistStore(nextStore);
  return nextStore;
};

// Backward-compatible exports for existing callers.
export const loadResume = (): ResumeState => getActiveResume(loadVersionStore());
export const saveResume = (state: ResumeState): void => {
  saveActiveResume(state);
};
export const resetResume = (): void => {
  resetActiveToTemplate();
};

export { LEGACY_STORAGE_KEY, VERSION_STORAGE_KEY, SNAPSHOT_LIMIT };
