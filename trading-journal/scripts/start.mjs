import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const environment = { ...process.env }
// A normal desktop launch must not inherit a stopped Vite server or Electron's Node mode.
delete environment.ELECTRON_RUN_AS_NODE
delete environment.VITE_DEV_SERVER_URL

export const desktop = spawn(require('electron'), [projectRoot], {
  cwd: projectRoot,
  env: environment,
  detached: true,
  stdio: 'ignore',
})

desktop.once('error', error => {
  console.error(`Could not open Turbo Trading Journal: ${error.message}`)
  process.exitCode = 1
})
desktop.once('spawn', () => {
  desktop.unref()
  console.log('Turbo Trading Journal opened. You can close this terminal.')
})
