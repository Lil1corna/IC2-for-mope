import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = __dirname;

const behaviorScriptsPath = path.join(projectRoot, 'behavior_pack', 'scripts');
const outputArchive = path.join(projectRoot, 'IC2_Bedrock.mcaddon');
const behaviorManifestPath = path.join(projectRoot, 'behavior_pack', 'manifest.json');
const resourceManifestPath = path.join(projectRoot, 'resource_pack', 'manifest.json');

function assertIntegrity(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function compareVersions(a = [], b = []) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function verifyPackIntegrity() {
  console.log('Verifying pack integrity...');

  const requiredPaths = [behaviorScriptsPath, behaviorManifestPath, resourceManifestPath];
  requiredPaths.forEach((filePath) => {
    assertIntegrity(existsSync(filePath), `Missing required path: ${path.relative(projectRoot, filePath)}`);
  });

  const behaviorManifest = readJson(behaviorManifestPath);
  const resourceManifest = readJson(resourceManifestPath);

  assertIntegrity(Array.isArray(behaviorManifest.modules), 'Behavior manifest is missing modules array');
  const scriptModule = behaviorManifest.modules.find((module) => module.type === 'script');
  assertIntegrity(scriptModule, 'Behavior manifest is missing a script module');
  assertIntegrity(typeof scriptModule.entry === 'string', 'Script module must define an entry file');

  assertIntegrity(Array.isArray(resourceManifest.modules), 'Resource manifest is missing modules array');
  assertIntegrity(
    resourceManifest.modules.some((module) => module.type === 'resources'),
    'Resource manifest must include a resources module',
  );

  const resourceHeader = resourceManifest.header ?? {};
  const behaviorDependency = behaviorManifest.dependencies?.find((dep) => dep.uuid === resourceHeader.uuid);
  assertIntegrity(
    behaviorDependency,
    'Behavior manifest must depend on the resource pack UUID from resource_pack/manifest.json',
  );

  if (Array.isArray(resourceHeader.version) && Array.isArray(behaviorDependency.version)) {
    assertIntegrity(
      compareVersions(resourceHeader.version, behaviorDependency.version),
      'Behavior manifest dependency version does not match resource pack version',
    );
  }

  return path.join('behavior_pack', scriptModule.entry);
}

function verifyBuildOutput(entryPath) {
  console.log('Validating build outputs...');
  assertIntegrity(existsSync(entryPath), `Expected script entry not found after build: ${path.relative(projectRoot, entryPath)}`);
}

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
    const scriptEntryPath = verifyPackIntegrity();
    buildScripts();
    verifyBuildOutput(path.join(projectRoot, scriptEntryPath));
    packMcaddon();
    console.log('Done');
  } catch (error) {
    console.error('Build failed:', error);
    process.exitCode = 1;
  }
}

main();
