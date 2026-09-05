import { beforeEach, describe, expect, it } from 'vitest';
import {
  LEGACY_STORAGE_KEY,
  VERSION_STORAGE_KEY,
  backupVersionStore,
  createSnapshotFromActive,
  getActiveResume,
  loadVersionStore,
  parseVersionStore,
  saveActiveResume,
  switchActiveVersion,
  type ResumeVersionStoreV1,
} from '../lib/storage';
import { createDefaultResumeState } from '../types/resume';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const localStorage = new MemoryStorage();
Object.defineProperty(globalThis, 'window', {
  value: { localStorage },
  configurable: true,
});

const createStore = (): ResumeVersionStoreV1 => {
  const resume = createDefaultResumeState();
  return {
    schemaVersion: 1,
    activeVersionId: 'draft-1',
    versions: [{
      id: 'draft-1',
      name: '当前草稿',
      kind: 'draft',
      resume,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }],
  };
};

describe('resume version storage', () => {
  beforeEach(() => localStorage.clear());

  it('仍可读取现有 localStorage 版本数据', () => {
    const store = createStore();
    localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(store));
    expect(loadVersionStore().activeVersionId).toBe('draft-1');
    expect(getActiveResume(loadVersionStore()).personal.name).toBe(store.versions[0].resume.personal.name);
  });

  it('会把旧版单份简历迁移为版本存储', () => {
    const legacy = createDefaultResumeState();
    legacy.personal.name = '迁移用户';
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacy));

    const store = loadVersionStore();
    expect(getActiveResume(store).personal.name).toBe('迁移用户');
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(VERSION_STORAGE_KEY)).not.toBeNull();
  });

  it('云端 JSON 与 ResumeVersionStoreV1 兼容', () => {
    const store = createStore();
    const parsed = parseVersionStore(JSON.parse(JSON.stringify(store)));
    expect(parsed?.schemaVersion).toBe(1);
    expect(parsed?.versions[0].id).toBe('draft-1');
    expect(parseVersionStore({ schemaVersion: 2 })).toBeNull();
  });

  it('迁移前会创建带时间戳的本地备份', () => {
    const key = backupVersionStore(createStore());
    expect(key).toMatch(/^resume_builder_migration_backup_\d+$/);
    expect(localStorage.getItem(key!)).not.toBeNull();
  });

  it('切换版本后保存到正确的活动版本', () => {
    localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(createStore()));
    const withSnapshot = createSnapshotFromActive('目标版本');
    const snapshot = withSnapshot.versions.find((version) => version.kind === 'snapshot')!;
    switchActiveVersion(snapshot.id);

    const edited = getActiveResume(loadVersionStore());
    edited.personal.name = '只修改快照';
    const saved = saveActiveResume(edited);

    expect(getActiveResume(saved).personal.name).toBe('只修改快照');
    expect(saved.versions.find((version) => version.kind === 'draft')?.resume.personal.name).not.toBe('只修改快照');
  });
});
