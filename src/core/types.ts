export type PackageJson = {
  name?: string;
  bin?: string | Record<string, string>;
};

export type LinkRecord = {
  name: string;
  linkPath: string;
  target: string;
};

export type SessionRecord = {
  pid: number;
  cwd: string;
  createdAt: string;
  links: LinkRecord[];
};

export type CollisionPolicy = "prompt" | "skip" | "fail" | "overwrite";

export type CollisionDecision = "skip" | "overwrite" | "abort";

export type LinkConflict = {
  name: string;
  linkPath: string;
  target: string;
  reason: string;
  existingTarget?: string;
  isSymlink: boolean;
};

export type LinkSkip = {
  name: string;
  linkPath: string;
  reason: string;
};

export type LinkCreationResult = {
  created: LinkRecord[];
  skipped: LinkSkip[];
};

export type ZlxPaths = {
  rootDir: string;
  binDir: string;
  sessionDir: string;
};
