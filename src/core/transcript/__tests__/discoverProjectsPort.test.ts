import { afterEach, describe, expect, it } from 'vitest'
import { installFileSystem } from '../../io/installFileSystem'
import { nodeFileSystem } from '../../io/node/nodeFileSystem'
import { discoverProjects } from '../discoverProjects'

describe('discoverProjects through the file system port', () => {
  afterEach(() => {
    installFileSystem(nodeFileSystem)
  })

  it('lists the directories the installed port reports, sorted, skipping links and files', async () => {
    installFileSystem({
      ...nodeFileSystem,
      readDir: async () => [
        { name: '-b', kind: 'directory' },
        { name: '-a', kind: 'directory' },
        { name: 'l', kind: 'symlink' },
        { name: 'f', kind: 'file' }
      ],
      resolvePath: (path) => path,
      joinPath: (...segments) => segments.join('/')
    })

    const projects = await discoverProjects('/p')

    expect(projects.map((project) => project.path)).toEqual(['/p/-a', '/p/-b'])
  })
})
