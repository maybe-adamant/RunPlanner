# Releasing

## Installer and data home

The desktop application ships as a per-user NSIS installer on Windows (no
administrator rights) and an AppImage on Linux. Installed and
development builds share one data home: Tauri derives the configuration, data
and WebView storage directories from the bundle identifier, not the executable
location, so the installed application reads what earlier portable builds of
the same identifier wrote and needs no import. The uninstaller's optional
"delete app data" choice removes those directories.

## Updates

Updates are an optional host capability, not a startup dependency. Official
desktop builds ask the Tauri updater once asynchronously, and About offers a
manual check. The updater reads `latest.json` from the latest published
release, orders versions, and verifies the update signature against the public
key committed in `tauri.conf.json`. Application policy owns the notice state: a
found update is announced, may be dismissed for the session or skipped by
version, and installs only after the user confirms that the planner will close
and reopen. The open plan's pending edits are written first; a failed write
cancels the install. If the confirmed version was superseded, the pending one
is offered instead. Native transport opens no other release URLs. React
presents the notice and the manual check.

## Release workflow

Run `npm run check` locally on the commit being released before dispatching;
packaging does not repeat that repository gate. Each published version
identifies one build; choose a new version for a new build.

The manually dispatched **Release** workflow (`release.yml`) validates the
version and the `main` commit once, then calls the reusable **Build Windows**
and **Build Linux** workflows (the AppImage builds on Ubuntu 22.04). Each build
refuses to start while `plugins.updater.pubkey` in
`apps/planner/src-tauri/tauri.conf.json` is the placeholder or the
`TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secrets
are unset. It builds uncached and without the signing key in its environment,
embeds the release version and source commit shown in About, checks that the
bundler stamped the bundle type the updater selects by into the packaged
executable, and signs its staged updater asset in a separate step that alone
receives the key and password. Each smoke-launches what it built (the AppImage
under Xvfb) and uploads a workflow artifact.

One publish job uploads every platform's assets to a single draft release with
one `latest.json`, whose signatures must all match the committed key, and
publishes it once all are present. The manifest keys the AppImage by bundle
type (`linux-x86_64-appimage`), the first target the updater tries.
Publication does not replace assets on a published release.

The `dry_run` input builds, signs and launch-tests both platforms without
creating a tag, draft or release; dispatching **Build Windows** or **Build
Linux** directly is a single-platform build-only check that never publishes.
Moving both signing secrets into a `release` environment restricted to `main`
is recommended hardening.

## Windows code signing

The Windows build Authenticode-signs the installer through Azure Artifact
Signing when the signing repository variables are set, and leaves it unsigned
when none are. A partial configuration fails the build. It signs before the
updater signature, so that signature covers the signed installer, and fails if
the result is not a valid signature. It logs in to Azure with GitHub OIDC, so no
Azure secret is stored. SmartScreen reputation follows the signing identity and
accumulates over downloads; early signed releases may still show a warning.

One-time setup, in an Azure subscription:

1. Register the `Microsoft.CodeSigning` resource provider.
2. Create an Artifact Signing account (Basic tier) and note its region's
   endpoint, such as `https://eus.codesigning.azure.net/`.
3. Grant yourself the Artifact Signing Identity Verifier role on the account and
   complete a Public, Individual identity validation.
4. Once validation succeeds, create a Public Trust certificate profile from it.
5. Register a Microsoft Entra application and add a GitHub Actions federated
   credential for this repository, entity type Branch, branch `main`.
6. Grant that application the Artifact Signing Certificate Profile Signer role
   on the certificate profile.
7. Add these repository variables (Settings → Secrets and variables → Actions →
   Variables): `AZURE_CLIENT_ID` (the application's client ID),
   `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `ARTIFACT_SIGNING_ENDPOINT`,
   `ARTIFACT_SIGNING_ACCOUNT` (the account name) and
   `ARTIFACT_SIGNING_PROFILE` (the certificate profile name).

The federated credential admits only runs on `main`; a build dispatched from
another branch fails at the Azure login while the variables are set.
