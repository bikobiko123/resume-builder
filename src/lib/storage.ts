import { createBlankResumeState, createDefaultResumeState, normalizeResumeFontSize, type ResumeState } from '../types/resume';

const LEGACY_STORAGE_KEY = 'resume_builder_v2';
const VERSION_STORAGE_KEY = 'resume_builder_versions_v1';
const SCHEMA_VERSION = 2;
const LEGACY_SCHEMA_VERSION = 1;
const DRAFT_NAME = '当前草稿';
// 每个人物的快照上限。
const SNAPSHOT_LIMIT = 30;
const UNNAMED_PERSON = '未命名人物';

export type ResumeVersionKind = 'draft' | 'snapshot';

export interface ResumeVersionRecord {
  id: string;
  // 版本归属的人物。人物本身只通过这个字段分组，不单独存储。
  personId: string;
  name: string;
  kind: ResumeVersionKind;
  resume: ResumeState;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeVersionStore {
  schemaVersion: typeof SCHEMA_VERSION;
  activeVersionId: string;
  versions: ResumeVersionRecord[];
}

/** v1 存量数据形状：没有人物分组，仅在迁移时读取。 */
export interface ResumeVersionStoreV1 {
  schemaVersion: typeof LEGACY_SCHEMA_VERSION;
  activeVersionId: string;
  versions: Array<Omit<ResumeVersionRecord, 'personId'>>;
}

export interface ResumeVersionMeta {
  id: string;
  personId: string;
  name: string;
  kind: ResumeVersionKind;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface ResumePersonMeta {
  id: string;
  name: string;
  snapshotCount: number;
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

const isVersionRecordShape = (value: unknown): value is Omit<ResumeVersionRecord, 'personId'> => {
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

const isVersionRecord = (value: unknown): value is ResumeVersionRecord =>
  isVersionRecordShape(value) && typeof (value as Record<string, unknown>).personId === 'string';

export const isVersionStore = (value: unknown): value is ResumeVersionStore => {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== SCHEMA_VERSION) return false;
  if (typeof value.activeVersionId !== 'string' || !Array.isArray(value.versions)) return false;
  return value.versions.every(isVersionRecord);
};

export const isLegacyVersionStore = (value: unknown): value is ResumeVersionStoreV1 => {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== LEGACY_SCHEMA_VERSION) return false;
  if (typeof value.activeVersionId !== 'string' || !Array.isArray(value.versions)) return false;
  return value.versions.every(isVersionRecordShape);
};

let volatileStore: ResumeVersionStore | null = null;
let persistenceError: string | null = null;
export const getLocalPersistenceError = () => persistenceError;

const persistStore = (store: ResumeVersionStore): void => {
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

const createDraft = (resume: ResumeState, personId: string): ResumeVersionRecord => {
  const timestamp = nowIso();
  return {
    id: uid(),
    personId,
    name: DRAFT_NAME,
    kind: 'draft',
    resume: normalizeResume(resume),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createInitialStore = (seed?: ResumeState): ResumeVersionStore => {
  const draft = createDraft(seed ?? createDefaultResumeState(), uid());
  return {
    schemaVersion: SCHEMA_VERSION,
    activeVersionId: draft.id,
    versions: [draft],
  };
};

const draftOfPerson = (
  versions: ResumeVersionRecord[],
  personId: string,
): ResumeVersionRecord | undefined =>
  versions.find((version) => version.personId === personId && version.kind === 'draft');

const personNameOf = (versions: ResumeVersionRecord[], personId: string): string => {
  const name = draftOfPerson(versions, personId)?.resume.personal.name?.trim();
  return name || UNNAMED_PERSON;
};

export const normalizeStore = (raw: ResumeVersionStore): ResumeVersionStore => {
  const normalizedVersions: ResumeVersionRecord[] = raw.versions.map((version) => ({
    ...version,
    resume: normalizeResume(version.resume),
    name: version.name.trim() || (version.kind === 'draft' ? DRAFT_NAME : '未命名版本'),
  }));

  let versions = normalizedVersions.length > 0
    ? normalizedVersions
    : [createDraft(createDefaultResumeState(), uid())];

  // 每个人物都必须有一份可编辑草稿；缺失时用该人物最近的内容补一份。
  const personIds = Array.from(new Set(versions.map((version) => version.personId)));
  const repaired = personIds.flatMap((personId) => {
    if (draftOfPerson(versions, personId)) return [];
    const owned = versions
      .filter((version) => version.personId === personId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return [createDraft(owned[0].resume, personId)];
  });
  if (repaired.length > 0) versions = [...versions, ...repaired];

  const activeExists = versions.some((version) => version.id === raw.activeVersionId);
  const fallbackActive = versions.find((version) => version.kind === 'draft')?.id ?? versions[0].id;

  return {
    schemaVersion: SCHEMA_VERSION,
    activeVersionId: activeExists ? raw.activeVersionId : fallbackActive,
    versions,
  };
};

/** v1 单人物数据迁移为 v2：所有旧版本归入同一个人物。 */
export const migrateLegacyStore = (legacy: ResumeVersionStoreV1): ResumeVersionStore => {
  const personId = uid();
  return normalizeStore({
    schemaVersion: SCHEMA_VERSION,
    activeVersionId: legacy.activeVersionId,
    versions: legacy.versions.map((version) => ({ ...version, personId })),
  });
};

const getActiveVersionRecord = (store: ResumeVersionStore): ResumeVersionRecord => {
  return store.versions.find((version) => version.id === store.activeVersionId) ?? store.versions[0];
};

export const getActivePersonId = (store: ResumeVersionStore): string =>
  getActiveVersionRecord(store).personId;

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
  const snapshotsByPerson = new Map<string, ResumeVersionRecord[]>();
  versions.filter((version) => version.kind === 'snapshot').forEach((version) => {
    snapshotsByPerson.set(version.personId, [...(snapshotsByPerson.get(version.personId) ?? []), version]);
  });
  const kept = Array.from(snapshotsByPerson.values()).flatMap((owned) =>
    owned
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, SNAPSHOT_LIMIT)
  );
  return [...drafts, ...kept];
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

export const getActiveResume = (store: ResumeVersionStore): ResumeState => {
  return cloneResume(getActiveVersionRecord(store).resume);
};

/** 接受 v2 数据或需要迁移的 v1 数据，其余一律拒绝。 */
export const parseVersionStore = (value: unknown): ResumeVersionStore | null => {
  if (isVersionStore(value)) return normalizeStore(value);
  if (isLegacyVersionStore(value)) return migrateLegacyStore(value);
  return null;
};

const BACKUP_KEY_PREFIX = 'resume_builder_migration_backup_';

const writeBackup = (serialized: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const storage = window.localStorage;
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
      .filter((key): key is string => Boolean(key?.startsWith(BACKUP_KEY_PREFIX)));
    const duplicate = keys.find((key) => storage.getItem(key) === serialized);
    if (duplicate) return duplicate;
    // Never silently delete older user backups to make room.
    if (keys.length >= 2) return null;
    let timestamp = Date.now();
    while (storage.getItem(`${BACKUP_KEY_PREFIX}${timestamp}`)) timestamp += 1;
    const key = `${BACKUP_KEY_PREFIX}${timestamp}`;
    storage.setItem(key, serialized);
    return key;
  } catch {
    // A best-effort migration backup must never unmount the entire app.
    return null;
  }
};

export const backupVersionStore = (store: ResumeVersionStore): string | null =>
  writeBackup(JSON.stringify(store));

export const loadVersionStore = (): ResumeVersionStore => {
  if (typeof window === 'undefined') {
    return createInitialStore();
  }

  if (volatileStore) return volatileStore;
  let rawStore: string | null = null;
  try { rawStore = window.localStorage.getItem(VERSION_STORAGE_KEY); } catch { /* private/restricted storage */ }
  if (rawStore) {
    let parsed: unknown = null;
    try { parsed = JSON.parse(rawStore); } catch { parsed = null; }
    const store = parseVersionStore(parsed);
    if (store) {
      // 迁移过的 v1 数据立刻回写，避免每次加载都重新迁移；
      // 回写前先留一份原始 v1 备份，备份不成功就保留磁盘上的旧数据。
      if (!isVersionStore(parsed) && writeBackup(rawStore)) persistStore(store);
      return store;
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
    personId: version.personId,
    name: version.name,
    kind: version.kind,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
    isActive: version.id === store.activeVersionId,
  }));
};

export const listPersonsMeta = (store = loadVersionStore()): ResumePersonMeta[] => {
  const activePersonId = getActivePersonId(store);
  const personIds = Array.from(new Set(store.versions.map((version) => version.personId)));

  return personIds
    .map((personId) => {
      const owned = store.versions.filter((version) => version.personId === personId);
      const draft = draftOfPerson(store.versions, personId);
      return {
        id: personId,
        name: personNameOf(store.versions, personId),
        snapshotCount: owned.filter((version) => version.kind === 'snapshot').length,
        isActive: personId === activePersonId,
        // 只用于排序：老人物在前，列表顺序不会因为编辑而跳动。
        createdAt: draft?.createdAt ?? owned[0]?.createdAt ?? '',
      };
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map(({ id, name, snapshotCount, isActive }) => ({ id, name, snapshotCount, isActive }));
};

export const saveActiveResume = (resume: ResumeState): ResumeVersionStore => {
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

  const nextStore: ResumeVersionStore = {
    ...store,
    versions,
  };
  persistStore(nextStore);
  return nextStore;
};

export const createSnapshotFromActive = (name?: string): ResumeVersionStore => {
  const store = loadVersionStore();
  const active = getActiveVersionRecord(store);
  const timestamp = nowIso();

  const snapshot: ResumeVersionRecord = {
    id: uid(),
    personId: active.personId,
    name: name?.trim() || defaultSnapshotName(timestamp),
    kind: 'snapshot',
    resume: cloneResume(active.resume),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const nextStore: ResumeVersionStore = {
    ...store,
    versions: pruneSnapshots([...store.versions, snapshot]),
  };

  persistStore(nextStore);
  return nextStore;
};

/** 新建一个人物，并立刻切换到他的空白草稿。 */
export const createPerson = (name = ''): ResumeVersionStore => {
  const store = loadVersionStore();
  const draft = createDraft(createBlankResumeState(name.trim()), uid());

  const nextStore: ResumeVersionStore = {
    ...store,
    activeVersionId: draft.id,
    versions: [...store.versions, draft],
  };

  persistStore(nextStore);
  return nextStore;
};

/** 切换到某个人物的草稿（快照请在版本列表里单独选）。 */
export const switchActivePerson = (personId: string): ResumeVersionStore => {
  const store = loadVersionStore();
  const draft = draftOfPerson(store.versions, personId);
  if (!draft || store.activeVersionId === draft.id) return store;

  const nextStore: ResumeVersionStore = { ...store, activeVersionId: draft.id };
  persistStore(nextStore);
  return nextStore;
};

/** 删除人物及其全部版本；始终保留至少一个人物。 */
export const deletePerson = (personId: string): ResumeVersionStore => {
  const store = loadVersionStore();
  const remaining = store.versions.filter((version) => version.personId !== personId);
  if (remaining.length === 0 || remaining.length === store.versions.length) return store;

  const activeStillExists = remaining.some((version) => version.id === store.activeVersionId);
  const fallback = remaining.find((version) => version.kind === 'draft') ?? remaining[0];

  const nextStore: ResumeVersionStore = {
    ...store,
    activeVersionId: activeStillExists ? store.activeVersionId : fallback.id,
    versions: remaining,
  };
  persistStore(nextStore);
  return nextStore;
};

export const switchActiveVersion = (versionId: string): ResumeVersionStore => {
  const store = loadVersionStore();
  const exists = store.versions.some((version) => version.id === versionId);
  if (!exists || store.activeVersionId === versionId) return store;

  const nextStore: ResumeVersionStore = {
    ...store,
    activeVersionId: versionId,
  };
  persistStore(nextStore);
  return nextStore;
};

export const renameVersion = (versionId: string, name: string): ResumeVersionStore => {
  const trimmed = name.trim();
  if (!trimmed) return loadVersionStore();

  const store = loadVersionStore();
  const timestamp = nowIso();
  const versions = store.versions.map((version) =>
    version.id === versionId ? { ...version, name: trimmed, updatedAt: timestamp } : version
  );
  const nextStore: ResumeVersionStore = { ...store, versions };
  persistStore(nextStore);
  return nextStore;
};

export const deleteVersion = (versionId: string): ResumeVersionStore => {
  const store = loadVersionStore();
  const target = store.versions.find((version) => version.id === versionId);
  if (!target || target.kind === 'draft') return store;

  const versions = store.versions.filter((version) => version.id !== versionId);
  const fallbackId = draftOfPerson(versions, target.personId)?.id
    ?? versions.find((version) => version.kind === 'draft')?.id
    ?? versions[0]?.id;
  const activeVersionId = store.activeVersionId === versionId ? fallbackId : store.activeVersionId;

  const nextStore: ResumeVersionStore = {
    ...store,
    activeVersionId,
    versions,
  };
  persistStore(nextStore);
  return nextStore;
};

export const resetActiveToTemplate = (): ResumeVersionStore => {
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

  const nextStore: ResumeVersionStore = {
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
