// Shared helpers for running the official Compact toolchain from either a native
// macOS/Linux shell or, on Windows, via WSL - since the official compact-devtools
// releases currently ship only macOS and Linux binaries (verified in
// docs/MIDNIGHT_STATUS.md). Nothing here invents a Midnight API; it only locates and
// invokes the real `compact` CLI.
import { spawnSync } from "node:child_process";

export const WSL_DISTRO = "Ubuntu";

export function isWindows() {
  return process.platform === "win32";
}

export function toWslPath(winPath) {
  const match = /^([A-Za-z]):\\(.*)$/.exec(winPath);
  if (!match) return winPath.replace(/\\/g, "/");
  const drive = match[1].toLowerCase();
  const rest = match[2].replace(/\\/g, "/");
  return `/mnt/${drive}/${rest}`;
}

export function hasNativeCompact() {
  // On Windows, `where compact` resolves to the built-in NTFS compact.exe utility, not
  // the Midnight Compact CLI - the official compact-devtools ship no Windows binary at
  // all (verified in docs/MIDNIGHT_STATUS.md). Never treat that as a real match.
  if (isWindows()) return false;
  const found = spawnSync("which", ["compact"], { stdio: "ignore" }).status === 0;
  if (!found) return false;
  const versionCheck = spawnSync("compact", ["compile", "--", "--version"], { encoding: "utf-8" });
  return versionCheck.status === 0 && /^\d+\.\d+\.\d+/.test((versionCheck.stdout ?? "").trim());
}

export function hasWsl() {
  if (!isWindows()) return false;
  const result = spawnSync("wsl.exe", ["-l", "-q"], { stdio: ["ignore", "pipe", "ignore"] });
  if (result.status !== 0 || !result.stdout) return false;
  const distros = result.stdout.toString("utf16le").replace(/\0/g, "");
  return distros.includes(WSL_DISTRO);
}

/** Runs a shell command line, preferring the native shell and falling back to WSL on Windows. */
export function runShell(repoRootWin, shellCommand) {
  if (!isWindows()) {
    return spawnSync("bash", ["-lc", shellCommand], { stdio: "inherit", cwd: repoRootWin });
  }
  const wslRoot = toWslPath(repoRootWin);
  const fullCommand = `source "$HOME/.local/bin/env" 2>/dev/null; cd '${wslRoot}' && ${shellCommand}`;
  return spawnSync("wsl.exe", ["-d", WSL_DISTRO, "--", "bash", "-lc", fullCommand], {
    stdio: "inherit",
  });
}
