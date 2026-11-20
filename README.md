# @webship.co/workspace-nextjs

Next.js for the [Webship Workspace](https://github.com/webship/workspace) dashboard: a builder that
makes a real Next.js app in a container with `create-next-app` — the app it makes with its defaults,
or the finished app of the official Learn course on PostgreSQL — built for production and served,
with the Learn app's default accounts and the step pack's test data on request; a CLI tool that runs
`next` and the app's package manager; the
[Next.js step pack](https://github.com/webship/nextjs-steps) wired into the workspace's testing setup;
and its AI items — two agents, a skill, a command and two prompts — each listed in the workspace
folder of its kind.

The workspace is container-based (DDEV by default): a Next.js project is a row like any other, so the
row menus the core draws (start, stop, launch, backup, clone, remove, tests) work on it unchanged.

It is made from the reference platform plugin, `@webship.co/workspace-wordpress`, and runs its app
the way the Gatsby and Astro plugins run theirs: a generic container project whose web container
serves the app.

## Use it

```bash
cd ~/workspace
bash core/scripts/plugins.sh --require @webship.co/workspace-nextjs --with-needs   # npm install into the dashboard
bash core/scripts/plugins.sh --activate nextjs --with-needs                         # plugins.nextjs in settings.yml
bash core/scripts/plugins.sh --install nextjs                                       # commands, functions, args, AI items
bash core/scripts/plugins.sh --configure nextjs                                     # nothing to configure: it has no settings file
```

The same four steps are buttons on the dashboard's **Settings → Plugins** page. `--install` is
idempotent. `--uninstall` removes what it placed; an AI item you edited stays.

Everything the plugin carries lands in the folder it belongs to, when that folder is an active
workspace folder:

| What | Lands in |
| --- | --- |
| `cmd-nextjs-project.sh`, `cmd-tools-nextjs-cli.sh` | every active sites folder: `dev/`, `test/`, `sandboxes/`, `demos/` |
| The agents `nextjs-site-builder`, `nextjs-tester` | `ai-agents/` |
| The skill `nextjs-scenarios` | `ai-skills/` |
| The command `/nextjs-test` | `ai-commands/` |
| The prompts `nextjs-build-and-test`, `nextjs-scenarios-for-a-page` | `ai-prompts/` |

There they are listed like any other item of the folder, and installed into Claude Code from there.

## What it needs

A workspace starts empty, so the manifest says what else this plugin needs (`needs`):

- one sites folder, for the builder and the tool: `dev`, `test`, `sandboxes`, `demos` (`dev` is the one added when none is there). The folder also carries `cmd-tools-testing.sh` and the Users tools this plugin's hooks answer to.
- `ai-agents`, `ai-skills`, `ai-commands` and `ai-prompts`: the AI folders its agents, its skill, its command and its prompts are placed in.

`--require` says so, `--activate` and `--install` stop until the workspace has them, and `--with-needs` adds what is missing first:

```bash
bash core/scripts/plugins.sh --activate nextjs --with-needs   # dev and the four AI folders are required, activated and installed first
bash core/scripts/plugins.sh --install nextjs
```

Everything the builder runs for an app runs in the app's own container, through the container tool the workspace already needs: `create-next-app`, npm, pnpm, `next build` and the app's server all run there, with the Node.js of the workspace (24). The plugin asks for no command of its own on the machine.

## What the package holds

| Path | What it is |
| --- | --- |
| `commands/cmd-nextjs-project.sh` | The builder, in the Build list as **Next.js (default app or the Learn course's app)**, installed into every sites folder |
| `commands/cmd-tools-nextjs-cli.sh` | `next` and the package manager for one app: what the app is, a `next` command, the package manager, a production build, the development server, an update, the test data, the default accounts |
| `scripts/functions/fun-nextjs.sh` | The bash functions behind both, sourced by bootstrap once installed; the names the core's tools look for (`set_nextjs_users`, `add_nextjs_users`, `cancel_nextjs_users`, `testing_configure_nextjs`) |
| `scripts/args/arg-nextjs.sh`, `arg-nextjs-cli.sh` | Their argparse; the Build form draws the builder's flags from the first |
| `scripts/node/nextjs-test-app.cjs` | The Learn app's accounts and the step pack's test data, written into the app's own tables with its own packages (the same as the step pack's build) |
| `scripts/node/nextjs-session-route.ts` | The one route the Learn app gets for the step pack: `/api/auth/session`, the session of the browser as JSON |
| `testing/site.feature`, `testing/default-site.feature` | The first feature a project gets when testing is set up: the Learn app's, the default app's |
| `ai/agents/nextjs-site-builder.md` | The agent that builds and maintains Next.js apps with these commands |
| `ai/agents/nextjs-tester.md` | The agent that writes and runs scenarios with the Next.js step pack |
| `ai/skills/nextjs-scenarios/` | The skill: the step pack's phrases by area, the traps found on real apps, three example features |
| `ai/commands/nextjs-test.md` | The slash command `/nextjs-test <app>`: set up, match every step, run, report |
| `ai/prompts/nextjs-build-and-test.md`, `nextjs-scenarios-for-a-page.md` | Two prompts: whole launch commands for a new session |
| `src/index.ts` | `register(api)`: what the assistant is told about Next.js here |
| `features/nextjs.feature` | Scenarios for the dashboard's own browser suite |

The `workspacePlugin` block in `package.json` is the manifest the installer reads.

## What is different from a platform with a project type

DDEV has no project type for Next.js. The plugin keeps the shape of the reference and changes
only this:

| | WordPress (the reference) | Next.js |
| --- | --- | --- |
| Project | `--project-type=wordpress` | `--project-type=generic --webserver-type=generic --docroot=""`: the router sends the project's address to the app's server on port 3000, which the web container runs as a daemon (`next start`, or `next dev`); PostgreSQL 17 with TLS for the Learn app (`--database=postgres:17`), no database for the default app |
| Layout | The site at the project root | The app in `site/`, the testing stack at the top of the project: the app's own `package.json` stays apart |
| Recognised by | The DDEV project type | Its files: `.ddev/config.nextjs.yaml`, and `.ddev/nextjs-example` (`learn` or `default`) |
| Getting the code | `wp core download` | `create-next-app`: its defaults, or `--example` with the Learn course's finished app (at a pinned commit, with pnpm), moved to the release asked for (`--next-version`, 16.4.6 by default) |
| Install | `wp core install` | For the Learn app: the course's own `/seed` route on the development server (the dashboard's start page is prerendered with its data), then `next build` and `next start` |
| Accounts | WP-CLI | `scripts/node/nextjs-test-app.cjs`, run by the app's Node.js with its own packages for the time of the call |
| Users menu of the row | Reads the project type | Does not apply (the type is `generic`): `cmd-tools-nextjs-cli.sh <name> --add-users`, or `cmd-tools-add-users.sh <name> nextjs` |

## The commands

Run them from a sites folder. `--help` is safe on both.

### Build an app

```bash
cd ~/workspace/dev
bash cmd-nextjs-project.sh myapp --install --add-users --example learn --test-data
```

| Flag | What it does |
| --- | --- |
| `--example <x>` | `default` (the default): the app `create-next-app` makes with its defaults (App Router), no login, no database. `learn`: the finished app of the official Learn course, a dashboard of invoices and customers with a login, on PostgreSQL |
| `--install` | Build the app for production and serve it; the Learn app is seeded by the course's own seed first |
| `--add-users` | With `--install` and `--example learn`: add the default accounts |
| `--test-data` | With `--install` and `--example learn`: the test data of the step pack, the customers "Ivy Example" and "Oak Example" and their invoices |
| `--next-version <x>` | The release: 16.4.6 (the default, the current release and the Active LTS line) or another, such as 15.5.29 (the Maintenance LTS line) |
| `--development` | With `--install`: serve the development server instead of the production build |
| `--launch` | Open the app when it is ready |

The app answers at `https://myapp.ddev.site`. The build runs `ddev config --project-type=generic`
with the Node.js of the workspace (24) baked into the web image with pnpm, makes the app in `site/`,
adds the project's address to `allowedDevOrigins` of its `next.config` (the release refuses its
development resources to another origin), and with `--install` builds and serves it. For the Learn
app it also writes the database settings of the container and a session secret into `site/.env`,
gives PostgreSQL a self-signed certificate (the app connects with `ssl: 'require'`), renames the
course's `proxy.ts` to `middleware.ts` on the 15.x line, adds the step pack's session route, and
creates the `uuid-ossp` extension before the course's seed runs (its three tables create it at the
same moment, which the database refuses for all but one). A project of the same name is deleted
first.

### Work on an app

```bash
bash cmd-tools-nextjs-cli.sh myapp                      # release, address, how it is served, accounts
bash cmd-tools-nextjs-cli.sh myapp --run "info"         # a next command, with its arguments
bash cmd-tools-nextjs-cli.sh myapp --npm "ls next"      # the app's package manager: pnpm (Learn) or npm
bash cmd-tools-nextjs-cli.sh myapp --build              # a new production build, served
bash cmd-tools-nextjs-cli.sh myapp --dev                # the development server instead
bash cmd-tools-nextjs-cli.sh myapp --restart            # served again, as it was served
bash cmd-tools-nextjs-cli.sh myapp --update             # the latest release of Next.js, built and served
bash cmd-tools-nextjs-cli.sh myapp --test-data          # the step pack's test data of the Learn app, again
bash cmd-tools-nextjs-cli.sh myapp --add-users          # the default accounts of the Learn app
bash cmd-tools-nextjs-cli.sh myapp --cancel-users       # remove them
```

### The default accounts

| Handle in the tests | Address | Name | What it may do |
| --- | --- | --- | --- |
| `administrator` | `administrator@example.com` | Administrator | everything (the Learn app has no roles) |
| `editor` | `editor@example.com` | Editor | everything, as the other one |

The Learn app logs in by address. Each account has the password of the workspace's other default
lists. They are for local apps and for tests. The course's own account stays as its seed makes it and
is never written into a test. The default app has no login and no accounts.

The dashboard's Users menu of a project row picks its actions by the container project type, which
says `generic` for a Next.js app: manage the accounts with the CLI tool instead —
`bash cmd-tools-nextjs-cli.sh <name> --add-users` adds them (an account that is there already gets its
name and password back), `bash cmd-tools-nextjs-cli.sh <name> --cancel-users` removes them, and
`bash cmd-tools-nextjs-cli.sh <name>` lists the accounts of the app. `bash cmd-tools-add-users.sh
<name> nextjs` adds the same list.

### Test an app

```bash
bash cmd-tools-testing.sh myapp                 # webship-js, the step pack, the users registry, a first feature
bash cmd-tools-testing.sh myapp --run           # run the suite in the container
bash cmd-tools-testing.sh myapp --run --path tests/features/site.feature
```

`cmd-tools-testing.sh` is the workspace's own. For a Next.js project it also adds
`@webship-js/nextjs-steps` to `package.json`, lists its step definitions in `cucumber.js` after
webship-js's own, writes the tags that keep the pack's assertions that must fail out of a normal run,
and for the Learn app the login page, the session address and the users registry (the handles above,
overridable with `NEXTJS_<HANDLE>_EMAIL`, `NEXTJS_<HANDLE>_PASSWORD` and `NEXTJS_<HANDLE>_NAME`), and
places `tests/features/site.feature` when the project has none. The testing stack lives at the top of
the project, beside `site/`. Run it again and it adds what is missing and keeps what you changed.

`tests/features/site.feature` passes on the Learn app built with `--install --add-users --example
learn` (the default app gets its own first feature). The features of the step pack tagged `@learn`
run on the Learn app built with `--test-data` as they are: the test data and the accounts are the
same as the pack's own build.

## The AI items

| Item | Kind | What it does |
| --- | --- | --- |
| `nextjs-site-builder` | agent | Builds, maintains and removes Next.js apps with the builder, the CLI tool and the workspace's own tools; containers only |
| `nextjs-tester` | agent | Writes and runs scenarios with the step pack: the Playwright MCP browser first, then the scenario; never an account created by a suite, never a platform name in a step phrase |
| `nextjs-scenarios` | skill | The step pack's phrases by area, the traps found on real apps, three example features that pass on the Learn app with its test data |
| `/nextjs-test <app>` | command | Set the testing stack up when missing, match every step, run the suite (or a feature, or a tag), report |
| `nextjs-build-and-test` | prompt | A new session that builds an app and runs its first feature |
| `nextjs-scenarios-for-a-page` | prompt | A new session that writes and runs the scenarios of one page: hydration, navigation, loading states, forms |

Every phrase an item shows is a phrase of the step pack or of webship-js
(`tests/fixtures/step-definitions.txt`, read from the pack at the version the builder pins), and every
command and flag it names exists: the tests check both.

## Develop it

```bash
npm install
npm run lint && npm test         # the manifest, the commands, the functions, the items
git ls-files -z '*.sh' | xargs -0 -n1 bash -n
```

Prove it in a throwaway workspace before a release: `webship-workspace init`, then require the plugin
from its packed tarball, activate and install it with `--with-needs`; check that Settings lists it, the
Build list of `dev` offers the builder, and each AI folder lists its items; build one real app with
`--install --add-users --example learn --test-data`, run `cmd-tools-testing.sh <name>` and its first
feature; then uninstall and check that nothing is left behind.
