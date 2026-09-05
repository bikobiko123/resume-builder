import { describe, expect, it } from 'vitest';
import { resolveCloudBootstrap, saveCloudStore } from '../lib/cloudStorage';
import { createDefaultResumeState } from '../types/resume';
import type { ResumeVersionStoreV1 } from '../lib/storage';

const createStore = (name: string): ResumeVersionStoreV1 => ({
  schemaVersion: 1,
  activeVersionId: 'draft',
  versions: [{
    id: 'draft',
    name: '当前草稿',
    kind: 'draft',
    resume: {
      ...createDefaultResumeState(),
      personal: { ...createDefaultResumeState().personal, name },
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }],
});

describe('cloud bootstrap', () => {
  it('云端无数据时上传本地版本', () => {
    const local = createStore('本地');
    const decision = resolveCloudBootstrap(local, null);
    expect(decision.store).toBe(local);
    expect(decision.shouldUploadLocal).toBe(true);
    expect(decision.hasConflict).toBe(false);
  });

  it('本地和云端都有数据时使用云端并报告冲突', () => {
    const local = createStore('本地');
    const cloud = createStore('云端');
    const decision = resolveCloudBootstrap(local, cloud);
    expect(decision.store).toBe(cloud);
    expect(decision.shouldUploadLocal).toBe(false);
    expect(decision.hasConflict).toBe(true);
  });

  it('未配置 Supabase 时云端写入返回错误但不影响本地模式', async () => {
    const result = await saveCloudStore('user-id', createStore('本地'));
    expect(result.data).toBeNull();
    expect(result.error?.message).toContain('Supabase 尚未配置');
  });
});
