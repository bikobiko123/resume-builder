import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ResumeState } from '../src/types/resume';
import { assignResumeIds, collectIds } from '../src/lib/ids';
import { applyResumePatch, PatchError, type PatchOperation } from '../src/lib/patch';
import { exportToMarkdown } from '../src/lib/markdown';
import { mergeMarkdownIntoResume } from '../src/lib/markdownMerge';
import { normalizeResume, ResumeSchemaError, validateResume } from '../src/lib/resumeSchema';
import { buildDocxFilename, resumeToDocxBlob } from '../src/lib/word';
import { flagBool, flagString, parseArgs, requireFlag, UsageError, type ParsedArgs } from './args';
import { measureResume, type MeasureReport } from './measure';
import { renderResumePdf } from './pdf';
import { CliEnvironmentError } from './paths';

/**
 * `resume` — the agent-facing CLI over the resume document.
 *
 * Contract, in one place:
 * - stdout carries the requested document, or a single JSON envelope. Nothing else.
 * - stderr carries human diagnostics (normalization warnings, hints).
 * - exit 0 = success, 1 = the work failed (bad patch, validation errors, no browser),
 *   2 = the invocation itself was wrong.
 *
 * Every command loads the resume through the same normalizer and id assigner, so
 * ids an agent read from `get` are valid addresses for `patch` even when the file
 * on disk has no ids at all.
 */

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_USAGE = 2;

// ---------------------------------------------------------------- io helpers

class IoError extends Error {}

const readPath = (path: string, label: string): string => {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new IoError(`读取${label}失败：${path}（${reason}）`);
  }
};

const readStdin = (label: string): string => {
  if (process.stdin.isTTY) {
    throw new UsageError(`需要从 stdin 读${label}，但当前是终端；改用 --in <文件> 或通过管道传入`);
  }
  return readFileSync(0, 'utf8');
};

const readInput = (spec: string | undefined, label: string): string =>
  spec === undefined || spec === '-' ? readStdin(label) : readPath(spec, label);

const writeFile = (path: string, content: string | Buffer, label: string): void => {
  try {
    writeFileSync(path, content);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new IoError(`写入${label}失败：${path}（${reason}）`);
  }
};

const writeStdout = (content: string | Buffer): void => {
  process.stdout.write(content);
};

const emit = (payload: unknown): void => {
  writeStdout(`${JSON.stringify(payload, null, 2)}\n`);
};

const warnAll = (lines: readonly string[]): void => {
  for (const line of lines) process.stderr.write(`warning: ${line}\n`);
};

const plural = (count: number, noun: string): string => `${count} ${noun}`;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * Ids created by the editor are random uuids — valid addresses, but useless as
 * something to read or reason about. Mention the one-off conversion once, on the
 * command where an agent first sees the ids.
 */
const hintAboutOpaqueIds = (resume: ResumeState): void => {
  const randomIds = collectIds(resume).filter((entry) => UUID_PATTERN.test(entry.id)).length;
  if (randomIds === 0) return;
  process.stderr.write(
    `hint: 有 ${randomIds} 个 id 是编辑器生成的随机 UUID（可以正常寻址，但不好读）；` +
      `一次性换成可读 id：resume ids --in <文件> --rewrite\n`,
  );
};

// ------------------------------------------------------------ resume loading

interface LoadedResume {
  resume: ResumeState;
  /** Field-level repairs made by the normalizer. */
  warnings: string[];
  /** Ids that were missing or duplicated and had to be generated. */
  idsAssigned: string[];
}

const loadResume = (spec: string | undefined, label = '简历'): LoadedResume => {
  const text = readInput(spec, label);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new IoError(`${label}不是合法的 JSON：${reason}`);
  }
  const { resume, warnings } = normalizeResume(raw);
  const { resume: withIds, assigned } = assignResumeIds(resume);
  return { resume: withIds, warnings, idsAssigned: assigned };
};

const serialize = (resume: ResumeState): string => `${JSON.stringify(resume, null, 2)}\n`;

const parsePatchDocument = (text: string): PatchOperation[] => {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new IoError(`patch 文件不是合法的 JSON：${reason}`);
  }

  if (Array.isArray(raw)) return raw as PatchOperation[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { operations?: unknown }).operations)) {
    return (raw as { operations: PatchOperation[] }).operations;
  }
  throw new UsageError('patch 文件必须是操作数组，或 { "operations": [...] }');
};

/** Normalize the patched result so a malformed `add` cannot produce an unrenderable file. */
const settle = (resume: ResumeState): { resume: ResumeState; warnings: string[] } => {
  const { resume: normalized, warnings } = normalizeResume(resume);
  const { resume: withIds, assigned } = assignResumeIds(normalized);
  return { resume: withIds, warnings: [...warnings, ...assigned.map((id) => `补上 id：${id}`)] };
};

/** Write a mutated resume, refusing to save a document whose ids are ambiguous. */
const commit = (
  resume: ResumeState,
  target: string,
  dryRun: boolean,
  extra: Record<string, unknown>,
): void => {
  const diagnostics = validateResume(resume);
  warnAll(diagnostics.filter((d) => d.level === 'warning').map((d) => `${d.path} ${d.message}`));

  const errors = diagnostics.filter((d) => d.level === 'error');
  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`error: ${error.path} ${error.message}\n`);
    throw new PatchError(`校验未通过，${plural(errors.length, '处错误')}，文件未修改`, target);
  }

  if (dryRun) {
    // Keep stdout a single JSON value: an agent should never have to parse an
    // envelope followed by a bare document.
    emit({ ok: true, dryRun: true, resume, ...extra });
    return;
  }

  writeFile(target, serialize(resume), '简历');
  emit({ ok: true, path: resolve(target), bytes: Buffer.byteLength(serialize(resume)), ...extra });
};

// ------------------------------------------------------------------- commands

const commandGet = (args: ParsedArgs): void => {
  const { resume, warnings, idsAssigned } = loadResume(flagString(args.flags, 'in'));
  warnAll(warnings);
  hintAboutOpaqueIds(resume);
  const out = flagString(args.flags, 'out');
  const body = serialize(resume);

  if (out && out !== '-') {
    writeFile(out, body, '简历');
    emit({ ok: true, path: resolve(out), bytes: Buffer.byteLength(body), idsAssigned: idsAssigned.length });
    return;
  }
  writeStdout(body);
};

const commandIds = (args: ParsedArgs): void => {
  const input = flagString(args.flags, 'in');
  if (!input || input === '-') {
    throw new UsageError('ids 会把结果写回文件，因此需要 --in <文件>（可以配合 --out 写到别处）');
  }

  const text = readPath(input, '简历');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new IoError(`简历不是合法的 JSON：${reason}`);
  }

  const rewrite = flagBool(args.flags, 'rewrite');
  const { resume, warnings } = normalizeResume(raw);
  const result = assignResumeIds(resume, { rewrite });
  warnAll(warnings);

  const out = flagString(args.flags, 'out') ?? input;
  writeFile(out, serialize(result.resume), '简历');
  emit({
    ok: true,
    path: resolve(out),
    mode: rewrite ? 'rewritten' : 'filled',
    assigned: result.assigned,
  });
};

const commandPatch = (args: ParsedArgs): void => {
  const input = requireFlag(args.flags, 'in');
  if (input === '-') throw new UsageError('patch 需要 --in <文件>，因为它默认原地写回');

  const operations = parsePatchDocument(readInput(requireFlag(args.flags, 'patch'), 'patch'));
  if (operations.length === 0) warnAll(['patch 里没有任何操作，文件不会有变化']);

  const { resume, warnings, idsAssigned } = loadResume(input);
  warnAll(warnings);
  if (idsAssigned.length > 0) {
    process.stderr.write(`info: 输入文件有 ${idsAssigned.length} 处 id 缺失，已按内容生成（顺序稳定，可安全寻址）\n`);
  }

  const { resume: patched } = applyResumePatch(resume, operations);
  const settled = settle(patched).resume;

  commit(settled, flagString(args.flags, 'out') ?? input, flagBool(args.flags, 'dry-run'), {
    applied: operations.length,
  });
};

const commandMarkdown = (args: ParsedArgs): void => {
  const { resume, warnings } = loadResume(flagString(args.flags, 'in'));
  warnAll(warnings);
  const body = `${exportToMarkdown(resume)}\n`;
  const out = flagString(args.flags, 'out');

  if (out && out !== '-') {
    writeFile(out, body, 'Markdown');
    emit({
      ok: true,
      path: resolve(out),
      bytes: Buffer.byteLength(body),
      // Markdown cannot carry these back, so say so rather than let an agent
      // assume a round trip is lossless.
      sections: resume.sections.length,
      visibleSections: resume.sections.filter((section) => section.visible).length,
      note: 'Markdown 不含 photo / fontSizePt / show* 开关 / 隐藏章节，回写请用 import --into',
    });
    return;
  }
  writeStdout(body);
};

const commandImport = (args: ParsedArgs): void => {
  const mdPath = requireFlag(args.flags, 'in');
  const target = requireFlag(args.flags, 'into');
  if (mdPath === '-') throw new UsageError('import 需要 --in <markdown 文件>');

  const canonical = loadResume(target).resume;
  const markdown = readPath(mdPath, 'Markdown');
  const result = mergeMarkdownIntoResume(canonical, markdown);

  if (!result.parsed) {
    warnAll(result.warnings);
    throw new IoError(result.warnings[0] ?? 'Markdown 解析失败');
  }
  warnAll(result.warnings);

  const settled = settle(result.resume).resume;

  commit(settled, flagString(args.flags, 'out') ?? target, flagBool(args.flags, 'dry-run'), {
    sections: result.report,
    replaced: result.report.filter((entry) => entry.action === 'replaced').length,
    added: result.report.filter((entry) => entry.action === 'added').length,
    unmentioned: result.unmentioned,
  });
};

const commandRender = async (args: ParsedArgs): Promise<void> => {
  const format = requireFlag(args.flags, 'format');
  if (format !== 'docx' && format !== 'pdf') {
    throw new UsageError(`不支持的 --format ${format}；可用：docx、pdf`);
  }

  const { resume, warnings } = loadResume(flagString(args.flags, 'in'));
  warnAll(warnings);

  const out = flagString(args.flags, 'out');
  const stem = `${resume.personal.name || '简历'}_${new Date().toISOString().split('T')[0]}`;

  if (format === 'pdf') {
    const result = await renderResumePdf(resume, {
      browserPath: flagString(args.flags, 'browser'),
    });
    warnAll(result.report.warnings);
    if (result.clipped) {
      process.stderr.write(
        'error: 内容超出 A4，PDF 中超出部分不会出现。系统未自动缩小；' +
          '必须先精简内容或降低字号（见 measure 的 hotspots）。\n',
      );
    }

    if (out === '-') {
      writeStdout(result.buffer);
      return;
    }

    const target = out ?? `${stem}.pdf`;
    writeFile(target, result.buffer, 'PDF');
    emit({
      ok: true,
      path: resolve(target),
      bytes: result.buffer.byteLength,
      format: 'pdf',
      pages: result.pages,
      fitRatio: result.report.fillRatio,
      fitScale: result.report.fitScale,
      clipped: result.clipped,
      browser: result.report.browser,
    });
    return;
  }

  const blob = await resumeToDocxBlob(resume);
  const buffer = Buffer.from(await blob.arrayBuffer());
  const target = out ?? buildDocxFilename(resume);

  if (target === '-') {
    writeStdout(buffer);
    return;
  }
  writeFile(target, buffer, 'docx');
  emit({ ok: true, path: resolve(target), bytes: buffer.byteLength, format: 'docx' });
};

const commandMeasure = async (args: ParsedArgs): Promise<void> => {
  const { resume, warnings } = loadResume(flagString(args.flags, 'in'));
  warnAll(warnings);

  const report: MeasureReport = await measureResume(resume, {
    browserPath: flagString(args.flags, 'browser'),
  });

  const out = flagString(args.flags, 'out');
  if (out && out !== '-') {
    writeFile(out, `${JSON.stringify(report, null, 2)}\n`, 'measure 报告');
    emit({ ok: true, path: resolve(out), pages: report.pages, fillRatio: report.fillRatio, fitScale: report.fitScale });
    return;
  }
  emit({ ok: true, ...report });
};

const commandValidate = (args: ParsedArgs): void => {
  const { resume, warnings, idsAssigned } = loadResume(flagString(args.flags, 'in'));

  const diagnostics = [
    ...warnings.map((message) => ({ level: 'warning' as const, code: 'normalized', path: '', message })),
    ...validateResume(resume),
  ];
  const errors = diagnostics.filter((diagnostic) => diagnostic.level === 'error');
  const softWarnings = diagnostics.filter((diagnostic) => diagnostic.level === 'warning');

  emit({
    ok: errors.length === 0,
    errors,
    warnings: softWarnings,
    idsAssigned: idsAssigned.length,
    sections: resume.sections.length,
  });

  if (errors.length > 0) process.exitCode = EXIT_FAILED;
};

// ----------------------------------------------------------------- help text

const HELP = `resume — 简历文档的命令行接口

用法
  resume <命令> [选项]

命令（读取类默认从 stdin 读，也可以 --in <文件>）
  get       输出规范化后的简历 JSON（含确定性 id）
  md        输出 Markdown 编辑视图
  validate  报错/警告：字段缺失、占位空串、无效日期、寻址问题
  measure   在真实浏览器里测量 A4 排版（页码、缩放、各章节占用）
  ids       补全缺失的 id 并写回文件
  patch     用 JSON Patch 局部改简历（推荐，见下）
  import    把改过的 Markdown 合回 JSON（只合并章节）
  render    导出渲染产物（--format docx|pdf）

选项
  --in <路径>       输入文件；- 表示 stdin
  --out <路径>      输出文件；- 表示 stdout
  --patch <路径>    patch 命令的操作文件（- 表示 stdin）
  --into <路径>     import 命令的目标简历 JSON
  --format <格式>   render 的格式：docx、pdf
  --browser <路径>  measure / render pdf 使用的 Chromium 可执行文件
  --rewrite         ids 从内容重新生成所有 id（默认只补缺失的）
  --dry-run         只打印结果，不写文件
  --help, -h        本帮助

退出码
  0 成功   1 操作失败（patch/校验/环境）   2 用法错误

寻址
  patch 的 path 是 JSON Pointer，数组段除了索引也接受条目 id：

    /sections/0                                         第 0 个章节（含隐藏的）
    /sections/sec-work-1                                按章节 id
    /sections/sec-work-1/workEntries/work-acme-1        按条目 id
    /sections/0/educationEntries/0/highlights/1         按索引（字符串数组没有 id）
    /sections/0/educationEntries/0/highlights/-         追加到末尾

  操作：add / remove / replace / move / test

典型流程
  resume get --in cv.json --out work.json      # 读出带 id 的规范文档
  # 编辑 work.json，或写一份 patch：
  resume patch --in cv.json --patch edits.json # 局部改，原地写回
  resume measure --in cv.json                  # 是否还装得下一页
  resume render --in cv.json --format docx --out cv.docx
`;

// -------------------------------------------------------------- entry point

interface CommandDoc {
  run: (args: ParsedArgs) => void | Promise<void>;
}

const COMMANDS: Record<string, CommandDoc> = {
  get: { run: commandGet },
  ids: { run: commandIds },
  patch: { run: commandPatch },
  md: { run: commandMarkdown },
  import: { run: commandImport },
  render: { run: commandRender },
  measure: { run: commandMeasure },
  validate: { run: commandValidate },
};

interface Failure {
  code: string;
  message: string;
  exitCode: number;
  extra?: Record<string, unknown>;
}

const describeFailure = (error: unknown, command: string): Failure => {
  if (error instanceof UsageError) {
    return { code: 'usage', message: error.message, exitCode: EXIT_USAGE, extra: { command } };
  }
  if (error instanceof PatchError) {
    return {
      code: 'patch-failed',
      message: error.message,
      exitCode: EXIT_FAILED,
      extra: { command, path: error.path },
    };
  }
  if (error instanceof ResumeSchemaError) {
    return { code: 'invalid-resume', message: error.message, exitCode: EXIT_FAILED, extra: { command } };
  }
  if (error instanceof CliEnvironmentError) {
    return { code: 'environment', message: error.message, exitCode: EXIT_FAILED, extra: { command } };
  }
  if (error instanceof IoError) {
    return { code: 'io', message: error.message, exitCode: EXIT_FAILED, extra: { command } };
  }
  if (error instanceof Error) {
    return { code: 'internal', message: error.message, exitCode: EXIT_FAILED, extra: { command } };
  }
  return { code: 'internal', message: String(error), exitCode: EXIT_FAILED, extra: { command } };
};

const main = async (): Promise<void> => {
  let args: ParsedArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    const failure = describeFailure(error, '');
    process.stderr.write(`${failure.message}\n`);
    emit({ ok: false, error: { code: failure.code, message: failure.message } });
    process.exitCode = failure.exitCode;
    return;
  }

  const wantsHelp = flagBool(args.flags, 'help') || args.command === 'help' || args.command === null;
  if (wantsHelp || !args.command) {
    writeStdout(HELP);
    process.exitCode = EXIT_OK;
    return;
  }

  const command = COMMANDS[args.command];
  if (!command) {
    const failure = describeFailure(
      new UsageError(`未知命令 "${args.command}"；可用命令：${Object.keys(COMMANDS).join(', ')}`),
      args.command,
    );
    process.stderr.write(`${failure.message}\n`);
    emit({ ok: false, error: { code: failure.code, message: failure.message } });
    process.exitCode = failure.exitCode;
    return;
  }

  try {
    await command.run(args);
  } catch (error) {
    const failure = describeFailure(error, args.command);
    process.stderr.write(`${failure.message}\n`);
    emit({
      ok: false,
      error: { code: failure.code, message: failure.message, ...(failure.extra ?? {}) },
    });
    process.exitCode = failure.exitCode;
  }
};

void main();
