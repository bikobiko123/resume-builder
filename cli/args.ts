/**
 * Minimal flag parser. No dependency, no config — the surface is small enough
 * to keep obvious, and an agent reading `--help` should be able to predict it.
 */

/** Flags that never take a value, so `--dry-run --in x.json` parses as expected. */
const BOOLEAN_FLAGS = new Set(['dry-run', 'rewrite', 'help', 'pretty']);

const SHORT_FLAGS: Record<string, string> = {
  '-i': 'in',
  '-o': 'out',
  '-h': 'help',
};

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

export interface ParsedArgs {
  command: string | null;
  flags: Map<string, string | true>;
  rest: string[];
}

export const parseArgs = (argv: readonly string[]): ParsedArgs => {
  const flags = new Map<string, string | true>();
  const rest: string[] = [];
  let command: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--') {
      rest.push(...argv.slice(index + 1));
      break;
    }

    if (token.startsWith('--')) {
      const body = token.slice(2);
      const equals = body.indexOf('=');
      if (equals >= 0) {
        flags.set(body.slice(0, equals), body.slice(equals + 1));
        continue;
      }
      if (BOOLEAN_FLAGS.has(body)) {
        flags.set(body, true);
        continue;
      }
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('--')) {
        // Tolerate a missing value so `--help`-style invocations still parse;
        // commands validate what they actually need.
        flags.set(body, true);
        continue;
      }
      flags.set(body, next);
      index += 1;
      continue;
    }

    if (token.startsWith('-') && token.length > 1) {
      const alias = SHORT_FLAGS[token];
      if (!alias) throw new UsageError(`未知的短选项 ${token}`);
      flags.set(alias, true);
      continue;
    }

    if (command === null) command = token;
    else rest.push(token);
  }

  return { command, flags, rest };
};

export const flagString = (flags: Map<string, string | true>, name: string): string | undefined => {
  const value = flags.get(name);
  if (value === undefined || value === true) return undefined;
  return value;
};

export const flagBool = (flags: Map<string, string | true>, name: string): boolean =>
  flags.has(name);

export const requireFlag = (flags: Map<string, string | true>, name: string): string => {
  const value = flagString(flags, name);
  if (value === undefined) throw new UsageError(`缺少 --${name} 参数`);
  return value;
};
