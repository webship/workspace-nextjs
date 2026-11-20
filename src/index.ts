/**
 * Next.js for Webship Workspace: a platform plugin.
 *
 * What the package carries is placed by the installer from the manifest: the builder and the CLI tool
 * in the sites folders, their functions, argparse, the first features and the Node.js scripts of the
 * Learn app under core/scripts/plugins/nextjs/, and its AI items (ai/ in this package) in the folder of
 * their kind: the agents in AI Agents, the skill in AI Skills, the command in AI Commands, the prompts in
 * AI Prompts. The dashboard needs nothing drawn for it: the builder is in the Build list because it is a
 * cmd-*-project.sh, the row menus are the core's, the AI items are listed like any other. What
 * register() adds is what the assistant is told.
 *
 * Everything the dashboard is asked for goes through `api`; this package requires nothing from the
 * dashboard's own files, so it can be installed from npm and removed without a trace.
 */

import type { PluginApi } from '@webship.co/workspace-plugin-api';

/** The plugin's name. A Next.js project has the DDEV project type generic: the plugin knows it by its files. */
export const PLATFORM = 'nextjs';

/** The commands the installer places in every sites folder. */
export const COMMANDS = ['cmd-nextjs-project.sh', 'cmd-tools-nextjs-cli.sh'];

/** The agents the installer places in the AI Agents folder. */
export const AGENTS = ['nextjs-site-builder', 'nextjs-tester'];

/** The skill the installer places in the AI Skills folder (a folder each, with its SKILL.md). */
export const SKILLS = ['nextjs-scenarios'];

/** The slash command the installer places in the AI Commands folder. */
export const AI_COMMANDS = ['nextjs-test'];

/** The prompts the installer places in the AI Prompts folder: each a whole launch command for a new session. */
export const PROMPTS = ['nextjs-build-and-test', 'nextjs-scenarios-for-a-page'];

/** What the assistant is told about Next.js in this workspace. */
export function assistantContext(): string {
  return [
    'Next.js (a plugin, @webship.co/workspace-nextjs): a Next.js app is built with',
    '`bash cmd-nextjs-project.sh <name> --install` from a sites folder (dev, test, sandboxes, demos), made with create-next-app:',
    'the app it makes with its defaults (`--example default`), or with `--example learn --add-users --test-data` the finished app',
    'of the official Learn course on PostgreSQL, its default accounts (administrator, editor at example.com) and the step pack\'s test data;',
    '`--next-version 15.5.29` builds the Maintenance LTS line, `--development` serves the development server.',
    'It runs in a container like every other project (DDEV project type generic, the app in site/, Node.js 24, served by the web container) at https://<name>.ddev.site.',
    '`bash cmd-tools-nextjs-cli.sh <name>` says what the app is; `--run "<next command>"` runs next in it, `--npm "<arguments>"` its package manager,',
    '`--build` serves a new production build, `--dev` the development server, `--restart`, `--update`, `--test-data`, `--add-users` and `--cancel-users` do what they say.',
    '`bash cmd-tools-testing.sh <name>` sets up webship-js with the Next.js step pack; `--run` runs the suite.',
    `For Next.js work, hand over to the agents ${AGENTS.map((a) => `\`${a}\``).join(' and ')}.`,
    `The plugin also places the skill ${SKILLS.map((a) => `\`${a}\``).join(', ')} (the step pack's phrases, by area) in ai-skills/,`,
    `the command ${AI_COMMANDS.map((a) => `\`/${a} <app>\``).join(', ')} in ai-commands/ and the prompts ${PROMPTS.map((a) => `\`${a}\``).join(' and ')} in ai-prompts/.`,
    'Never run node, npm or next on the host for a project; the Learn app\'s database is the container\'s own (db, db, db).',
  ].join(' ');
}

export function register(api: PluginApi): void {
  api.addAssistantContext(assistantContext);
}
