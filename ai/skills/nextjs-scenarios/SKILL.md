---
name: nextjs-scenarios
description: Write and run webship-js scenarios for a Next.js app of the Webship Workspace with the Next.js step pack (`@webship-js/nextjs-steps`) — the phrases of the pack by area (hydration and the page ready, client-side navigation and the route announcer, prefetching, streaming and loading states, form actions and their errors, not-found and error pages, images, prerendered pages and the production build, the development error overlay, the session), the handles of the users registry, and the workspace command that runs them in the app's container. Use when asked to "write a scenario for this Next.js app", "test the loading state of the list", "which step is there for a form's errors", "add a feature for the not-found page", or when a `.feature` file of a Next.js project is being written or fixed.
argument-hint: '<app> [what to cover]'
---

# nextjs-scenarios

Scenarios for a Next.js app of a Webship Workspace (`~/workspace`, container-based, DDEV by default),
written from the steps of [`@webship-js/nextjs-steps`](https://github.com/webship/nextjs-steps) and of
[webship-js](https://github.com/webship/webship-js) itself, and run in the app's container by the
workspace's own command. It comes with the Next.js plugin (`@webship.co/workspace-nextjs`), like the
builder (`cmd-nextjs-project.sh`), the CLI tool (`cmd-tools-nextjs-cli.sh`) and the agents
`nextjs-site-builder` and `nextjs-tester`.

## Where everything is

| What | Where |
| --- | --- |
| The app | `~/workspace/<folder>/<app>`, at `https://<app>.ddev.site` (`<folder>` is a sites folder: `dev`, `test`, `sandboxes`, `demos`) |
| Its code | `<app>/site/` (which app: `<app>/.ddev/nextjs-example`, `learn` or `default`) |
| The suite's configuration | `<app>/cucumber.js`: the step definitions it loads, the users registry (`worldParameters.users`), the login page and the session address |
| The features | `<app>/tests/features/*.feature` (`site.feature` is the first one the setup wrote) |
| The pack's steps | `<app>/node_modules/@webship-js/nextjs-steps/tests/step-definitions/*.steps.js` |
| webship-js's steps | `<app>/node_modules/webship-js/tests/step-definitions/*.js` |
| The reports | `<app>/tests/reports/` |

## The order of work

1. **Make sure the testing stack is there.** From the sites folder:
   ```bash
   cd ~/workspace/<folder>
   bash cmd-tools-testing.sh <app>
   ```
   It adds webship-js, the step pack, the tags, `tests/features/site.feature` and, for the Learn app,
   the users registry. It is safe to run again: it adds what is missing and keeps what was changed.
2. **Read the installed steps before writing a phrase.** They are the source of truth: the pack
   moves, and a phrase from memory is a guess.
   ```bash
   grep -hE "^(Given|When|Then)\(" <app>/node_modules/@webship-js/nextjs-steps/tests/step-definitions/*.steps.js
   ```
3. **Look at the page in the Playwright MCP browser first**, in a tab of your own, as the account of
   the scenario: what it shows, what it does while it loads or sends a form, the exact messages.
4. **Match every step, then run**, narrow first:
   ```bash
   bash cmd-tools-testing.sh <app> --dry-run --path tests/features/<name>.feature
   bash cmd-tools-testing.sh <app> --run --path tests/features/<name>.feature
   ```

## The phrases, by area

**The page ready and hydrated**

| Phrase | What it checks |
| --- | --- |
| `When I wait for the page to be ready` | Loaded, hydrated, no part showing a loading state, no request of the app running |
| `Then I should see a hydrated page` | The app took over the server's HTML |
| `Then there should be no hydration errors` | The console reported no mismatch between the server's HTML and the first render |
| `Then the site should be served as a production build` | No development tools, no development server |
| `Then the page should be served by the app router` | Or `by the pages router` |
| `Then the page should be prerendered` | Or `should not be prerendered`: rendered for each request |

**Navigation**

| Phrase | What it checks |
| --- | --- |
| `When I click the link "Invoices" without a full page reload` | The link, once hydrated, opens its page in the same document |
| `When I go back without a full page reload` | Or `go forward` |
| `Then the route announcer should announce "Invoices"` | What a screen reader hears after a navigation (the title, or its start) |
| `Then the page "/dashboard/invoices" should be prefetched` | The router fetched it ahead of a click (production builds only) |

**Loading states**

| Phrase | What it does |
| --- | --- |
| `Given the network is slow` | Chromium's own slow network: the parts of a page stream in one by one (`the network is no longer slow` ends it) |
| `When I start to go to "/dashboard/invoices"` | Starts a page load without waiting for its end |
| `Then a part of the page should show its loading state` | A streamed part waits for its content, or a Suspense fallback shows |
| `Then no part of the page should show its loading state` | Every part has its content |
| `Given the server's answers are held back` | The answers of navigations, form actions and page data wait… |
| `When the server's answers come through` | …until this step |
| `Then the page should be waiting for the server` | A request of a navigation, a form or the data is on its way |
| `When I wait for the page to finish loading` | The longer wait, for a slow network |

**Forms**

| Phrase | What it checks |
| --- | --- |
| `When I send the form with "Create Invoice"` | Sends the form and waits for its action and the page that follows; `in the "$42.17" row` for a row's button |
| `Then the field "Choose customer" should show the error "Please select a customer."` | The text the field's `aria-describedby` names (a group by its legend) |
| `Then the form should show the message "Missing Fields. Failed to Create Invoice."` | A live region of the form |
| `Then the "Log in" button should be busy` | Disabled, `aria-disabled` or `aria-busy` while the action runs (hold the answers back to see it) |
| `Then the form should have been sent without a full page reload` | The action ran through the app's request, in the same document |

**Not-found and error pages**

| Phrase | What it checks |
| --- | --- |
| `Then I should be on a 404 page` | The page answered 404 (or carries the framework's not-found marks) |
| `Then I should be on the default 404 page` | The framework's own "404 / This page could not be found." |
| `Then the error page should show "Something went wrong!"` | An error boundary's page, for an error that did happen |
| `Then the page should not show the details of the error` | No stack trace and no overlay (a production build) |

**Images** (by their alternative text)

| Phrase | What it checks |
| --- | --- |
| `Then the image "Oak Example's profile picture" should load lazily` | `loading="lazy"` |
| `Then the image "logo" should be preloaded` | A `<link rel="preload" as="image">` for it |
| `Then the image "…" should be optimized` | It comes from the image optimizer (`/_next/image`) |
| `Then the image "…" should be served as "image/webp"` | The format the optimizer sends |
| `Then the image "…" should have a width and a height` | No layout shift when it arrives |
| `Then the image "…" should have loaded` | Or `should not have loaded` (a hidden one never loads) |
| `When I scroll the image "…" into view` | Brings it into view and waits for it to load |

**The development server** (`bash cmd-tools-nextjs-cli.sh <app> --dev` first, `--build` after)

| Phrase | What it checks |
| --- | --- |
| `Then the development tools should be on the page` | The development server's indicator |
| `Then the development error overlay should be shown` | Its error overlay; `should show "…"` its words, `should list 2 errors` its count |
| `Then the page should show the details of the error` | The overlay, or a stack trace |

**The session** (the Learn app)

| Phrase | What it does |
| --- | --- |
| `Given I am a logged in user with the "editor" user` | Logs in by the handle (a session taken over when the account has one) |
| `When I log in as "editor" with the login form` | Through the form, always |
| `When I log in with the email "nobody@example.com" and the password "wrong-password"` | For the refusals |
| `When I fill in the login form as "editor"` | Fills in without sending (for the busy button) |
| `When I log out` | The app's "Sign Out" |
| `Then I should be logged in as "editor"` | Who the session address says is signed in; `I should not be logged in` |
| `Then I should see the login form` | And `the login form should send me back to "/dashboard"` |

webship-js's own steps do the rest: `I fill in "…" with "…"`, `I select "…" from "…"`, `I choose the
radio button "…"`, `I press "…"`, `I click "…"`, `I should see "…"`, `the path should be "…"`,
`current url should have the "query" parameter with the "Oak" value`, `the response status code
should be 404`, `I set the viewport to 375 by 667`.

## Traps found on a real app

- **A button is visible before its form is hydrated.** A click then does what plain HTML does. The
  pack's steps wait for the element to be hydrated; a click with webship-js's own `I press` after
  `I wait for the page to be ready` is safe too.
- **On a fast local app a loading state is over before a step looks.** Slow the network down or hold
  the answers back; never add a sleep.
- **While a navigation's answer is on its way, the router keeps the old page** and marks nothing as
  busy: `the page should be waiting for the server` is the only thing to assert.
- **The 15.x line keeps the old list while a search streams in** and shows no loading state in
  between; the 16.x line shows the list's fallback.
- **A lazy image near the window loads anyway**: the browser loads lazy images some way ahead of the
  window. A hidden one (`display: none`) never loads.
- **The search box of the Learn app has a label that is not tied to it**: fill it in by its
  placeholder, `I fill in "Search invoices..." with "Oak"`.
- **The browser logs "Failed to load resource" for a 404 or a 500**: tag those scenarios `@js-off`.

## Rules

- **Never create an account in a suite.** The accounts are in the app before the suite runs.
- **No password in a feature file**, except where a wrong password is the subject.
- **No platform name in a step phrase**: `I click the link "Invoices" without a full page reload`,
  never a phrase that names the framework or its libraries. The same holds for a custom step.
- **What a scenario changes, it changes back** in the same scenario.
- **A custom step is the last resort**: look in the pack and in webship-js first, write it in
  `<app>/tests/step-definitions/` with a comment block and examples, and say it may belong in
  the pack.
- **Everything runs in the container**, through `cmd-tools-testing.sh`. Never `npx cucumber-js`
  or `npx playwright` on the host.
- **A failing scenario is a result.** No `@wip`, no longer timeout, no looser assertion to turn a
  run green: say what the app did.

## Examples that run

`examples/` holds three features that pass on the Learn app built with
`bash cmd-nextjs-project.sh <app> --install --add-users --example learn --test-data`, and leave it as
they found it. Copy one into the suite and run it:

- `examples/navigation.feature`: the side navigation without a full page reload, the route announcer, back and forward, prefetching.
- `examples/forms.feature`: the errors of the server next to each field, an invoice created and deleted.
- `examples/loading.feature`: a loading state on a slow network, a navigation whose answer is held back.

```bash
cp ~/workspace/ai-skills/nextjs-scenarios/examples/forms.feature ~/workspace/<folder>/<app>/tests/features/
cd ~/workspace/<folder>
bash cmd-tools-testing.sh <app> --run --path tests/features/forms.feature
```

## The book

For any automated functional testing in this work (a Gherkin feature, a step definition, choosing a
step, a test run and its failures), read the book *Automated Functional Testing Recipes* first.

- **Where.** Use the first that exists: `.claude/automated-functional-testing-recipes/` in the project,
  `~/.claude/automated-functional-testing-recipes/` (installed by webship/webship-js-ai-agent,
  webship/webship-js-skills or webship/ai-agents), or
  https://github.com/webship/webship-js-ai-agent/tree/2.0.x/automated-functional-testing-recipes
- **How.** Its `README.md` first, then the chapter that matches the task (one file per chapter,
  named by its subject), not the single complete file.
- **Which wins.** The installed webship-js package and the step pack are the source of truth for
  step phrasing. When they differ from the book, follow them and say so.
- **For Next.js.** Start with `ch27-testing-spa.md` (client-side navigation, history and lazy parts),
  `ch07-waiting-dynamic-content.md` (waiting on the app's own signals, never on a clock),
  `ch10-authentication-authorization.md` (logins, sessions and protected pages) and
  `ch21-when-tests-go-bad.md` (flaky, brittle and slow scenarios).
