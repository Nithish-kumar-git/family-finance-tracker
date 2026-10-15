// Isolated production builds: no .env reads, no overwrite of existing dist.
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const repository = dirname(dirname(fileURLToPath(import.meta.url)))
const frontend = join(repository, 'familyfinancetracker')
const require = createRequire(join(frontend, 'package.json'))
const viteDirectory = dirname(require.resolve('vite/package.json'))
const { build } = await import(pathToFileURL(join(viteDirectory, 'dist/node/index.js')))
const destination = await mkdtemp(join(tmpdir(), 'fft-rag-build-'))
process.chdir(frontend) // Existing Tailwind/PostCSS config resolves from this cwd.
for (const name of Object.keys(process.env)) if (name.startsWith('VITE_')) delete process.env[name]
process.env.VITE_API_URL = 'https://synthetic.invalid'
globalThis.fetch = () => { throw Error('External requests blocked during build') }
await build({ root: frontend, configFile: join(frontend, 'vite.config.js'), envDir: false,
  build: { outDir: join(destination, 'family'), emptyOutDir: false } })
await build({ root: frontend, configFile: join(frontend, 'vite.rag.config.js'), envDir: false,
  build: { outDir: join(destination, 'rag'), emptyOutDir: false } })
console.log(`Verified build output (synthetic configuration; do not deploy): ${destination}`)
