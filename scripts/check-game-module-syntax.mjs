// Parses every game-module Lua file with `luac -p`, including files Luacheck excludes.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { exit, stderr, stdout } from 'node:process';
import { URL, fileURLToPath } from 'node:url';

const moduleRoot = fileURLToPath(new URL('../game-module/', import.meta.url));

function luaFiles(directory) {
  return readdirSync(join(moduleRoot, directory), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.lua'))
    .map((entry) => join(entry.parentPath, entry.name));
}

const files = [...luaFiles('src/'), ...luaFiles('tests/')].sort();
const result = spawnSync('luac', ['-p', ...files], { stdio: 'inherit' });
if (result.error !== undefined) {
  stderr.write(`Unable to run luac: ${result.error.message}\n`);
  exit(1);
}
if (result.status !== 0) exit(result.status ?? 1);
stdout.write(`luac -p: ${files.length} Lua files parsed\n`);
