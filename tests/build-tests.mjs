import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const dir = await mkdtemp(join(tmpdir(), 'life-os-tests-'));
const outfile = join(dir, 'logic.test.mjs');
try {
  await build({ entryPoints: ['tests/logic.test.ts'], bundle: true, format: 'esm', platform: 'node', target: 'node20', outfile, sourcemap: false, logLevel: 'silent' });
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--test', outfile], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (exitCode) => resolve(exitCode ?? 1));
  });
  if (code !== 0) process.exit(code);
} finally {
  await rm(dir, { recursive: true, force: true });
}
