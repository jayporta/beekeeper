// @ts-check
/**
 * The one-way dependency directions between the top folders of `src`, as the
 * option for the `beekeeper/import-direction` rule. Each key is a folder and
 * its value lists the folders and packages that folder must not import.
 * AGENTS.md, "Architecture and code organization", states the same directions.
 *
 * @type {Record<string, { folders?: string[], packages?: string[] }>}
 */
export const importDirectionPolicy = {
  core: {
    folders: ['main', 'mod', 'preload', 'renderer', 'service', 'shared'],
    packages: ['electron']
  },
  mod: {
    folders: ['main', 'preload', 'renderer'],
    packages: ['electron', 'react', 'react-dom', 'react-i18next']
  },
  service: { folders: ['main', 'mod', 'preload', 'renderer'], packages: ['electron'] },
  renderer: { folders: ['core', 'main', 'mod', 'preload', 'service'] },
  main: { folders: ['mod', 'preload', 'renderer'] },
  preload: { folders: ['core', 'main', 'mod', 'renderer', 'service'] },
  shared: {
    folders: ['core', 'main', 'mod', 'preload', 'renderer', 'service'],
    packages: ['electron', 'react', 'react-dom', 'react-i18next']
  }
}
