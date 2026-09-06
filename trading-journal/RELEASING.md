# Windows releases

The first shareable release is 1.0.0. `npm run dist:win` builds an offline,
per-user Windows x64 NSIS installer in `release/<version>/`, followed by a short
installation guide and a SHA-256 checksum. Publishing to a service is disabled
in this command; send the resulting Setup.exe or upload it to your chosen file
sharing service yourself. Only that installer is required on the recipient's PC.

## Build and validate a release

Use Node.js 24 or newer on Windows. With dependencies installed:

```powershell
npm run lint
npm test
npm run test:e2e
npm run dist:win
npm run test:release
npm run test:upgrade
```

The release smoke test runs the packaged executable using a temporary data
profile. The upgrade test builds two temporary installers with a separate app
identity and no shortcuts, installs and upgrades them under a temporary folder,
verifies journal retention, and uninstalls only that test application. Its test
artifacts stay under `.test-data` for inspection. Neither test edits your real
journal or installs over the real Turbo Trading Journal application.

## Create the next update

1. Make the changes and keep data migrations backward compatible. The journal
   backup format's `version` is a schema version, separate from the app version.
2. Run `npm version patch --no-git-tag-version` for a small release (for example,
   1.0.0 to 1.0.1). Use `minor` for a larger feature release. This updates both
   package.json and package-lock.json. Do not reuse a previously shared version.
3. Run the build and validation commands above.
4. Share the new version's Setup.exe. Recipients save and close the app, then
   run it over their existing installation under the same Windows account.

## Publish a download on GitHub

1. Commit and push the source changes used to build the installer. The release
   tag should point to that exact source revision, not an older commit.
2. Open https://github.com/TheMichaelAlt/Turbo-Trading-Journal/releases/new.
3. Create a tag matching the app version, initially `v1.0.0`, on the commit
   from step 1. Use `Turbo Trading Journal v1.0.0` as the release title.
4. Attach these files from `release/1.0.0/` to the release assets:
   - `Turbo Trading Journal-Windows-1.0.0-Setup.exe`
   - `INSTALL-AND-UPDATE.txt`
   - `SHA256SUMS.txt`
5. Describe the changes and mention Windows x64, manual installer upgrades,
   retained journal data, and the unsigned publisher notice. Use the text below
   as the first release description.
6. Publish as a normal release and mark it as the latest release. Verify the
   uploaded Setup.exe downloads successfully and matches the local checksum.

Share this permanent link:
https://github.com/TheMichaelAlt/Turbo-Trading-Journal/releases/latest

The root README already links there. After each future version is published as
the latest release, the same link leads to the new installer. People download
the Setup.exe from **Assets**, not the automatically generated source archives.
If the repository is private, recipients need repository access to download.
Do not commit the installer into Git: the release assets are separate from the
source repository and accept this installer size. The ignored `release` folder
should remain ignored. Publishing a GitHub release does not enable automatic
in-app updates; this application still uses manual installer upgrades.

Suggested first release description:

```markdown
Windows desktop release of Turbo Trading Journal.

Download the file ending in Setup.exe below, run it, and open the app from
your desktop shortcut or Start menu. Windows 10/11 x64; no Node.js or VS Code
installation is required.

- Custom trade characteristics and automatic analytics
- Master trade log, unfinished trades, and daily journal
- Trading calendar with daily statistics
- Teal/orange light and dark themes
- Minimalist entry strip and LONG/SHORT toggle

Future updates: save and close the app, then install the newer Setup.exe over
the existing installation. Trades, characteristics, and journal pages remain
on your PC. Updates are manual; a database backup is created when a different
app version first opens your existing data.

This release is unsigned, so Windows may display an unknown-publisher notice.
Installation instructions and SHA-256 checksums are attached alongside the
installer. Your journal data stays on your own PC.
```

Keep `appId: com.turbo.tradingjournal`, package `name: trading-journal`, and the
explicit `%APPDATA%\trading-journal` data location stable. Do not put databases
in the installation folder, include them in build assets, change the install
identity per version, or add uninstall instructions that remove user data.
The app retains the starter's data folder even after electron-builder assigns
the packaged product name. The installer replaces the program files only.

On the first successful load in a different app version, the storage layer
creates a SQLite snapshot in `backups` before parsing/migrating the existing
data, then records the app version. It snapshots committed WAL data as well.
If making the backup fails, loading fails without replacing the journal. If
loading a future schema fails, the database remains available for recovery.
Backups are not pruned automatically. JSON exports remain the user-facing way
to restore data or move it to a different PC.

## Distribution limits

This build is unsigned. It is suitable for testing with friends who trust the
source, but Windows may show publisher/reputation notices. A public release
should use a Windows code-signing identity and be tested on a clean Windows PC.
Configure signing through electron-builder's supported certificate or Azure
Trusted Signing environment setup; keep credentials out of the repository.

There is no hosted update feed in this release. Manual installer upgrades are
supported and tested. In-app update downloads can be added with electron-updater
once a stable release host and signing identity are chosen, using the same
installer identity and data directory.

References: [NSIS installer configuration](https://www.electron.build/nsis/),
[Electron data paths](https://www.electronjs.org/docs/latest/api/app#appgetpathname).
