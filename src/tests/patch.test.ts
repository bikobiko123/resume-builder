import { describe, expect, it } from 'vitest';
import { applyResumePatch, PatchError, type PatchOperation } from '../lib/patch';
import { collectIds } from '../lib/ids';
import { createBlankResumeState, createResumeSection, type ResumeState } from '../types/resume';

const fixture = (): ResumeState => {
  const resume = createBlankResumeState('张三');
  const work = createResumeSection('work');
  work.id = 'sec-work';
  work.title = '工作经历';
  work.workEntries = [
    {
      id: 'work-acme',
      organization: 'Acme',
      location: '上海',
      positions: [
        { id: 'pos-pm', position: '产品经理', startDate: '2022-03', endDate: 'present', highlights: ['A', 'B'] },
        { id: 'pos-intern', position: '实习生', startDate: '2021-06', endDate: '2021-09', highlights: [] },
      ],
    },
    {
      id: 'work-globex',
      organization: 'Globex',
      location: '北京',
      positions: [{ id: 'pos-eng', position: '工程师', startDate: '2019-01', endDate: '2021-05', highlights: [] }],
    },
  ];
  const education = createResumeSection('education');
  education.id = 'sec-edu';
  education.title = '教育背景';
  education.educationEntries = [
    {
      id: 'edu-pku',
      institution: 'PKU',
      location: '北京',
      studyType: '本科',
      area: '信息管理',
      startDate: '2015-09',
      endDate: '2019-06',
      honorsLabel: '荣誉',
      honors: ['优秀毕业生'],
      courses: [],
      highlights: [],
    },
  ];
  resume.sections = [work, education];
  return resume;
};

const positionsOf = (resume: ResumeState, workEntryIndex: number) =>
  resume.sections[0].workEntries![workEntryIndex].positions;

const run = (operations: PatchOperation[]): ResumeState => applyResumePatch(fixture(), operations).resume;

describe('applyResumePatch addressing', () => {
  it('addresses array entries by id', () => {
    const after = run([
      { op: 'replace', path: '/sections/sec-work/workEntries/work-acme/organization', value: 'Acme 中国' },
    ]);
    expect(after.sections[0].workEntries![0].organization).toBe('Acme 中国');
    expect(after.sections[0].workEntries![1].organization).toBe('Globex');
  });

  it('addresses array entries by index', () => {
    const after = run([{ op: 'replace', path: '/sections/0/workEntries/1/organization', value: 'Globex 2' }]);
    expect(after.sections[0].workEntries![1].organization).toBe('Globex 2');
  });

  it('reaches nested string arrays', () => {
    const after = run([
      { op: 'replace', path: '/sections/0/workEntries/0/positions/0/highlights/1', value: 'B2' },
      { op: 'replace', path: '/sections/0/workEntries/0/positions/0/highlights/0', value: 'A2' },
    ]);
    expect(positionsOf(after, 0)[0].highlights).toEqual(['A2', 'B2']);
  });

  it('escapes ~ and / inside a key per RFC 6901', () => {
    const resume = fixture();
    (resume.personal as unknown as Record<string, unknown>)['a/b~c'] = 'x';
    const after = applyResumePatch(resume, [
      { op: 'replace', path: '/personal/a~1b~0c', value: 'y' },
    ]).resume;
    expect((after.personal as unknown as Record<string, unknown>)['a/b~c']).toBe('y');
  });
});

describe('applyResumePatch operations', () => {
  it('appends to an array with -', () => {
    const after = run([
      { op: 'add', path: '/sections/0/workEntries/0/positions/0/highlights/-', value: 'C' },
    ]);
    expect(positionsOf(after, 0)[0].highlights).toEqual(['A', 'B', 'C']);
  });

  it('inserts before an existing index', () => {
    const after = run([{ op: 'add', path: '/sections/0/workEntries/0/positions/0/highlights/1', value: 'NEW' }]);
    expect(positionsOf(after, 0)[0].highlights).toEqual(['A', 'NEW', 'B']);
  });

  it('removes an entry and the following ids stay valid', () => {
    const after = run([{ op: 'remove', path: '/sections/0/workEntries/work-globex' }]);
    expect(after.sections[0].workEntries!.map((entry) => entry.organization)).toEqual(['Acme']);
  });

  it('adds a whole entry built from a value', () => {
    const after = run([
      {
        op: 'add',
        path: '/sections/0/workEntries/-',
        value: {
          id: 'work-initech',
          organization: 'Initech',
          location: '',
          positions: [{ id: 'pos-1', position: 'PM', startDate: '2020-01', endDate: '2021-01', highlights: [] }],
        },
      },
    ]);
    expect(after.sections[0].workEntries!.map((entry) => entry.id)).toEqual([
      'work-acme',
      'work-globex',
      'work-initech',
    ]);
  });

  it('moves an entry', () => {
    const after = run([{ op: 'move', from: '/sections/0/workEntries/work-globex', path: '/sections/0/workEntries/0' }]);
    expect(after.sections[0].workEntries!.map((entry) => entry.id)).toEqual(['work-globex', 'work-acme']);
  });

  it('passes a test that matches and fails one that does not', () => {
    expect(() => run([{ op: 'test', path: '/personal/name', value: '张三' }])).not.toThrow();
    expect(() => run([{ op: 'test', path: '/personal/name', value: '李四' }])).toThrow(PatchError);
  });

  it('compares objects order-insensitively for test', () => {
    expect(() =>
      run([{ op: 'test', path: '/sections/0/workEntries/0/positions/0', value: { highlights: ['A', 'B'], position: '产品经理', startDate: '2022-03', endDate: 'present', id: 'pos-pm' } }]),
    ).not.toThrow();
  });

  it('does not mutate the input document', () => {
    const resume = fixture();
    const before = JSON.stringify(resume);
    applyResumePatch(resume, [{ op: 'replace', path: '/personal/name', value: '李四' }]);
    expect(JSON.stringify(resume)).toBe(before);
  });

  it('applies nothing when a later operation fails', () => {
    const resume = fixture();
    expect(() =>
      applyResumePatch(resume, [
        { op: 'replace', path: '/personal/name', value: '李四' },
        { op: 'replace', path: '/sections/0/workEntries/nope/organization', value: 'x' },
      ]),
    ).toThrow(PatchError);
    expect(resume.personal.name).toBe('张三');
  });
});

describe('applyResumePatch errors', () => {
  it('lists the available ids when a lookup misses', () => {
    expect(() => run([{ op: 'replace', path: '/sections/0/workEntries/nope/organization', value: 'x' }]))
      .toThrow(/work-acme, work-globex/u);
  });

  it('reports the array length when an index is out of range', () => {
    expect(() => run([{ op: 'replace', path: '/sections/0/workEntries/5/organization', value: 'x' }]))
      .toThrow(/索引 5 越界/u);
  });

  it('rejects an unknown object key instead of creating it', () => {
    expect(() => run([{ op: 'replace', path: '/personal/nickname', value: 'x' }]))
      .toThrow(/不存在，无法 replace/u);
  });

  it('rejects - outside of add', () => {
    expect(() => run([{ op: 'remove', path: '/sections/0/workEntries/-' }])).toThrow(/只能用于 add/u);
  });

  it('requires a leading slash', () => {
    expect(() => run([{ op: 'replace', path: 'personal.name', value: 'x' }])).toThrow(/JSON Pointer/u);
  });

  it('rejects removing the whole document', () => {
    expect(() => run([{ op: 'remove', path: '' }])).toThrow(/整个简历文档/u);
  });
});

describe('addressing across a patch sequence', () => {
  it('keeps working by id after an entry is removed', () => {
    const first = run([{ op: 'remove', path: '/sections/0/workEntries/work-acme' }]);
    const second = applyResumePatch(first, [
      { op: 'replace', path: '/sections/0/workEntries/work-globex/location', value: '深圳' },
    ]).resume;
    expect(second.sections[0].workEntries![0].location).toBe('深圳');
    expect(collectIds(second).map((entry) => entry.id)).toContain('work-globex');
  });
});
