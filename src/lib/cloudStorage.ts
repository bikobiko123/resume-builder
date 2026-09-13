import {
  assembleStore,
  isBlankPersonSlice,
  mergePersonSlice,
  parseVersionStore,
  personIdsOf,
  personSlice,
  personSliceSignature,
  rekeyPersonSlice,
  type ResumeVersionStore,
} from './storage';
import { supabase } from './supabase';

export interface CloudStorageResult<T> {
  data: T | null;
  error: Error | null;
}

/** 云端表结构还没迁移（缺 person_id 或仍是 user_id 唯一）——重试无意义，应阻断同步。 */
export class CloudSchemaError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'CloudSchemaError';
    this.code = code;
  }
}

const SCHEMA_ERROR_CODES = new Set(['42703', '23505', '42P10']);

export const SCHEMA_NOT_MIGRATED_MESSAGE =
  '云端表还是旧结构（缺 person_id 列，或仍是 user_id 唯一索引）。请在 Supabase SQL Editor 执行 SUPABASE.md 里的迁移 SQL，然后刷新页面。云同步已暂停，本地数据不受影响。';

/** 把 Supabase/PostgREST 的错误归一化；表结构未迁移的错误码转成 CloudSchemaError。 */
export const toCloudError = (error: unknown): Error => {
  if (error && typeof error === 'object') {
    const record = error as { message?: string; code?: string };
    if (typeof record.code === 'string' && SCHEMA_ERROR_CODES.has(record.code)) {
      return new CloudSchemaError(SCHEMA_NOT_MIGRATED_MESSAGE, record.code);
    }
    if (typeof record.message === 'string') return new Error(record.message);
  }
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);
  return new Error('云端存储请求失败');
};

/** 云端一行。`personId` 为空表示旧结构遗留行（整库一个 blob）。 */
export interface CloudRow {
  id: string;
  personId: string | null;
  name: string;
  store: ResumeVersionStore | null;
  updatedAt: string;
}

export interface CloudPushItem {
  personId: string;
  name: string;
  slice: ResumeVersionStore;
}

export interface CloudSyncPlan {
  store: ResumeVersionStore;
  toPush: CloudPushItem[];
  /** 需要删除的人物行（本地已删，靠 tombstone 记录）。 */
  toDeletePersonIds: string[];
  /** 需要删除的旧结构行 id（已拆成人物的 legacy 行）。 */
  toDeleteRowIds: string[];
  /** 内容不同、按「云端赢 + 本地存成快照」处理的人物。 */
  conflicts: string[];
}

/** 云端切片里的人物名；拿不到就退回行名，再退回空串。 */
const sliceNameOf = (slice: ResumeVersionStore, fallback: string): string => {
  const draft = slice.versions.find((version) => version.kind === 'draft');
  const name = draft?.resume.personal.name?.trim();
  return name || fallback || '';
};

/**
 * 纯函数：把云端各行与本地 store 合成一份新 store，并给出需要写回/删除的内容。
 * 不做任何 I/O，便于单测覆盖四象限与幂等性。
 */
export const planCloudSync = (
  localStore: ResumeVersionStore,
  rows: CloudRow[],
  tombstones: string[] = [],
): CloudSyncPlan => {
  const localPersonIds = personIdsOf(localStore);
  const localVersionIds = new Map<string, Set<string>>(
    localPersonIds.map((personId) => [
      personId,
      new Set(localStore.versions.filter((version) => version.personId === personId).map((version) => version.id)),
    ]),
  );

  const cloudSlices = new Map<string, ResumeVersionStore>();
  const cloudRowIdsByPerson = new Map<string, string[]>();
  const deleteRowIds: string[] = [];

  /** 用版本 id 交集把云端人物对齐到本地已有的人物 id（旧版随机迁移过的情况）。 */
  const canonicalPersonId = (cloudPersonId: string, slice: ResumeVersionStore): string => {
    if (localPersonIds.includes(cloudPersonId)) return cloudPersonId;
    const cloudIds = slice.versions.map((version) => version.id);
    const matched = localPersonIds.find((personId) => {
      const owned = localVersionIds.get(personId);
      return owned ? cloudIds.some((id) => owned.has(id)) : false;
    });
    return matched ?? cloudPersonId;
  };

  rows.forEach((row) => {
    if (!row.store) {
      if (row.personId === null) deleteRowIds.push(row.id);
      return;
    }
    const personIds = personIdsOf(row.store);
    if (row.personId === null) {
      // 旧结构行：可能只有一个 store（v1），也可能是迁移窗口内写入的 v2 多人物 store，全部展开。
      personIds.forEach((personId) => {
        const slice = personSlice(row.store as ResumeVersionStore, personId);
        const target = canonicalPersonId(personId, slice);
        cloudSlices.set(target, rekeyPersonSlice(slice, target));
        cloudRowIdsByPerson.set(target, [...(cloudRowIdsByPerson.get(target) ?? []), row.id]);
      });
      deleteRowIds.push(row.id);
      return;
    }

    const slice = personSlice(row.store, row.personId);
    const target = canonicalPersonId(row.personId, slice);
    cloudSlices.set(target, rekeyPersonSlice(slice, target));
    cloudRowIdsByPerson.set(target, [...(cloudRowIdsByPerson.get(target) ?? []), row.id]);
    if (target !== row.personId) deleteRowIds.push(row.id);
  });

  // tombstone 优先：本地已删除的人物，云端行也要删掉，并且不能被云端「复活」。
  const tombstoned = Array.from(new Set(tombstones));
  const toDeletePersonIds = tombstoned.filter(
    (personId) => cloudSlices.has(personId) || localPersonIds.includes(personId),
  );
  const suppressed = new Set(tombstoned);

  const cloudHasContent = cloudSlices.size > 0;
  const slices: ResumeVersionStore[] = [];
  const toPush: CloudPushItem[] = [];
  const conflicts: string[] = [];

  const allPersonIds = Array.from(new Set([...localPersonIds, ...cloudSlices.keys()])).sort();
  allPersonIds.forEach((personId) => {
    if (suppressed.has(personId)) return;
    const cloudSlice = cloudSlices.get(personId) ?? null;
    const localSlice = localPersonIds.includes(personId) ? personSlice(localStore, personId) : null;

    if (cloudSlice && localSlice) {
      const merged = mergePersonSlice(personId, cloudSlice, localSlice);
      if (merged.conflict) conflicts.push(personId);
      slices.push(merged.slice);
      if (personSliceSignature(merged.slice) !== personSliceSignature(cloudSlice)) {
        toPush.push({ personId, name: sliceNameOf(merged.slice, ''), slice: merged.slice });
      }
      return;
    }

    if (cloudSlice) {
      // 只存在于云端：直接采用。绝不因为「本地没有」而删除。
      slices.push(cloudSlice);
      return;
    }

    if (!localSlice) return;
    // 只存在于本地：整台设备全新时会把空白人物也当成「新人物」，别让它占一行云端文档。
    if (isBlankPersonSlice(localSlice) && cloudHasContent) return;
    slices.push(localSlice);
    toPush.push({ personId, name: sliceNameOf(localSlice, ''), slice: localSlice });
  });

  const store = assembleStore(slices, localStore.activeVersionId);
  return { store, toPush, toDeletePersonIds, toDeleteRowIds: deleteRowIds, conflicts };
};

export const loadCloudRows = async (userId: string): Promise<CloudStorageResult<CloudRow[]>> => {
  if (!supabase) return { data: null, error: new Error('Supabase 尚未配置') };

  const { data, error } = await supabase
    .from('resume_documents')
    .select('id,person_id,name,data,updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: true });

  if (error) return { data: null, error: toCloudError(error) };
  if (!data) return { data: [], error: null };

  const rows: CloudRow[] = data.map((row) => ({
    id: String(row.id),
    personId: typeof row.person_id === 'string' && row.person_id ? row.person_id : null,
    name: typeof row.name === 'string' ? row.name : '',
    store: parseVersionStore(row.data),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : '',
  }));

  return { data: rows, error: null };
};

export const saveCloudPerson = async (
  userId: string,
  personId: string,
  name: string,
  slice: ResumeVersionStore,
): Promise<CloudStorageResult<null>> => {
  if (!supabase) return { data: null, error: new Error('Supabase 尚未配置') };

  const { error } = await supabase
    .from('resume_documents')
    .upsert(
      {
        user_id: userId,
        person_id: personId,
        name: name || '未命名人物',
        data: slice,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,person_id' },
    );

  return error ? { data: null, error: toCloudError(error) } : { data: null, error: null };
};

export const deleteCloudPerson = async (
  userId: string,
  personId: string,
): Promise<{ error: Error | null }> => {
  if (!supabase) return { error: new Error('Supabase 尚未配置') };

  const { error } = await supabase
    .from('resume_documents')
    .delete()
    .eq('user_id', userId)
    .eq('person_id', personId);

  return { error: error ? toCloudError(error) : null };
};

/** 删除旧结构行；必须带 person_id is null，否则会误删刚写好的新行。 */
export const deleteCloudRows = async (
  userId: string,
  rowIds: string[],
): Promise<{ error: Error | null }> => {
  if (!supabase) return { error: new Error('Supabase 尚未配置') };
  if (rowIds.length === 0) return { error: null };

  const { error } = await supabase
    .from('resume_documents')
    .delete()
    .eq('user_id', userId)
    .in('id', rowIds);

  return { error: error ? toCloudError(error) : null };
};

export const isCloudSchemaError = (error: Error | null | undefined): boolean =>
  error instanceof CloudSchemaError || Boolean(error && (error as { code?: string }).code && SCHEMA_ERROR_CODES.has((error as { code?: string }).code as string));
