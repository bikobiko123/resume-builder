import { describe, expect, it } from 'vitest';
import {
  isCloudSchemaError,
  planCloudSync,
  saveCloudPerson,
  SCHEMA_NOT_MIGRATED_MESSAGE,
  toCloudError,
  type CloudRow,
} from '../lib/cloudStorage';
import {
  deterministicLegacyPersonId,
  mergePersonSlice,
  parseVersionStore,
  personIdsOf,
  personSlice,
  type ResumeVersionRecord,
  type ResumeVersionStore,
  type ResumeVersionStoreV1,
} from '../lib/storage';
import { createBlankResumeState, createDefaultResumeState } from '../types/resume';

const PERSON = 'person-1';
const AT = '2026-01-01T00:00:00.000Z';

const draft = (personId: string, name: string): ResumeVersionRecord => ({
  id: `${personId}-draft`,
  personId,
  name: '当前草稿',
  kind: 'draft',
  resume: {
    ...createDefaultResumeState(),
    personal: { ...createDefaultResumeState().personal, name },
  },
  createdAt: AT,
  updatedAt: AT,
});

const store = (...versions: ResumeVersionRecord[]): ResumeVersionStore => ({
  schemaVersion: 2,
  activeVersionId: versions[0]?.id ?? '',
  versions,
});

const row = (personId: string | null, value: ResumeVersionStore, id = `row-${personId ?? 'legacy'}`): CloudRow => ({
  id,
  personId,
  name: '',
  store: value,
  updatedAt: AT,
});

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('云端按人物合并', () => {
  it('只存在于本地的人物会被推送', () => {
    const local = store(draft(PERSON, '本地'));
    const plan = planCloudSync(local, []);

    expect(plan.toPush.map((item) => item.personId)).toEqual([PERSON]);
    expect(plan.toPush[0].name).toBe('本地');
    expect(plan.toDeletePersonIds).toEqual([]);
    expect(personIdsOf(plan.store)).toEqual([PERSON]);
  });

  it('只存在于云端的人物会被采用，且绝不删除', () => {
    const local = store(draft('local-only', '本地'));
    const plan = planCloudSync(local, [row('cloud-only', store(draft('cloud-only', '云端')))]);

    expect(personIdsOf(plan.store).sort()).toEqual(['cloud-only', 'local-only']);
    expect(plan.toDeletePersonIds).toEqual([]);
    expect(plan.toDeleteRowIds).toEqual([]);
  });

  it('两边内容相同时不产生任何写入', () => {
    const local = store(draft(PERSON, '同名'));
    const plan = planCloudSync(local, [row(PERSON, clone(local))]);

    expect(plan.toPush).toEqual([]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.toDeletePersonIds).toEqual([]);
  });

  it('两边草稿不同时云端赢，并把本地那份存成确定性快照', () => {
    const local = store(draft(PERSON, '本地'));
    const cloud = store(draft(PERSON, '云端'));
    const plan = planCloudSync(local, [row(PERSON, cloud)]);

    expect(plan.conflicts).toEqual([PERSON]);

    const slice = personSlice(plan.store, PERSON);
    expect(slice.versions.find((version) => version.kind === 'draft')?.resume.personal.name).toBe('云端');

    const copies = slice.versions.filter((version) => version.name === '云端覆盖前的本地副本');
    expect(copies).toHaveLength(1);
    expect(copies[0].resume.personal.name).toBe('本地');
  });

  it('重复合并是幂等的：产物逐字节相同，且不再判定冲突', () => {
    const local = store(draft(PERSON, '本地'));
    const rows = [row(PERSON, store(draft(PERSON, '云端')))];

    const first = planCloudSync(local, rows);
    const second = planCloudSync(first.store, rows);

    expect(JSON.stringify(second.store)).toBe(JSON.stringify(first.store));
    expect(second.conflicts).toEqual([]);
    // 冲突副本云端还没有，需要推一次；这也是收敛所需的唯一一次写入。
    expect(second.toPush.map((item) => item.personId)).toEqual([PERSON]);
  });

  it('云端新增快照不算冲突，本地独有版本按并集保留', () => {
    const cloud = store(draft(PERSON, '同名'));
    const local = clone(cloud);
    local.versions.push({
      id: 'local-snapshot',
      personId: PERSON,
      name: '本地快照',
      kind: 'snapshot',
      resume: createDefaultResumeState(),
      createdAt: AT,
      updatedAt: AT,
    });

    const merged = mergePersonSlice(PERSON, cloud, local);

    expect(merged.conflict).toBe(false);
    expect(merged.slice.versions.map((version) => version.id)).toContain('local-snapshot');
  });

  it('用版本 id 交集把云端人物对齐到本地已随机迁移过的人物', () => {
    const localPersonId = 'random-old-id';
    const local = store(draft(localPersonId, '胡雅琦'));

    const legacy: ResumeVersionStoreV1 = {
      schemaVersion: 1,
      activeVersionId: `${localPersonId}-draft`,
      versions: [{
        id: `${localPersonId}-draft`,
        name: '当前草稿',
        kind: 'draft',
        resume: local.versions[0].resume,
        createdAt: AT,
        updatedAt: AT,
      }],
    };
    const legacyStore = parseVersionStore(legacy) as ResumeVersionStore;

    const plan = planCloudSync(local, [row(null, legacyStore, 'legacy-row')]);

    // 不能出现两个「胡雅琦」
    expect(personIdsOf(plan.store)).toEqual([localPersonId]);
    expect(plan.toDeleteRowIds).toContain('legacy-row');
    expect(plan.conflicts).toEqual([]);
  });

  it('v1 迁移出的人物 id 是确定性的', () => {
    const legacy: ResumeVersionStoreV1 = {
      schemaVersion: 1,
      activeVersionId: 'd1',
      versions: [{
        id: 'd1',
        name: '当前草稿',
        kind: 'draft',
        resume: createDefaultResumeState(),
        createdAt: AT,
        updatedAt: AT,
      }],
    };

    expect(deterministicLegacyPersonId(legacy)).toBe(deterministicLegacyPersonId(clone(legacy)));
    expect(deterministicLegacyPersonId(legacy))
      .not.toBe(deterministicLegacyPersonId({ ...clone(legacy), activeVersionId: 'other' }));
    expect(deterministicLegacyPersonId({ schemaVersion: 1, activeVersionId: 'x', versions: [] }))
      .toBe('legacy-empty');
  });

  it('全新设备上的空白人物不会占一行云端文档', () => {
    const blank = store({
      id: 'blank-draft',
      personId: 'blank-person',
      name: '当前草稿',
      kind: 'draft',
      resume: createBlankResumeState(),
      createdAt: AT,
      updatedAt: AT,
    });

    const plan = planCloudSync(blank, [row(PERSON, store(draft(PERSON, '胡雅琦')))]);

    expect(plan.toPush).toEqual([]);
    expect(personIdsOf(plan.store)).toEqual([PERSON]);
    expect(plan.toDeletePersonIds).toEqual([]);
  });

  it('旧结构行里如果存的是多人物 store，会展开成多行', () => {
    const multi = store(draft('p-a', '甲'), draft('p-b', '乙'));
    const plan = planCloudSync(store(draft('local', '本地')), [row(null, multi, 'legacy-row')]);

    expect(personIdsOf(plan.store).sort()).toEqual(['local', 'p-a', 'p-b']);
    expect(plan.toDeleteRowIds).toEqual(['legacy-row']);
    // 两个云端人物都是新出现的，本地那份才是需要 push 的
    expect(plan.toPush.map((item) => item.personId)).toEqual(['local']);
  });

  it('tombstone 会删除云端行并阻止它被复活', () => {
    const local = store(draft('keep', '保留'));
    const rows = [row('keep', clone(local)), row('gone', store(draft('gone', '已删')))];
    const plan = planCloudSync(local, rows, ['gone']);

    expect(plan.toDeletePersonIds).toEqual(['gone']);
    expect(personIdsOf(plan.store)).toEqual(['keep']);
    expect(plan.toPush).toEqual([]);
  });
});

describe('云端表未迁移时的错误识别', () => {
  it('缺列 / 旧唯一索引 / 无法匹配 onConflict 都归为「未迁移」', () => {
    ['42703', '23505', '42P10'].forEach((code) => {
      const error = toCloudError({ code, message: 'boom' });
      expect(isCloudSchemaError(error)).toBe(true);
      expect(error.message).toBe(SCHEMA_NOT_MIGRATED_MESSAGE);
    });
  });

  it('普通错误不会被误判为表结构问题', () => {
    const error = toCloudError(new Error('network down'));
    expect(isCloudSchemaError(error)).toBe(false);
    expect(error.message).toBe('network down');
  });
});

describe('云同步写入接口', () => {
  it('未配置 Supabase 时按人物写入返回错误但不影响本地模式', async () => {
    const result = await saveCloudPerson('user-id', PERSON, '本地', store(draft(PERSON, '本地')));
    expect(result.data).toBeNull();
    expect(result.error?.message).toContain('Supabase 尚未配置');
  });
});
