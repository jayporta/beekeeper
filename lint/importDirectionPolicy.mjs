/**
 * The one-way dependency directions between the top folders of `src`, as the
 * option for the `beekeeper/import-direction` rule. Each key is a folder and
 * its value lists the folders and packages that folder must not import.
 * AGENTS.md, "Architecture and code organization", states the same directions.
 *
 * @type {Record<string, { folders?: string[], packages?: string[] }>}
 */
export const importDirectionPolicy = {
  core: { folders: ['main', 'preload', 'renderer', 'shared'], packages: ['electron'] },
  renderer: { folders: ['core', 'main', 'preload'] },
  main: { folders: ['preload', 'renderer'] },
  preload: { folders: ['core', 'main', 'renderer'] },
  shared: { folders: ['core', 'main', 'preload', 'renderer'] }
}
