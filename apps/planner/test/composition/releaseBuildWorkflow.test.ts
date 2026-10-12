import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (path: string) => readFileSync(join(repositoryRoot, path), 'utf8');
const release = () => read('.github/workflows/release.yml');
const builds = () => ({
  windows: read('.github/workflows/build-windows.yml'),
  linux: read('.github/workflows/build-linux.yml'),
});

function step(workflow: string, name: string) {
  const start = workflow.indexOf(`- name: ${name}`);
  expect(start, name).toBeGreaterThan(0);
  const end = workflow.indexOf('- name: ', start + 1);
  return { start, text: workflow.slice(start, end === -1 ? undefined : end) };
}

function job(workflow: string, name: string) {
  const start = workflow.indexOf(`\n  ${name}:\n`);
  expect(start, name).toBeGreaterThan(0);
  const next = /\n {2}[\w-]+:\n/g;
  next.lastIndex = start + 1;
  const end = next.exec(workflow)?.index;
  return workflow.slice(start, end);
}

describe('desktop release build metadata', () => {
  it('invokes the native GitHub CLI without a shell interpreting the jq pipes', () => {
    const script = read('scripts/assert-release-version.mjs');
    expect(script).toContain("platform === 'win32' ? 'gh.exe' : 'gh'");
    expect(script).toContain("{ encoding: 'utf8', shell: false }");
    expect(script).toContain(
      "'.[] | select(.draft == false and .prerelease == false) | .tag_name'",
    );
  });

  it('releases both platforms from one combined workflow', () => {
    expect(existsSync(join(repositoryRoot, '.github/workflows/windows-release.yml'))).toBe(false);
    const workflow = release();
    for (const platform of ['windows', 'linux']) {
      const build = job(workflow, `build-${platform}`);
      expect(build).toContain('needs: validate');
      expect(build).toContain(`uses: ./.github/workflows/build-${platform}.yml`);
      expect(build).toContain('version: ${{ needs.validate.outputs.release_version }}');
    }
    expect(job(workflow, 'release')).toContain('needs: [validate, build-windows, build-linux]');
    expect(workflow.match(/gh release create/g)).toHaveLength(1);
    expect(workflow.match(/gh release edit/g)).toHaveLength(1);
  });

  it('passes one validated version and commit to Tauri and the frontend on each platform', () => {
    const { windows, linux } = builds();
    expect(read('apps/planner/src-tauri/tauri.conf.json')).toContain(
      '"version": "../package.json"',
    );
    expect(windows).toContain('$config = @{ version = $version } | ConvertTo-Json -Compress');
    expect(windows).toContain('"release_sha=$env:GITHUB_SHA" >> $env:GITHUB_OUTPUT');
    expect(windows).toContain('--config "$env:TAURI_RELEASE_CONFIG"');
    expect(linux).toContain(
      `jq -n --arg version "\${RELEASE_VERSION}" '{version: $version}' > "\${config_path}"`,
    );
    expect(linux).toContain('echo "release_sha=${GITHUB_SHA}"');
    expect(linux).toContain('--config "${TAURI_RELEASE_CONFIG}"');
    for (const build of [windows, linux]) {
      expect(build).toContain('ref: ${{ github.sha }}');
      expect(build).toContain('RUN_PLANNER_BUILD_COMMIT: ${{ steps.release.outputs.release_sha }}');
      expect(build).toContain("RUN_PLANNER_OFFICIAL_RELEASE: 'true'");
      expect(build).toContain(
        'RUN_PLANNER_RELEASE_VERSION: ${{ steps.release.outputs.release_version }}',
      );
    }
  });

  it('validates the version and main commit once before either build', () => {
    const workflow = release();
    const validate = job(workflow, 'validate');
    expect(validate).toContain('GH_TOKEN: ${{ github.token }}');
    expect(validate).toContain('node scripts/assert-release-version.mjs "${RELEASE_VERSION}"');
    expect(validate).toContain(
      'gh api "repos/${GITHUB_REPOSITORY}/compare/main...${GITHUB_SHA}" --jq .status',
    );
    expect(validate).toContain('git ls-remote --tags origin');
    // A directly dispatched build still refuses a version that is not releasable.
    for (const build of Object.values(builds())) {
      const preparation = step(build, 'Prepare release configuration').text;
      expect(preparation).toContain('GH_TOKEN: ${{ github.token }}');
      expect(preparation).toMatch(/node scripts\/assert-release-version\.mjs "?\$/);
    }
  });

  it('keeps an incomplete release private until every platform asset and the manifest are present', () => {
    const workflow = release();
    const publishJob = job(workflow, 'release');
    expect(publishJob).toContain('--draft');
    expect(publishJob).toContain(
      'Release ${RELEASE_TAG} is already published and cannot be replaced.',
    );
    const listed = step(publishJob, 'List release assets').text;
    for (const asset of [
      'release/${WINDOWS_ARTIFACT}.exe',
      'release/${WINDOWS_ARTIFACT}.exe.sig',
      'release/${LINUX_ARTIFACT}.AppImage',
      'release/${LINUX_ARTIFACT}.AppImage.sig',
      'release/latest.json',
      'release/module-build.json',
    ]) {
      expect(listed).toContain(asset);
    }

    const manifest = step(publishJob, 'Assemble updater manifest').text;
    expect(manifest).toMatch(
      /--platform windows-x86_64 \\\n\s+--asset "\$\{WINDOWS_ARTIFACT\}\.exe" \\\n\s+--signature "release\/\$\{WINDOWS_ARTIFACT\}\.exe\.sig"/,
    );
    expect(manifest).toMatch(
      /--platform linux-x86_64-appimage \\\n\s+--asset "\$\{LINUX_ARTIFACT\}\.AppImage" \\\n\s+--signature "release\/\$\{LINUX_ARTIFACT\}\.AppImage\.sig"/,
    );

    const assets = step(publishJob, 'List release assets');
    const draft = step(publishJob, 'Create or resume draft release');
    const assemble = step(publishJob, 'Assemble updater manifest');
    const upload = step(publishJob, 'Upload release assets to draft');
    const publish = step(publishJob, 'Publish complete draft release');
    expect(draft.start).toBeGreaterThan(assets.start);
    expect(assemble.start).toBeGreaterThan(draft.start);
    expect(upload.start).toBeGreaterThan(assemble.start);
    expect(publish.start).toBeGreaterThan(upload.start);
    expect(upload.text).toContain('RELEASE_FILES: ${{ steps.assets.outputs.files }}');
    expect(publish.text).toContain('RELEASE_FILES: ${{ steps.assets.outputs.files }}');
    expect(publish.text).toContain('node scripts/assert-release-version.mjs "${RELEASE_VERSION}"');
    expect(
      publish.text.indexOf('gh release edit "${RELEASE_TAG}" --draft=false --latest'),
    ).toBeGreaterThan(publish.text.indexOf('Draft release ${RELEASE_TAG} is missing'));
  });

  it('refuses to build before the updater key is configured and keeps the key out of the build', () => {
    const { windows, linux } = builds();
    const platforms = [
      {
        workflow: windows,
        build: 'Build installer',
        stage: 'Stage installer',
        sign: 'Sign installer for the updater',
        launch: 'Install and smoke-test desktop launch',
        bundles: 'tauri build --bundles nsis --no-sign',
      },
      {
        workflow: linux,
        build: 'Build AppImage',
        stage: 'Stage AppImage',
        sign: 'Sign AppImage for the updater',
        launch: 'Smoke-test desktop launch',
        bundles: 'tauri build --bundles appimage --no-sign',
      },
    ];
    for (const platform of platforms) {
      const { workflow } = platform;
      const preparation = step(workflow, 'Prepare release configuration');
      const guard = step(workflow, 'Require updater signing configuration');
      const build = step(workflow, platform.build);
      const stage = step(workflow, platform.stage);
      const sign = step(workflow, platform.sign);
      const launch = step(workflow, platform.launch);
      expect(guard.start).toBeGreaterThan(preparation.start);
      expect(build.start).toBeGreaterThan(guard.start);
      expect(stage.start).toBeGreaterThan(build.start);
      expect(sign.start).toBeGreaterThan(stage.start);
      expect(launch.start).toBeGreaterThan(sign.start);

      expect(guard.text).toContain('updater-release.mjs assert-pubkey');
      expect(guard.text).toContain(
        "SIGNING_KEY_PRESENT: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY != '' }}",
      );
      expect(guard.text).not.toContain('TAURI_SIGNING_PRIVATE_KEY:');
      expect(build.text).toContain(platform.bundles);
      expect(build.text).not.toContain('TAURI_SIGNING_PRIVATE_KEY');
      expect(sign.text).toContain(
        'TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}',
      );
      expect(sign.text).toContain(
        'TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}',
      );
      expect(sign.text).toContain('node node_modules/@tauri-apps/cli/tauri.js signer sign');
      expect(workflow.match(/secrets\.TAURI_SIGNING_PRIVATE_KEY }}/g)).toHaveLength(1);
      expect(workflow.match(/secrets\.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}/g)).toHaveLength(1);
      expect(workflow).not.toContain('Swatinem/rust-cache');
      expect(workflow).not.toContain('--no-bundle');
      expect(workflow).not.toMatch(/^concurrency:/m);
    }

    // The release workflow hands the key only to the two reusable builds.
    const workflow = release();
    expect(workflow).not.toContain('secrets: inherit');
    expect(workflow.match(/secrets\.TAURI_SIGNING_PRIVATE_KEY }}/g)).toHaveLength(2);
    for (const platform of ['windows', 'linux']) {
      expect(job(workflow, `build-${platform}`)).toContain(
        'TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}',
      );
    }
    expect(job(workflow, 'release')).not.toContain('secrets.');
  });

  it('publishes the module build the release ships, from the Rust assembly, without the key', () => {
    const { linux } = builds();
    const stage = step(linux, 'Stage AppImage');
    const record = step(linux, 'Record module build');
    const upload = step(linux, 'Upload workflow artifact');
    expect(record.start).toBeGreaterThan(stage.start);
    expect(upload.start).toBeGreaterThan(record.start);
    expect(stage.text).toContain('echo "module_build=${staging}/module-build.json"');
    expect(record.text).toContain(
      '-p run-planner-game-host --example events_ci -- module-build > "${MODULE_BUILD}"',
    );
    expect(record.text).toContain('cargo run --release --locked');
    expect(record.text).toContain(
      'RUN_PLANNER_RELEASE_VERSION: ${{ steps.release.outputs.release_version }}',
    );
    expect(record.text).toContain('(.buildId | test("^[0-9a-f]{64}$"))');
    expect(record.text).not.toContain('TAURI_SIGNING_PRIVATE_KEY');
    expect(upload.text).toContain('${{ steps.package.outputs.module_build }}');
  });

  it('builds only the AppImage on the oldest runner and verifies, signs and launch-tests it', () => {
    const { linux } = builds();
    expect(linux).toContain('runs-on: ubuntu-22.04');
    expect(linux).not.toMatch(/\bdeb\b/);
    const dependencies = step(linux, 'Install Linux build dependencies').text;
    for (const name of [
      'libwebkit2gtk-4.1-dev',
      'libgtk-3-dev',
      'librsvg2-dev',
      'libssl-dev',
      'libdbus-1-dev',
      'pkg-config',
      'libfuse2',
      'xvfb',
    ]) {
      expect(dependencies).toContain(name);
    }
    expect(step(linux, 'Stage AppImage').text).toContain('*_${RELEASE_VERSION}_amd64.AppImage');
    const verify = step(linux, 'Verify bundle type');
    expect(verify.start).toBeGreaterThan(step(linux, 'Stage AppImage').start);
    expect(verify.start).toBeLessThan(step(linux, 'Sign AppImage for the updater').start);
    expect(verify.text).toContain('"${APPIMAGE}" --appimage-extract');
    expect(verify.text).toContain('[ "$(count __TAURI_BUNDLE_TYPE_VAR_UNK)" -ne 0 ]');
    expect(verify.text).toContain('"$(count __TAURI_BUNDLE_TYPE_VAR_APP)"');
    const launch = step(linux, 'Smoke-test desktop launch').text;
    expect(launch).toContain("APPIMAGE_EXTRACT_AND_RUN: '1'");
    expect(launch).toContain('xvfb-run --auto-servernum');
    expect(launch).toContain('kill -0 "${pid}"');
    expect(launch).toContain('kill -TERM -- "-${pid}" 2>/dev/null || true');
    expect(launch).toContain('smoke "${APPIMAGE}"');
  });

  it('checks the installed Windows executable carries the NSIS bundle type', () => {
    const launch = step(builds().windows, 'Install and smoke-test desktop launch').text;
    expect(launch).toContain("'__TAURI_BUNDLE_TYPE_VAR_UNK'");
    expect(launch).toContain("'__TAURI_BUNDLE_TYPE_VAR_NSS'");
    expect(launch.indexOf('__TAURI_BUNDLE_TYPE_VAR_NSS')).toBeLessThan(
      launch.indexOf('Start-Process $binaries[0].FullName'),
    );
  });

  it('lets each platform build be dispatched as a check that never tags, drafts or publishes', () => {
    for (const build of Object.values(builds())) {
      expect(build).toMatch(/\n {2}workflow_call:\n/);
      expect(build).toMatch(/\n {2}workflow_dispatch:\n/);
      expect(build).toContain('permissions:\n  contents: read');
      expect(build).not.toContain('contents: write');
      expect(build).not.toContain('gh release');
      expect(build).not.toContain('git/refs');
    }
  });

  it('builds, signs and launch-tests a dry run without tagging, drafting or publishing', () => {
    const workflow = release();
    expect(workflow).toMatch(
      /dry_run:\n\s+description: .*\n\s+required: false\n\s+default: false\n\s+type: boolean/,
    );
    const publishJob = job(workflow, 'release');
    expect(publishJob.slice(0, publishJob.indexOf('steps:'))).toContain(
      'if: ${{ !inputs.dry_run }}',
    );
    const beforePublish = workflow.slice(0, workflow.indexOf('\n  release:\n'));
    expect(beforePublish).not.toContain('gh release');
    expect(beforePublish).not.toContain('git/refs');
    expect(beforePublish).not.toContain('dry_run }}');
  });
});
