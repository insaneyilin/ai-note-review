import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export async function defuddle(url) {
  return new Promise((resolve, reject) => {
    const child = spawn(path.join(repositoryRoot, 'node_modules/.bin/defuddle'), ['parse', url, '--markdown'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out=''; let err='';
    child.stdout.on('data', x=>out+=x);
    child.stderr.on('data', x=>err+=x);
    child.on('close', code=>code ? reject(new Error(err || `Defuddle exited ${code}`)) : resolve(out));
  });
}
