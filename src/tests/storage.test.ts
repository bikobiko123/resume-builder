import { beforeEach, describe, expect, it } from 'vitest';
import {
  LEGACY_STORAGE_KEY,
  VERSION_STORAGE_KEY,
  backupVersionStore,
  createPerson,
  createSnapshotFromActive,
  deletePerson,
  deterministicLegacyPersonId,
  getActiveResume,
  insertSnapshotForPerson,
  listPersonsMeta,
  listVersionsMeta,
  loadVersionStore,
  parseVersionStore,
  personSlice,
  saveActiveResume,
  switchActivePerson,
  switchActiveVersion,
  type ResumeVersionStore,
  type ResumeVersionStoreV1,
} from '../lib/storage';
import { createDefaultResumeState, MAX_LEVEL_FONT_SIZE_PT } from '../types/resume';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

class QuotaStorage extends MemoryStorage {
  setItem() { throw new DOMException('quota exceeded', 'QuotaExceededError'); }
}

const localStorage = new MemoryStorage();
Object.defineProperty(globalThis, 'window', {
  value: { localStorage },
  configurable: true,
});

/** v1 存量数据：没有人物分组。 */
const createLegacyStore = (): ResumeVersionStoreV1 => {
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

const createStore = (): ResumeVersionStore => ({
  schemaVersion: 2,
  activeVersionId: 'draft-1',
  versions: [{
    id: 'draft-1',
    personId: 'person-1',
    name: '当前草稿',
    kind: 'draft',
    resume: createDefaultResumeState(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }],
});

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
    expect(store.schemaVersion).toBe(2);
    expect(listPersonsMeta(store)).toHaveLength(1);
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(VERSION_STORAGE_KEY)).not.toBeNull();
  });

  it('云端 JSON 与 ResumeVersionStoreV1 兼容', () => {
    const store = createStore();
    const parsed = parseVersionStore(JSON.parse(JSON.stringify(store)));
    expect(parsed?.schemaVersion).toBe(2);
    expect(parsed?.versions[0].id).toBe('draft-1');
    expect(parseVersionStore({ schemaVersion: 9 })).toBeNull();
  });

  it('把 v1 单人物数据迁移成一个人物，且版本不丢', () => {
    const legacy = createLegacyStore();
    localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(legacy));

    const migrated = loadVersionStore();
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.activeVersionId).toBe('draft-1');
    expect(migrated.versions).toHaveLength(1);
    expect(typeof migrated.versions[0].personId).toBe('string');
    // 迁移结果会立刻回写成 v2，避免每次加载重复迁移。
    expect(JSON.parse(localStorage.getItem(VERSION_STORAGE_KEY)!).schemaVersion).toBe(2);
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

  it('备份失败时不会抛出异常导致应用崩溃', () => {
    Object.defineProperty(globalThis, 'window', { value: { localStorage: new QuotaStorage() }, configurable: true });
    expect(() => backupVersionStore(createStore())).not.toThrow();
    Object.defineProperty(globalThis, 'window', { value: { localStorage }, configurable: true });
  });

  it('迁移备份写不进去时，磁盘上仍保留 v1 原始数据', () => {
    const legacyJson = JSON.stringify(createLegacyStore());
    const readOnlyStorage: Storage = {
      length: 1,
      clear() {},
      getItem: (key) => (key === VERSION_STORAGE_KEY ? legacyJson : null),
      key: (index) => (index === 0 ? VERSION_STORAGE_KEY : null),
      removeItem() {},
      setItem() { throw new DOMException('quota exceeded', 'QuotaExceededError'); },
    };

    Object.defineProperty(globalThis, 'window', { value: { localStorage: readOnlyStorage }, configurable: true });
    try {
      // 内存里已经是可用的 v2，但磁盘上的 v1 没有被覆盖。
      expect(loadVersionStore().schemaVersion).toBe(2);
      expect(readOnlyStorage.getItem(VERSION_STORAGE_KEY)).toBe(legacyJson);
    } finally {
      Object.defineProperty(globalThis, 'window', { value: { localStorage }, configurable: true });
    }
  });
});

describe('多人物工作区', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(createStore()));
  });

  it('新建人物会追加一个空白草稿并立刻切换过去', () => {
    const store = createPerson('杨泰沣');

    expect(store.versions).toHaveLength(2);
    expect(store.activeVersionId).not.toBe('draft-1');

    const active = getActiveResume(store);
    expect(active.personal.name).toBe('杨泰沣');
    expect(active.sections).toHaveLength(0);
    // 原人物不受影响。
    expect(store.versions[0].personId).toBe('person-1');

    const persons = listPersonsMeta(store);
    expect(persons).toHaveLength(2);
    expect(persons.map((person) => person.name)).toContain('杨泰沣');
    expect(persons.find((person) => person.isActive)?.name).toBe('杨泰沣');
  });

  it('人物名取自各自草稿里的姓名，编辑姓名不会串到别的人物', () => {
    const store = createPerson('杨泰沣');
    const edited = getActiveResume(store);
    edited.personal.name = '杨泰沣（改）';
    const saved = saveActiveResume(edited);

    const names = listPersonsMeta(saved).map((person) => person.name);
    expect(names).toContain('杨泰沣（改）');
    expect(names.filter((name) => name === '杨泰沣')).toHaveLength(0);
  });

  it('切换人物回到各自的草稿', () => {
    const withPerson = createPerson('杨泰沣');
    const firstPersonId = withPerson.versions[0].personId;

    const back = switchActivePerson(firstPersonId);
    expect(getActiveResume(back).personal.name).toBe(withPerson.versions[0].resume.personal.name);

    const persons = listPersonsMeta(back);
    expect(persons.find((person) => person.id === firstPersonId)?.isActive).toBe(true);
  });

  it('快照归属创建它的人物', () => {
    const withPerson = createPerson('杨泰沣');
    const withSnapshot = createSnapshotFromActive('杨泰沣 v1');
    const snapshot = withSnapshot.versions.find((version) => version.kind === 'snapshot')!;

    expect(snapshot.personId).toBe(getActiveResumePersonId(withPerson));
    expect(listPersonsMeta(withSnapshot).find((person) => person.name === '杨泰沣')?.snapshotCount).toBe(1);
    expect(listVersionsMeta(withSnapshot).find((version) => version.id === snapshot.id)?.personId)
      .toBe(snapshot.personId);
  });

  it('删除人物会带走他的全部版本，并落到剩下的草稿上', () => {
    const withPerson = createPerson('杨泰沣');
    const target = listPersonsMeta(withPerson).find((person) => person.name === '杨泰沣')!;

    const after = deletePerson(target.id);
    expect(after.versions).toHaveLength(1);
    expect(listPersonsMeta(after)).toHaveLength(1);
    expect(after.activeVersionId).toBe('draft-1');
  });

  it('不会删掉最后一个人物', () => {
    const store = deletePerson('person-1');
    expect(store.versions).toHaveLength(1);
    expect(listPersonsMeta(store)).toHaveLength(1);
  });
});

describe('云端同步依赖的存储行为', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(createStore()));
  });

  it('v1 迁移出的人物 id 由内容派生，重复迁移结果一致', () => {
    const legacy = createLegacyStore();

    expect(deterministicLegacyPersonId(legacy)).toBe(deterministicLegacyPersonId(JSON.parse(JSON.stringify(legacy))));
    expect(parseVersionStore(legacy)?.versions[0].personId).toBe(deterministicLegacyPersonId(legacy));
  });

  it('内容没变时 saveActiveResume 不刷新 updatedAt', () => {
    const before = loadVersionStore();
    const after = saveActiveResume(before.versions[0].resume);

    expect(after.versions[0].updatedAt).toBe(before.versions[0].updatedAt);
  });

  it('内容变了才写入', () => {
    const before = loadVersionStore();
    const changed = { ...before.versions[0].resume, personal: { ...before.versions[0].resume.personal, name: '改过' } };
    const after = saveActiveResume(changed);

    expect(after.versions[0].resume.personal.name).toBe('改过');
    expect(after.versions[0].updatedAt).not.toBe(before.versions[0].updatedAt);
  });

  it('把快照插入指定人物，不影响其他人物', () => {
    localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(createStore()));
    const withPerson = createPerson('杨泰沣');
    const target = listPersonsMeta(withPerson).find((person) => person.name === '杨泰沣')!;
    const other = listPersonsMeta(withPerson).find((person) => person.name !== '杨泰沣')!;

    const resume = { ...createDefaultResumeState(), personal: { ...createDefaultResumeState().personal, name: '旧版本内容' } };
    const after = insertSnapshotForPerson(withPerson, target.id, resume, '云端覆盖前的本地副本', 'conflict-1');
    const saved = JSON.parse(localStorage.getItem(VERSION_STORAGE_KEY)!) as ResumeVersionStore;

    const slice = personSlice(saved, target.id);
    expect(slice.versions.some((version) => version.id === 'conflict-1' && version.kind === 'snapshot')).toBe(true);
    expect(personSlice(saved, other.id).versions.every((version) => version.id !== 'conflict-1')).toBe(true);
    expect(after.versions.some((version) => version.id === 'conflict-1')).toBe(true);
  });

  it('把数字型个人信息字段读成字符串，避免预览白屏', () => {
    // 数字电话会一路走到 escapeHtml 的 .replace 上抛错，让整个应用卸载成空白页。
    const store = createStore();
    localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(store));
    const raw = JSON.parse(localStorage.getItem(VERSION_STORAGE_KEY)!) as Record<string, any>;
    raw.versions[0].resume.personal.phone = 17366901793;
    raw.versions[0].resume.personal.titles = [2026];
    raw.versions[0].resume.personal.location = { city: 13, region: 210 };
    localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(raw));

    const personal = getActiveResume(loadVersionStore()).personal;
    expect(personal.phone).toBe('17366901793');
    expect(personal.titles).toEqual(['2026']);
    expect(personal.location).toEqual({ city: '13', region: '210' });
  });

  it('分层字号存得下、坏值丢得起，缺省不会变成具体值', () => {
    const store = createStore();
    const raw = JSON.parse(JSON.stringify(store)) as Record<string, any>;
    raw.versions[0].resume.namePt = 19.5;
    raw.versions[0].resume.sectionPt = '不是数字'; // 归一化成「跟随正文」
    raw.versions[0].resume.entryPt = 999; // 收敛到边界
    localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(raw));

    const saved = getActiveResume(loadVersionStore());
    expect(saved.namePt).toBe(19.5);
    expect(saved.sectionPt).toBeUndefined();
    expect(saved.entryPt).toBe(MAX_LEVEL_FONT_SIZE_PT);
  });

  it('没设过层级的简历存回去不会多出字段', () => {
    // 多写一个显式的 pt 就等于把存量简历冻结在今天的比例上，正文再变它就不动了。
    localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(createStore()));
    saveActiveResume({ ...getActiveResume(loadVersionStore()), personal: { name: '杨泰沣' } });

    const persisted = JSON.parse(localStorage.getItem(VERSION_STORAGE_KEY)!) as Record<string, any>;
    const resume = persisted.versions[0].resume;
    expect('namePt' in resume).toBe(false);
    expect('sectionPt' in resume).toBe(false);
    expect('entryPt' in resume).toBe(false);
  });
});

const getActiveResumePersonId = (store: ResumeVersionStore): string =>
  store.versions.find((version) => version.id === store.activeVersionId)!.personId;
