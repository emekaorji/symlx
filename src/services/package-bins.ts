import fs from "node:fs";
import path from "node:path";

import type { PackageJson } from "../core/types";

function inferBinName(packageName: string | undefined): string {
  if (!packageName) {
    throw new Error("package.json is missing `name`, needed when `bin` is a string");
  }

  if (packageName.startsWith("@")) {
    const parts = packageName.split("/");
    if (parts.length !== 2 || !parts[1]) {
      throw new Error(`invalid package name: ${packageName}`);
    }
    return parts[1];
  }

  return packageName;
}

function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export function readBins(cwd: string): Map<string, string> {
  const packageJsonPath = path.join(cwd, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`missing package.json in ${cwd}`);
  }

  const packageJson = readJsonFile<PackageJson>(packageJsonPath);
  if (!packageJson.bin) {
    throw new Error("package.json has no `bin` field");
  }

  const bins = new Map<string, string>();

  if (typeof packageJson.bin === "string") {
    bins.set(inferBinName(packageJson.name), path.resolve(cwd, packageJson.bin));
  } else {
    for (const [name, relTarget] of Object.entries(packageJson.bin)) {
      bins.set(name, path.resolve(cwd, relTarget));
    }
  }

  if (bins.size === 0) {
    throw new Error("no bin entries found");
  }

  for (const [name, target] of bins.entries()) {
    if (!fs.existsSync(target)) {
      throw new Error(`bin target for "${name}" does not exist: ${target}`);
    }
  }

  return bins;
}
