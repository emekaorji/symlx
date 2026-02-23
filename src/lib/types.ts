// Raw shape consumed from package.json. We only care about fields needed to resolve bins.
export type PackageJson = {
  name?: string;
  bin?: string | Record<string, string>;
};

// A symlink created by symlx for a single command name.
export type LinkRecord = {
  name: string;
  linkPath: string;
  target: string;
};

// Session metadata persisted to disk so stale links can be recovered/cleaned later.
export type SessionRecord = {
  pid: number;
  cwd: string;
  createdAt: string;
  links: LinkRecord[];
};

// Strategies for handling existing command names in the target bin directory.
export type CollisionPolicy = 'prompt' | 'skip' | 'fail' | 'overwrite';

// Runtime decision returned by an interactive collision resolver.
export type CollisionDecision = 'skip' | 'overwrite' | 'abort';

// Details about an existing command that blocks link creation.
export type LinkConflict = {
  name: string;
  linkPath: string;
  target: string;
  reason: string;
  existingTarget?: string;
  isSymlink: boolean;
};

// A command that symlx intentionally did not link.
export type LinkSkip = {
  name: string;
  linkPath: string;
  reason: string;
};

// Aggregate result from link creation: what succeeded and what was skipped.
export type LinkCreationResult = {
  created: LinkRecord[];
  skipped: LinkSkip[];
};
