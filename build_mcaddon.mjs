import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = __dirname;

const behaviorScriptsPath = path.join(projectRoot, 'behavior_pack', 'scripts');
const outputArchive = path.join(projectRoot, 'IC2_Bedrock.mcaddon');

function run(command, options = {}) {
  execSync(command, { stdio: 'inherit', ...options });
}

function buildScripts() {
  console.log('Building scripts...');
  run('npm run build', { cwd: behaviorScriptsPath });
}

function packMcaddon() {
  console.log('Packing mcaddon...');
  rmSync(outputArchive, { force: true });
  run(`zip -r ${path.basename(outputArchive)} behavior_pack resource_pack`, { cwd: projectRoot });
}

function main() {
  try {
    buildScripts();
    packMcaddon();
    console.log('Done');
  } catch (error) {
    console.error('Build failed:', error);
    process.exitCode = 1;
  }
}

main();
