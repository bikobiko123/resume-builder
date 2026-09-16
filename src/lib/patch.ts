import type { ResumeState } from '../types/resume';

/**
 * A small, agent-facing patch language over the resume JSON.
 *
 * It is JSON Pointer (RFC 6901) with one addition that matters a lot when an
 * agent — not a human with the file open — writes the patch: **a non-numeric
 * array segment matches the entry's `id`, not just its position**.
 *
 *   /sections/0/educationEntries/0/highlights/1
 *   /sections/sec-work-1/workEntries/work-acme-1/positions/0/highlights/-
 *
 * The id form keeps working after entries are inserted, removed or reordered,
 * which is what makes a sequence of small edits safer than rewriting the whole
 * document. Supported ops: add, remove, replace, move, test.
 */

export type PatchOpName = 'add' | 'remove' | 'replace' | 'move' | 'test';

export interface PatchOperation {
  op: PatchOpName;
  path: string;
  /** Source pointer, for `move` only. */
  from?: string;
  /** Operand for `add`, `replace` and `test`. */
  value?: unknown;
}

export class PatchError extends Error {
  readonly path: string;

  constructor(message: string, path: string) {
    super(message);
    this.name = 'PatchError';
    this.path = path;
  }
}

type JsonContainer = Record<string, unknown> | unknown[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const decodeToken = (token: string): string => token.replace(/~1/gu, '/').replace(/~0/gu, '~');

const encodePath = (tokens: string[]): string => (tokens.length === 0 ? '' : `/${tokens.join('/')}`);

const parsePointer = (pointer: string): string[] => {
  if (pointer === '') return [];
  if (!pointer.startsWith('/')) {
    throw new PatchError(`路径必须是以 / 开头的 JSON Pointer，收到 "${pointer}"`, pointer);
  }
  return pointer.slice(1).split('/').map(decodeToken);
};

/** Describe what an array actually offers, so a failed lookup is fixable without re-reading the file. */
const describeArray = (array: unknown[]): string => {
  const ids = array
    .map((item) => (isRecord(item) ? item.id : undefined))
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (ids.length === array.length && ids.length > 0) return `可用的 id：${ids.join(', ')}`;
  if (array.length === 0) return '数组为空';
  return `数组长度 ${array.length}，可用索引 0..${array.length - 1}`;
};

const describeContainer = (container: JsonContainer): string =>
  Array.isArray(container)
    ? describeArray(container)
    : `可用字段：${Object.keys(container).join(', ') || '（空对象）'}`;

interface ResolvedKey {
  key: string | number;
  /** True when `add` is appending rather than inserting. */
  appended: boolean;
}

/**
 * Turn one pointer segment into a concrete key.
 *
 * `allowAppend` opts into the `-` token, which only `add` may use.
 */
const resolveKey = (
  container: JsonContainer,
  token: string,
  prefix: string[],
  allowAppend: boolean,
): ResolvedKey => {
  if (Array.isArray(container)) {
    if (token === '-') {
      if (!allowAppend) {
        throw new PatchError(`"${encodePath([...prefix, token])}" 的 "-" 只能用于 add 操作`, encodePath(prefix));
      }
      return { key: container.length, appended: true };
    }

    if (/^\d+$/u.test(token)) {
      const index = Number(token);
      if (index > container.length || (!allowAppend && index === container.length)) {
        throw new PatchError(
          `索引 ${index} 越界，"${encodePath(prefix)}" 有 ${container.length} 个元素`,
          encodePath(prefix),
        );
      }
      return { key: index, appended: false };
    }

    const index = container.findIndex((item) => isRecord(item) && item.id === token);
    if (index < 0) {
      throw new PatchError(
        `"${encodePath(prefix)}" 里找不到 id 为 "${token}" 的条目；${describeArray(container)}`,
        encodePath(prefix),
      );
    }
    return { key: index, appended: false };
  }

  return { key: token, appended: false };
};

const childAt = (container: JsonContainer, key: string | number): unknown =>
  Array.isArray(container) ? container[key as number] : container[key as string];

const setChildAt = (container: JsonContainer, key: string | number, value: unknown): void => {
  if (Array.isArray(container)) {
    container[key as number] = value;
    return;
  }
  container[key as string] = value;
};

/** Walk to the container that holds the final segment. */
const resolveParent = (root: JsonContainer, tokens: string[]): { parent: JsonContainer; last: string } => {
  let current: JsonContainer = root;

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const { key } = resolveKey(current, tokens[index], tokens.slice(0, index), false);
    const next = childAt(current, key);
    if (!isRecord(next) && !Array.isArray(next)) {
      throw new PatchError(
        `"${encodePath(tokens.slice(0, index + 1))}" 不是对象或数组，无法继续向下走`,
        encodePath(tokens.slice(0, index + 1)),
      );
    }
    current = next;
  }

  return { parent: current, last: tokens[tokens.length - 1] };
};

const readAt = (root: JsonContainer, tokens: string[]): unknown => {
  if (tokens.length === 0) return root;
  const { parent, last } = resolveParent(root, tokens);
  const { key } = resolveKey(parent, last, tokens.slice(0, -1), false);
  const value = childAt(parent, key);
  if (value === undefined) {
    throw new PatchError(`"${encodePath(tokens)}" 不存在`, encodePath(tokens));
  }
  return value;
};

const addAt = (root: JsonContainer, tokens: string[], value: unknown): void => {
  if (tokens.length === 0) {
    throw new PatchError('不能把整个简历文档替换为 add 的目标，请用 replace', '');
  }
  const { parent, last } = resolveParent(root, tokens);
  const { key, appended } = resolveKey(parent, last, tokens.slice(0, -1), true);

  if (Array.isArray(parent)) {
    // RFC 6902 `add` inserts before an existing index, and appends for `-`.
    if (appended) parent.push(value);
    else parent.splice(key as number, 0, value);
    return;
  }

  setChildAt(parent, key, value);
};

const removeAt = (root: JsonContainer, tokens: string[]): unknown => {
  if (tokens.length === 0) {
    throw new PatchError('不能删除整个简历文档', '');
  }
  const { parent, last } = resolveParent(root, tokens);
  const { key } = resolveKey(parent, last, tokens.slice(0, -1), false);

  if (Array.isArray(parent)) {
    const [removed] = parent.splice(key as number, 1);
    return removed;
  }

  const current = parent[key as string];
  if (current === undefined) {
    throw new PatchError(`"${encodePath(tokens)}" 不存在，无法删除`, encodePath(tokens));
  }
  delete parent[key as string];
  return current;
};

const replaceAt = (root: JsonContainer, tokens: string[], value: unknown): void => {
  if (tokens.length === 0) {
    throw new PatchError('不能整体替换简历文档，请定位到具体字段', '');
  }
  const { parent, last } = resolveParent(root, tokens);
  const { key } = resolveKey(parent, last, tokens.slice(0, -1), false);

  if (!Array.isArray(parent) && !Object.prototype.hasOwnProperty.call(parent, key)) {
    throw new PatchError(
      `"${encodePath(tokens)}" 不存在，无法 replace；${describeContainer(parent)}`,
      encodePath(tokens),
    );
  }
  setChildAt(parent, key, value);
};

const deepEqual = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => deepEqual(item, right[index]));
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    if (leftKeys.length !== rightKeys.length) return false;
    if (!leftKeys.every((key, index) => key === rightKeys[index])) return false;
    return leftKeys.every((key) => deepEqual(left[key], right[key]));
  }
  return false;
};

const applyOperation = (root: JsonContainer, operation: PatchOperation): void => {
  const tokens = parsePointer(operation.path);

  switch (operation.op) {
    case 'add':
      addAt(root, tokens, operation.value);
      return;
    case 'remove':
      removeAt(root, tokens);
      return;
    case 'replace':
      replaceAt(root, tokens, operation.value);
      return;
    case 'move': {
      if (typeof operation.from !== 'string') {
        throw new PatchError('move 操作需要 from 字段', operation.path);
      }
      const fromTokens = parsePointer(operation.from);
      // Remove first so both pointers are resolved against the same start state,
      // which is what RFC 6902 specifies.
      const value = removeAt(root, fromTokens);
      addAt(root, tokens, value);
      return;
    }
    case 'test': {
      const actual = readAt(root, tokens);
      if (!deepEqual(actual, operation.value)) {
        throw new PatchError(
          `test 失败："${operation.path}" 的当前值是 ${JSON.stringify(actual)}`,
          operation.path,
        );
      }
      return;
    }
    default: {
      const unknownOp: never = operation.op;
      throw new PatchError(`不支持的操作：${String(unknownOp)}`, operation.path);
    }
  }
};

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export interface PatchResult {
  resume: ResumeState;
  applied: number;
}

/**
 * Apply every operation, or none. Throws `PatchError` on the first failure so a
 * bad patch can never leave the document half-edited.
 */
export const applyResumePatch = (resume: ResumeState, operations: PatchOperation[]): PatchResult => {
  if (!Array.isArray(operations)) {
    throw new PatchError('patch must be an array of operations', '');
  }

  // The clone makes the operation atomic: nothing is returned unless all of them succeed.
  const working = cloneJson(resume) as unknown as JsonContainer;

  operations.forEach((operation, index) => {
    if (!isRecord(operation) || typeof operation.op !== 'string' || typeof operation.path !== 'string') {
      throw new PatchError(`第 ${index + 1} 个操作缺少 op/path 字段`, '');
    }
    applyOperation(working, operation);
  });

  return { resume: working as unknown as ResumeState, applied: operations.length };
};
