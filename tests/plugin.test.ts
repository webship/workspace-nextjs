import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

import { register, assistantContext, PLATFORM, COMMANDS, AGENTS } from '../src/index';

// Compiled, these tests run from dist/tests, so the package root is one folder further up.
const PKG = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');
const read = (f: string) => fs.readFileSync(path.join(PKG, f), 'utf8');
const manifest = JSON.parse(read('package.json')).workspacePlugin;

test('the manifest names the platform, and every file it names ships', () => {
  assert.strictEqual(manifest.name, PLATFORM);
  const named = [...manifest.commands.files, ...manifest.scripts.functions, ...manifest.scripts.args, ...manifest.scripts.machine,
    ...manifest.ai.agents, ...manifest.ai.skills, ...manifest.ai.commands, ...manifest.ai.prompts, ...manifest.features];
  for (const f of named) assert.ok(fs.existsSync(path.join(PKG, f)), `${f} is in the package`);
  assert.deepStrictEqual(manifest.commands.files.map((f: string) => path.basename(f)), COMMANDS);
  assert.deepStrictEqual(manifest.ai.agents.map((f: string) => path.basename(f, '.md')), AGENTS);
  assert.deepStrictEqual(manifest.commands.types, ['sites'], 'the commands go to sites folders only');
  const files: string[] = JSON.parse(read('package.json')).files;
  for (const f of named) assert.ok(files.includes(f.split('/')[0]), `${f} is published with the package`);
});

test('every command finds the workspace by itself, names its folder, and sources its args from where the installer puts them', () => {
  for (const f of manifest.commands.files) {
    const src = read(f);
    assert.match(src, /^#!\/usr\/bin\/env bash/, `${f} is a bash script`);
    assert.match(src, /WORKSPACE_SCRIPTS="\$\{WORKSPACE_SCRIPTS:-\$\(cd "\$\(dirname "\$\{BASH_SOURCE\[0\]\}"\)\/\.\.\/core\/scripts" && pwd\)\}"/, `${f} locates the tooling from its own path`);
    assert.match(src, /workspace\.__WORKSPACE__\.settings\.yml/, `${f} loads the settings of the folder it is installed into`);
    assert.match(src, /source \$\{WORKSPACE_SCRIPTS\}\/plugins\/nextjs\/args\/arg-[a-z-]+\.sh \|\| exit 1 ;/, `${f} reads its arguments from the plugin's args`);
    const last = src.trim().split('\n').pop() as string;
    assert.match(read('scripts/functions/fun-nextjs.sh'), new RegExp(`^function ${last.replace(/ ;$/, '')}\\(\\)`, 'm'), `${f} ends by calling a function the plugin defines`);
  }
  assert.match(read('commands/cmd-nextjs-project.sh'), /^# workspace-name: Next\.js/m, 'the builder carries the name the Build list shows');
  assert.doesNotMatch(read('commands/cmd-tools-nextjs-cli.sh'), /^# workspace-name:/m, 'a tool is not a builder');
});

test('every shell script parses', () => {
  for (const f of [...manifest.commands.files, ...manifest.scripts.functions, ...manifest.scripts.args]) {
    const r = spawnSync('bash', ['-n', path.join(PKG, f)], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, `${f}: ${r.stderr}`);
  }
});

test('--help of each command only prints: argparse stops before the command does anything', () => {
  // The args files hold the whole parser: with --help it prints and exits before any function runs.
  for (const f of manifest.scripts.args) {
    const src = read(f);
    assert.match(src, /^argparse "\$@" <<ARGEOF \|\| exit 1$/m, `${f} is the core's argparse`);
    assert.doesNotMatch(src, /\b(ddev|docker|rm|curl)\b/, `${f} runs nothing`);
  }
});

test('the functions carry the names the core\'s tools look for, and build the app the documented way', () => {
  const src = read('scripts/functions/fun-nextjs.sh');
  for (const fn of ['set_nextjs_users', 'add_nextjs_users', 'cancel_nextjs_users', 'testing_configure_nextjs', 'nextjs_build', 'nextjs_cli_tool']) {
    assert.match(src, new RegExp(`^function ${fn}\\(\\) \\{`, 'm'), `${fn} is defined`);
  }
  assert.doesNotMatch(src, /^function build_nextjs\(\)/m, 'the core\'s own example function is not redefined');
  assert.match(src, /--project-type=generic --webserver-type=generic --docroot=""/, 'a generic project: the app\'s own server answers');
  assert.match(src, /--database=postgres:17/, 'PostgreSQL in a container for the Learn app');
  assert.match(src, /--omit-containers=db/, 'no database for the default app');
  assert.match(src, /--nodejs-version=\$\(ddev_nodejs_version\)/, 'the build runs the Node.js of the workspace rule');
  assert.match(src, /n install \$\{nodejs_version\}/, 'the Node.js of the build is baked in the web image');
  assert.match(src, /create-next-app@\$\{version\} site --example 'https:\/\/github\.com\/vercel\/next-learn\/tree\/\$\{NEXTJS_LEARN_REF\}\/dashboard\/final-example' --use-pnpm/, 'the Learn app the course\'s own way, at a pinned commit');
  assert.match(src, /create-next-app@\$\{version\} site --yes --use-npm/, 'the default app create-next-app makes');
  assert.match(src, /pnpm add next@\$\{version\}/, 'the release asked for, not the course\'s pinned one');
  assert.match(src, /POSTGRES_URL=postgres:\/\/db:db@db:5432\/db/, 'the database settings are the container\'s own values');
  assert.match(src, /ssl=on/, 'PostgreSQL with TLS, as the Learn app asks for it');
  assert.match(src, /install -m 0600 \/etc\/postgresql-tls\/server\.key \/tmp\/server\.key/, 'a key file of the user the database server runs as, whoever that is');
  assert.match(src, /CREATE EXTENSION IF NOT EXISTS \\"uuid-ossp\\"/, 'the extension the course\'s seed races on is made first');
  assert.match(src, /curl -sS http:\/\/127\.0\.0\.1:\$\{NEXTJS_PORT\}\/seed/, 'the course\'s own seed');
  assert.match(src, /allowedDevOrigins/, 'the development server answers the project\'s address');
  assert.match(src, /mv site\/proxy\.ts site\/middleware\.ts/, 'the 15.x line reads the middleware as middleware.ts');
  assert.match(src, /web_extra_daemons:/, 'the app is served by the web container');
  assert.match(src, /fuser -k -TERM \$\{NEXTJS_PORT\}\/tcp/, 'a server that keeps the port is stopped by its port, never by a pattern');
  assert.doesNotMatch(src, /pkill|pgrep|killall/, 'no process is stopped by a pattern');
  assert.match(src, /NEXT_TELEMETRY_DISABLED=1/, 'no telemetry');
  assert.doesNotMatch(src, /ddev stop -y/, 'ddev stop takes no -y');
  assert.match(src, /< \/dev\/null/, 'a command in the container gets no open stdin');
});

test('the args offer the documented options', () => {
  const args = read('scripts/args/arg-nextjs.sh');
  for (const flag of ['--install', '--add-users', '--example', '--test-data', '--next-version', '--development', '--launch']) assert.ok(args.includes(`'${flag}'`), `the builder takes ${flag}`);
  assert.match(args, /choices=\['default', 'learn'\]/, '--example learn|default');
  const cli = read('scripts/args/arg-nextjs-cli.sh');
  for (const flag of ['--run', '--npm', '--build', '--dev', '--restart', '--update', '--test-data', '--add-users', '--cancel-users']) assert.ok(cli.includes(`'${flag}'`), `the CLI tool takes ${flag}`);
});

test('each agent is a definition the AI Agents folder can list: named after its file, described, on the fable model', () => {
  for (const f of manifest.ai.agents) {
    const src = read(f);
    const head = src.split('\n---\n')[0];
    assert.match(head, /^---\n/, `${f} opens with frontmatter`);
    assert.match(head, new RegExp(`^name: ${path.basename(f, '.md')}$`, 'm'));
    assert.match(head, /^description: .{80,}$/m, `${f} says when to use it`);
    assert.match(head, /^model: fable$/m);
    assert.match(head, /^tools:\n(  - \S+\n?)+/m);
    assert.match(src, /cmd-tools-testing\.sh|cmd-nextjs-project\.sh/, `${f} names the plugin's commands`);
  }
  const tester = read('ai/agents/nextjs-tester.md');
  assert.match(tester, /Never create an account in a suite/);
  assert.match(tester, /No platform name in a step phrase/);
  assert.match(tester, /Playwright MCP browser first/);
});

test('register() adds the assistant context and nothing else', () => {
  const calls: string[] = [];
  const api: any = { name: 'nextjs', addAssistantContext: (fn: () => string) => calls.push(fn()) };
  register(api);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0], assistantContext());
  for (const c of COMMANDS) assert.ok(calls[0].includes(c.replace('cmd-tools-nextjs-cli.sh', 'cmd-tools-nextjs-cli.sh')), `the assistant hears of ${c}`);
  assert.match(calls[0], /container/, 'it says the app runs in a container');
});

test('the README says what the plugin ships, what it needs, and how to manage the accounts of a project the Users menu does not know', () => {
  const readme = read('README.md');
  for (const c of COMMANDS) assert.ok(readme.includes(c), `the README names ${c}`);
  assert.match(readme, /container-based \(DDEV by default\)/);
  assert.doesNotMatch(readme, /DDEV-only/i);
  assert.match(readme, /cmd-tools-nextjs-cli\.sh <name> --add-users/, 'the accounts of a generic project are managed with the CLI tool');
  assert.doesNotMatch(readme, /\/home\/(?!YOUR_USER)[a-z]/, 'no personal path');
});
