import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

// Compiled, these tests run from dist/tests, so the package root is one folder further up.
const PKG = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');
const FUNCTIONS = path.join(PKG, 'scripts', 'functions', 'fun-nextjs.sh');

// The cucumber.js webship-js scaffolds, as far as the testing hook reads it.
const SCAFFOLD = `module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',          // Webship-js core step definitions.
      'tests/step-definitions/**/*.js',                                  // Your custom step definitions.
    ],
    paths: ['tests/features/**/*.feature'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'http://localhost:8080',
    },
  },
};
`;

/**
 * A project folder with the testing stack scaffolded, and the tooling folder the installer would have filled.
 * A Next.js project has .ddev/config.nextjs.yaml and says which app it has in .ddev/nextjs-example.
 */
function project(kind: 'learn' | 'default' | 'drupal') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextjs-plugin-'));
  const dir = path.join(root, 'dev', 'app1');
  fs.mkdirSync(path.join(dir, '.ddev'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'site'), { recursive: true });
  if (kind === 'drupal') {
    fs.writeFileSync(path.join(dir, '.ddev', 'config.yaml'), 'name: app1\ntype: drupal11\ndocroot: web\n');
  } else {
    fs.writeFileSync(path.join(dir, '.ddev', 'config.yaml'), 'name: app1\ntype: generic\ndocroot: ""\n');
    fs.writeFileSync(path.join(dir, '.ddev', 'config.nextjs.yaml'), 'web_extra_daemons: []\n');
    fs.writeFileSync(path.join(dir, '.ddev', 'nextjs-example'), `${kind}\n`);
  }
  fs.writeFileSync(path.join(dir, 'cucumber.js'), SCAFFOLD);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'app1', devDependencies: { 'webship-js': '^2.0.16' } }, null, 2));
  const scripts = path.join(root, 'core', 'scripts');
  fs.mkdirSync(path.join(scripts, 'plugins', 'nextjs'), { recursive: true });
  for (const f of ['testing/site.feature', 'testing/default-site.feature', 'scripts/node/nextjs-test-app.cjs', 'scripts/node/nextjs-session-route.ts']) {
    fs.copyFileSync(path.join(PKG, f), path.join(scripts, 'plugins', 'nextjs', path.basename(f)));
  }
  return { root, dir, scripts };
}

/** Run bash with the plugin's functions sourced and `ddev` replaced by a recorder; the recorder notes whether the script was in the app folder. */
function bash(script: string, env: Record<string, string> = {}) {
  const fake = 'ddev() { echo "ddev $*" >> "${DDEV_LOG:-/dev/null}" ; if [ "$1" == "exec" ] ; then [ -f site/.webship-test-app.cjs ] && echo "script in the app" >> "${DDEV_LOG:-/dev/null}" ; fi ; return 0 ; }';
  return spawnSync('bash', ['-c', `${fake}\nsource ${FUNCTIONS}\nNEXTJS_TEST_APP="\${WORKSPACE_SCRIPTS}/plugins/nextjs/nextjs-test-app.cjs"\n${script}`],
    { encoding: 'utf8', env: { ...process.env, ...env } });
}

test('the default accounts are the two of the Learn app, with example addresses and the workspace password', () => {
  const r = bash('set_nextjs_users ; for u in "${users[@]}" ; do n="user_${u}_name" ; m="user_${u}_mail" ; p="user_${u}_password" ; f="user_${u}_fullname" ; echo "${!n}|${!m}|${!p}|${!f}" ; done');
  assert.strictEqual(r.status, 0, r.stderr);
  const rows = r.stdout.trim().split('\n').map((l) => l.split('|'));
  assert.deepStrictEqual(rows.map((x) => x[0]), ['administrator', 'editor']);
  assert.deepStrictEqual(rows.map((x) => x[3]), ['Administrator', 'Editor']);
  for (const [name, mail, password] of rows) {
    assert.strictEqual(mail, `${name}@example.com`);
    assert.match(password, /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/, 'a strong shared password');
  }
});

test('the accounts are written into the Learn app by the plugin\'s script, with the app\'s own packages, and removed by it', () => {
  const p = project('learn');
  const log = path.join(p.root, 'ddev.log');
  const env = { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'app1', DDEV_LOG: log };
  let r = bash('set_nextjs_users ; add_nextjs_users', env);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  let written = fs.readFileSync(log, 'utf8');
  assert.match(written, /^ddev exec -d \/var\/www\/html\/site ACCOUNT_PASSWORD='dD\.123123ddd' node \.webship-test-app\.cjs accounts add '\[\{"name":"Administrator","email":"administrator@example\.com"\},\{"name":"Editor","email":"editor@example\.com"\}\]'$/m);
  assert.match(written, /^script in the app$/m, 'the script is in the app folder while it runs');
  assert.ok(!fs.existsSync(path.join(p.dir, 'site', '.webship-test-app.cjs')), 'and gone after');
  fs.rmSync(log);
  r = bash('set_nextjs_users ; cancel_nextjs_users', env);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  written = fs.readFileSync(log, 'utf8');
  assert.match(written, /node \.webship-test-app\.cjs accounts cancel '\["administrator@example\.com","editor@example\.com"\]'$/m);
});

test('the default app has no accounts: adding and removing them does nothing', () => {
  const p = project('default');
  const log = path.join(p.root, 'ddev.log');
  const env = { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'app1', DDEV_LOG: log };
  const r = bash('set_nextjs_users ; add_nextjs_users ; cancel_nextjs_users', env);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /no login and no accounts: there are none to add/);
  assert.ok(!fs.existsSync(log), 'nothing ran in the container');
});

test('a tool asked about a project that is not a Next.js app says so', () => {
  const p = project('drupal');
  const r = bash('add_nextjs_users', { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'app1' });
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stdout, /dev\/app1 is not a Next\.js project/);
});

test('the testing hook wires the pack, the tags, the login and the users registry of the Learn app, once', () => {
  const p = project('learn');
  const env = { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'app1' };
  let r = bash(`testing_configure_nextjs ${p.dir}`, env);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  const pkg = JSON.parse(fs.readFileSync(path.join(p.dir, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.devDependencies['@webship-js/nextjs-steps'], '^2.0.0');
  const cucumber = fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8');
  assert.match(cucumber, /'node_modules\/webship-js\/tests\/step-definitions\/\*\*\/\*\.js',.*\n\s+'node_modules\/@webship-js\/nextjs-steps\/tests\/step-definitions\/\*\*\/\*\.js',/, 'the pack after webship-js');
  assert.match(cucumber, /tags: process\.env\.CUCUMBER_TAGS \|\| 'not @wip and not @must-fail',/);
  assert.match(cucumber, /loginPath: '\/login',/);
  assert.match(cucumber, /sessionPath: '\/api\/auth\/session',/);
  assert.match(cucumber, /administrator: \{ email: process\.env\.NEXTJS_ADMINISTRATOR_EMAIL \|\| 'administrator@example\.com', password: process\.env\.NEXTJS_ADMINISTRATOR_PASSWORD \|\| 'dD\.123123ddd', name: process\.env\.NEXTJS_ADMINISTRATOR_NAME \|\| 'Administrator' \},/);
  assert.match(cucumber, /editor: \{ email: process\.env\.NEXTJS_EDITOR_EMAIL \|\| 'editor@example\.com'/);
  const loaded = spawnSync(process.execPath, ['-e', `const c = require(${JSON.stringify(path.join(p.dir, 'cucumber.js'))}).default; if (!c.worldParameters.users.editor || c.worldParameters.loginPath !== '/login') process.exit(1);`], { encoding: 'utf8' });
  assert.strictEqual(loaded.status, 0, `cucumber.js loads: ${loaded.stderr}`);
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'tests', 'features', 'site.feature'), 'utf8'), fs.readFileSync(path.join(PKG, 'testing', 'site.feature'), 'utf8'), 'the first feature of the Learn app');
  // A second run adds nothing.
  r = bash(`testing_configure_nextjs ${p.dir}`, env);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8'), cucumber, 'a second run changes nothing');
  assert.doesNotMatch(r.stdout, /package\.json:|cucumber\.js:|site\.feature:/);
});

test('the testing hook gives the default app the pack and its own first feature, and no users registry', () => {
  const p = project('default');
  const env = { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'app1' };
  const r = bash(`testing_configure_nextjs ${p.dir}`, env);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  const cucumber = fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8');
  assert.match(cucumber, /@webship-js\/nextjs-steps/);
  assert.doesNotMatch(cucumber, /users:|loginPath/);
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'tests', 'features', 'site.feature'), 'utf8'), fs.readFileSync(path.join(PKG, 'testing', 'default-site.feature'), 'utf8'));
  assert.match(r.stdout, /no production build yet/);
});

test('the testing hook leaves a project of another platform alone', () => {
  const p = project('drupal');
  const before = fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8');
  const r = bash(`testing_configure_nextjs ${p.dir}`, { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'app1' });
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8'), before);
  assert.strictEqual(r.stdout, '');
});

test('the Learn app\'s script writes only example accounts and the suite\'s own customers, with fixed ids', () => {
  const src = fs.readFileSync(path.join(PKG, 'scripts', 'node', 'nextjs-test-app.cjs'), 'utf8');
  assert.match(src, /ON CONFLICT \(email\) DO UPDATE/, 'an account that is there gets its name and password back');
  assert.match(src, /bcrypt\.hash\(password, 10\)/, 'hashed with the app\'s own bcrypt');
  assert.match(src, /name: 'Ivy Example', email: 'ivy@example\.com'/);
  assert.match(src, /name: 'Oak Example', email: 'oak@example\.com'/);
  for (const m of src.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[a-z]{2,}/g) || []) assert.match(m, /@example\.(com|org)$/, `${m} is an example address`);
  const route = fs.readFileSync(path.join(PKG, 'scripts', 'node', 'nextjs-session-route.ts'), 'utf8');
  assert.match(route, /export async function GET\(\)/);
  assert.match(route, /await auth\(\)/);
});
