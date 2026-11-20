Write and run webship-js scenarios for what one page of a Next.js app does while it loads, navigates and sends its forms.

The launch command below is for Claude Code, the default; the text between the triple quotes can be given to another AI CLI as it is.

```
claude --permission-mode bypassPermissions """
Write scenarios for the page <path> of this app: how it hydrates, loads, navigates and sends its forms, and run them
# ~/workspace/<folder>/<app> · https://<app>.ddev.site · container-based (DDEV by default)
# the phrases are in the nextjs-scenarios skill; the nextjs-tester agent is the one to hand this work over to
# look at the app first: in the Playwright MCP browser, in a tab of your own, open the page as the account of the scenario and do each thing by hand once
# a feature to write or a run to read: the book Automated Functional Testing Recipes first (its README.md, then the matching chapter), from .claude/automated-functional-testing-recipes/ in the project, ~/.claude/automated-functional-testing-recipes/ or https://github.com/webship/webship-js-ai-agent/tree/2.0.x/automated-functional-testing-recipes

What to cover:
<what the page shows, its links, its loading states and its forms, one per line>

Read the installed steps first:
grep -hE '^(Given|When|Then)\(' node_modules/@webship-js/nextjs-steps/tests/step-definitions/*.steps.js

Write one feature in tests/features/<page>.feature, from phrases that exist: the page hydrated and ready,
each link opened without a full page reload and announced, the parts that show a loading state on a slow
network, each form's errors next to its fields and its message, and what a not-found or a failing address shows.
Log in by the handle of the users registry (administrator, editor): no password in the feature, no account
created by a scenario, no platform name in a step phrase, no sleep (wait for the page to be ready instead),
and what a scenario changes it changes back (an invoice created is deleted, an amount changed is put back).

Then, from the sites folder (cd ..):
bash cmd-tools-testing.sh <app> --dry-run --path tests/features/<page>.feature
bash cmd-tools-testing.sh <app> --run --path tests/features/<page>.feature

A failing scenario is a result: tell me what the app did, do not loosen the scenario.
When you are done: the scenarios, the result of the run, and any step you could not find in the pack
"""
```
