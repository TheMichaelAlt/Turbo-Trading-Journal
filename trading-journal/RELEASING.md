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
