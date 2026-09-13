import { parseVersionStore, storeContentSignature, type ResumeVersionStore } from './storage';
import { supabase } from './supabase';

export interface CloudStorageResult<T> {
  data: T | null;
  error: Error | null;
}

export interface CloudBootstrapDecision {
  store: ResumeVersionStore;
  shouldUploadLocal: boolean;
  hasConflict: boolean;
}

export const resolveCloudBootstrap = (
  localStore: ResumeVersionStore,
  cloudStore: ResumeVersionStore | null,
): CloudBootstrapDecision => {
  if (!cloudStore) {
    return { store: localStore, shouldUploadLocal: true, hasConflict: false };
  }
  return {
    store: cloudStore,
    shouldUploadLocal: false,
    hasConflict: storeContentSignature(localStore) !== storeContentSignature(cloudStore),
  };
};

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(typeof error === 'string' ? error : '云端存储请求失败');

export const loadCloudStore = async (userId: string): Promise<CloudStorageResult<ResumeVersionStore>> => {
  if (!supabase) return { data: null, error: new Error('Supabase 尚未配置') };

  const { data, error } = await supabase
    .from('resume_documents')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { data: null, error: toError(error) };
  if (!data) return { data: null, error: null };

  const store = parseVersionStore(data.data);
  return store
    ? { data: store, error: null }
    : { data: null, error: new Error('云端简历数据格式无法识别') };
};

export const saveCloudStore = async (
  userId: string,
  store: ResumeVersionStore,
): Promise<CloudStorageResult<ResumeVersionStore>> => {
  if (!supabase) return { data: null, error: new Error('Supabase 尚未配置') };

  const { data, error } = await supabase
    .from('resume_documents')
    .upsert(
      {
        user_id: userId,
        name: '我的简历',
        data: store,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('data')
    .maybeSingle();

  if (error) return { data: null, error: toError(error) };
  return { data: data ? parseVersionStore(data.data) : store, error: null };
};

export const deleteCloudStore = async (userId: string): Promise<{ error: Error | null }> => {
  if (!supabase) return { error: new Error('Supabase 尚未配置') };

  const { error } = await supabase.from('resume_documents').delete().eq('user_id', userId);
  return { error: error ? toError(error) : null };
};
