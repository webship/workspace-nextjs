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
  for (const f of ['testing/site.feature', 'testing/default-site.feature', 'scripts/node/nextjs-test-app.cts', 'scripts/node/nextjs-session-route.ts']) {
    fs.copyFileSync(path.join(PKG, f), path.join(scripts, 'plugins', 'nextjs', path.basename(f)));
  }
  return { root, dir, scripts };
}

/** Run bash with the plugin's functions sourced and `ddev` replaced by a recorder; the recorder notes whether the script was in the app folder. */
function bash(script: string, env: Record<string, string> = {}) {
  const fake = 'ddev() { echo "ddev $*" >> "${DDEV_LOG:-/dev/null}" ; if [ "$1" == "exec" ] ; then [ -f site/.webship-test-app.cts ] && echo "script in the app" >> "${DDEV_LOG:-/dev/null}" ; fi ; return 0 ; }';
  return spawnSync('bash', ['-c', `${fake}\nsource ${FUNCTIONS}\nNEXTJS_TEST_APP="\${WORKSPACE_SCRIPTS}/plugins/nextjs/nextjs-test-app.cts"\n${script}`],
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
  assert.match(written, /^ddev exec -d \/var\/www\/html\/site ACCOUNT_PASSWORD='dD\.123123ddd' node \.webship-test-app\.cts accounts add '\[\{"name":"Administrator","email":"administrator@example\.com"\},\{"name":"Editor","email":"editor@example\.com"\}\]'$/m);
  assert.match(written, /^script in the app$/m, 'the script is in the app folder while it runs');
  assert.ok(!fs.existsSync(path.join(p.dir, 'site', '.webship-test-app.cts')), 'and gone after');
  fs.rmSync(log);
  r = bash('set_nextjs_users ; cancel_nextjs_users', env);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  written = fs.readFileSync(log, 'utf8');
  assert.match(written, /node \.webship-test-app\.cts accounts cancel '\["administrator@example\.com","editor@example\.com"\]'$/m);
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
  const src = fs.readFileSync(path.join(PKG, 'scripts', 'node', 'nextjs-test-app.cts'), 'utf8');
  assert.match(src, /ON CONFLICT \(email\) DO UPDATE/, 'an account that is there gets its name and password back');
  assert.match(src, /bcrypt\.hash\(password, 10\)/, 'hashed with the app\'s own bcrypt');
  assert.match(src, /name: 'Ivy Example', email: 'ivy@example\.com'/);
  assert.match(src, /name: 'Oak Example', email: 'oak@example\.com'/);
  for (const m of src.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[a-z]{2,}/g) || []) assert.match(m, /@example\.(com|org)$/, `${m} is an example address`);
  const route = fs.readFileSync(path.join(PKG, 'scripts', 'node', 'nextjs-session-route.ts'), 'utf8');
  assert.match(route, /export async function GET\(\)/);
  assert.match(route, /await auth\(\)/);
});

/**
 * An app folder the script can run in without an app: a .env, the picture of the course, and stand-ins for the
 * app's bcrypt and postgres packages. The postgres stand-in writes every statement it is handed to sql.log and
 * answers the rows of ROWS (a JSON list) to a SELECT or a RETURNING.
 */
function appFolder(): string {
  const app = fs.mkdtempSync(path.join(os.tmpdir(), 'nextjs-test-app-'));
  fs.writeFileSync(path.join(app, '.env'), 'POSTGRES_URL=postgres://db:db@db:5432/db\n');
  fs.mkdirSync(path.join(app, 'public', 'customers'), { recursive: true });
  fs.writeFileSync(path.join(app, 'public', 'customers', 'evil-rabbit.png'), 'picture');
  fs.mkdirSync(path.join(app, 'node_modules', 'bcrypt'), { recursive: true });
  fs.writeFileSync(path.join(app, 'node_modules', 'bcrypt', 'package.json'), '{ "name": "bcrypt", "main": "index.js" }');
  fs.writeFileSync(path.join(app, 'node_modules', 'bcrypt', 'index.js'), 'module.exports = { hash: async (data, rounds) => `hash(${data},${rounds})` };\n');
  fs.mkdirSync(path.join(app, 'node_modules', 'postgres'), { recursive: true });
  fs.writeFileSync(path.join(app, 'node_modules', 'postgres', 'package.json'), '{ "name": "postgres", "main": "index.js" }');
  fs.writeFileSync(path.join(app, 'node_modules', 'postgres', 'index.js'), `
const fs = require('fs');
const path = require('path');
const log = (line) => fs.appendFileSync(path.join(process.cwd(), 'sql.log'), line + '\\n');
module.exports = (url, options) => {
  log('connect ' + url + ' ' + JSON.stringify(options));
  const sql = (first, ...values) => {
    if (!first.raw) return '(' + first.join(',') + ')';
    const text = first.reduce((all, part, i) => all + '{' + values[i - 1] + '}' + part).replace(/\\s+/g, ' ').trim();
    log(text);
    return Promise.resolve(/SELECT|RETURNING/.test(text) ? JSON.parse(process.env.ROWS || '[]') : []);
  };
  sql.end = async () => log('end');
  return sql;
};
`);
  return app;
}

/** Run the script the way nextjs_test_app does: a copy in the app's folder, by the Node.js that runs these tests. */
function testApp(app: string, args: string[], env: Record<string, string> = {}) {
  fs.copyFileSync(path.join(PKG, 'scripts', 'node', 'nextjs-test-app.cts'), path.join(app, '.webship-test-app.cts'));
  const r = spawnSync(process.execPath, ['.webship-test-app.cts', ...args], { cwd: app, encoding: 'utf8', env: { ...process.env, ...env } });
  const sql = fs.existsSync(path.join(app, 'sql.log')) ? fs.readFileSync(path.join(app, 'sql.log'), 'utf8').trim().split('\n') : [];
  return { ...r, sql };
}

test('Node.js runs the Learn app\'s script as TypeScript: accounts are added with the app\'s bcrypt and listed', () => {
  const app = appFolder();
  const added = testApp(app, ['accounts', 'add', '[{"name":"Administrator","email":"administrator@example.com"},{"name":"Editor","email":"editor@example.com"}]'], { ACCOUNT_PASSWORD: 'a-password' });
  assert.strictEqual(added.status, 0, added.stderr + added.stdout);
  assert.strictEqual(added.stdout, '  account administrator@example.com (Administrator)\n  account editor@example.com (Editor)\n');
  assert.deepStrictEqual(added.sql, [
    'connect postgres://db:db@db:5432/db {"ssl":"require","max":1}',
    'INSERT INTO users (name, email, password) VALUES ({Administrator}, {administrator@example.com}, {hash(a-password,10)}) ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password = EXCLUDED.password',
    'INSERT INTO users (name, email, password) VALUES ({Editor}, {editor@example.com}, {hash(a-password,10)}) ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password = EXCLUDED.password',
    'end',
  ]);
  const listed = testApp(appFolder(), ['accounts', 'list'], { ROWS: '[{"name":"Editor","email":"editor@example.com"}]' });
  assert.strictEqual(listed.status, 0, listed.stderr);
  assert.strictEqual(listed.stdout, '  editor@example.com (Editor)\n');
});

test('the Learn app\'s script cancels accounts and says which were there', () => {
  const there = testApp(appFolder(), ['accounts', 'cancel', '["editor@example.com"]'], { ROWS: '[{"email":"editor@example.com"}]' });
  assert.strictEqual(there.stdout, '  account editor@example.com: removed\n');
  assert.ok(there.sql.includes('DELETE FROM users WHERE email = {editor@example.com} RETURNING email'));
  const gone = testApp(appFolder(), ['accounts', 'cancel', '["editor@example.com"]']);
  assert.strictEqual(gone.stdout, '  account editor@example.com: not there\n');
});

test('the Learn app\'s script makes the suite\'s customers, their pictures and their three invoices again', () => {
  const app = appFolder();
  const r = testApp(app, ['customers']);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  assert.strictEqual(r.stdout, '  customers Ivy Example, Oak Example; 3 invoices\n');
  for (const picture of ['ivy-example.png', 'oak-example.png']) {
    assert.strictEqual(fs.readFileSync(path.join(app, 'public', 'customers', picture), 'utf8'), 'picture');
  }
  assert.strictEqual(r.sql.filter((l) => l.startsWith('INSERT INTO customers')).length, 2);
  assert.strictEqual(r.sql.filter((l) => l.startsWith('INSERT INTO invoices')).length, 3);
  assert.strictEqual(r.sql.filter((l) => l.startsWith('DELETE FROM invoices WHERE customer_id IN')).length, 1);
  assert.strictEqual(r.sql.at(-1), 'end');
});

test('the Learn app\'s script refuses an unknown action and a missing password, and closes the database', () => {
  const unknown = testApp(appFolder(), ['invoices']);
  assert.strictEqual(unknown.status, 1);
  assert.strictEqual(unknown.stderr.trim(), 'Unknown action "invoices": accounts add, accounts cancel, accounts list or customers.');
  assert.strictEqual(unknown.sql.at(-1), 'end');
  const noPassword = testApp(appFolder(), ['accounts', 'add', '[]'], { ACCOUNT_PASSWORD: '' });
  assert.strictEqual(noPassword.status, 1);
  assert.strictEqual(noPassword.stderr.trim(), 'ACCOUNT_PASSWORD is not set.');
});

test('the Learn app\'s script is the one hand-written script of the plugin, and it is TypeScript', () => {
  const src = fs.readFileSync(path.join(PKG, 'scripts', 'node', 'nextjs-test-app.cts'), 'utf8');
  // Erasable syntax only: Node.js strips the types and runs what is left.
  assert.doesNotMatch(src, /^\s*(enum|namespace)\s|^import .* = require\(|\/\/ @ts-nocheck|: any\b/m);
  const lint = JSON.parse(fs.readFileSync(path.join(PKG, 'package.json'), 'utf8')).scripts.lint as string;
  assert.match(lint, /tsconfig\.scripts\.json/, 'npm run lint type-checks it');
  for (const f of fs.readdirSync(path.join(PKG, 'scripts', 'node'))) assert.match(f, /\.(cts|mts|ts)$/, `${f} is TypeScript`);
});
