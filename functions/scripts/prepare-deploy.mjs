import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const functionsDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoDir = dirname(functionsDir);
const targetDir = join(functionsDir, 'shared');

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });
cpSync(join(repoDir, 'shared', 'dist'), join(targetDir, 'dist'), { recursive: true });
cpSync(join(repoDir, 'shared', 'package.json'), join(targetDir, 'package.json'));
