function collectBinEntry(value: string, previous: string[] = []): string[] {
  previous.push(value);
  return previous;
}

const binDirOption = [
  '--bin-dir <dir>',
  'target bin directory (default: ~/.symlx/bin)',
] as const;

const collisionOption = [
  '--collision <policy>',
  'collision mode: prompt|skip|fail|overwrite',
  'prompt',
] as const;

const binResolutionStrategyOption = [
  '--bin-resolution-strategy <strategy>',
  'bin precedence strategy: replace|merge',
  'replace',
] as const;

const nonInteractiveOption = [
  '--non-interactive',
  'disable interactive prompts',
  false,
] as const;

const binOption = [
  '--bin <name=path>',
  'custom bin mapping (repeatable), e.g. --bin my-cli=dist/cli.js',
  collectBinEntry,
  [] as string[],
] as const;

export {
  binDirOption,
  collisionOption,
  binResolutionStrategyOption,
  nonInteractiveOption,
  binOption,
};
