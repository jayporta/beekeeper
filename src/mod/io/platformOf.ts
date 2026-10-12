/**
 * Names the platform from `uname -s` output, as Node does.
 *
 * @param unameOutput - What `uname -s` printed.
 * @returns `linux` for Linux and `darwin` for anything else, so `locateGit` never probes the macOS
 * `/usr/bin/git` shim, which can open the Command Line Tools installer.
 */
export function platformOf(unameOutput: string): string {
  return unameOutput.trim() === 'Linux' ? 'linux' : 'darwin'
}
