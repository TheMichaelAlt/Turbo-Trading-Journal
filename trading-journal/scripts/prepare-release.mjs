import { readFile, writeFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const folder = new URL(`../release/${version}/`, import.meta.url)
const installer = `Turbo Trading Journal-Windows-${version}-Setup.exe`
const bytes = await readFile(new URL(installer, folder))
const hash = createHash('sha256').update(bytes).digest('hex')
await writeFile(new URL('SHA256SUMS.txt', folder), `${hash}  ${installer}\r\n`)
await writeFile(new URL('INSTALL-AND-UPDATE.txt', folder), `TURBO TRADING JOURNAL ${version}

INSTALL ON A FRIEND'S PC
Share this one file: ${installer}
It contains the app and its runtime. No Node.js, VS Code, project folder, or
development server is needed. Use a 64-bit Windows 10 or Windows 11 PC.

Download the installer to the PC, double-click it, and complete setup.
Open Turbo Trading Journal from the desktop shortcut or Start menu afterward.
The first launch starts a new, empty journal for that Windows user.
Your friend's journal is separate from yours; your trading data is not included.

UPDATE TO A NEW VERSION
1. Save any trade you are entering. Wait until the app says Saved locally.
2. Settings > Export backup makes an optional portable JSON copy of all data.
3. Close Turbo Trading Journal.
4. Run the newer Setup.exe under the SAME Windows user. Install over the
   existing app using the same installation folder. Do not uninstall first.
5. Reopen the app. Existing completed and unfinished trades, custom
   characteristics, settings, and daily journal entries remain available.

Updates currently use a new installer supplied by the developer. This release
does not automatically check for or download updates from the internet.

WHERE DATA LIVES
%APPDATA%\\trading-journal\\trading_journal.db
This is outside the installation folder and stays the same across versions.
Settings > Open data folder opens it. The backups subfolder holds consistent
SQLite snapshots created before a different app version opens existing data.
Keep JSON exports somewhere separate as an additional backup. Restore those
through Settings > Restore backup. Moving to another PC requires a JSON export
and restore; updates on the same PC require neither.

WINDOWS PUBLISHER NOTICE
This friend-testing release is unsigned. Windows may show an unknown-publisher
or reputation notice. Only install the file received from the developer; a
Windows user or administrator must decide whether to allow it on that PC.
No security settings need to be changed by this application.

Optional integrity check in PowerShell:
Get-FileHash -Algorithm SHA256 -LiteralPath '.\\${installer}'
Compare the result with SHA256SUMS.txt received from the developer.

WHAT TO SHARE
Required: ${installer}
Optional: this guide and SHA256SUMS.txt.
You do not need to share win-unpacked, .blockmap, .yml, source code, node_modules,
any database, or any personal journal backup to install or manually update.
`.replace(/\n/g, '\r\n'))
console.log(`Ready to share: ${fileURLToPath(new URL(installer, folder))}`)
console.log(`Installer size: ${((await stat(new URL(installer, folder))).size / 1024 / 1024).toFixed(1)} MB`)
console.log(`SHA-256: ${hash}`)
