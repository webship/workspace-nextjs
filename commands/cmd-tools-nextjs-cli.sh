#!/usr/bin/env bash

# Installed by the Next.js plugin (plugins.sh --install nextjs); __WORKSPACE__ is the workspace it was installed into.
#
# next and npm for one Next.js app of this workspace, in its container: say what the app is, run a next
# command or the app's package manager, build it for production and serve it, serve the development
# server, serve it again, update Next.js, make the Learn app's test data again, add or remove its
# default accounts. Nothing here runs on the host.

# Bootstrap.
# Find the workspace tooling from this script, so a fresh clone needs no setup.
WORKSPACE_SCRIPTS="${WORKSPACE_SCRIPTS:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../core/scripts" && pwd)}";
source ${WORKSPACE_SCRIPTS}/bootstrap.sh || exit 1 ;

# Load workspace settings.
eval $(parse_yaml ${WORKSPACE_CONFIG}/workspace.__WORKSPACE__.settings.yml);

# Distribution.
distribution_name="nextjs";

ARGPARSE_DESCRIPTION="Run next and npm for a Next.js app of __WORKSPACE__: status, a next command, the package manager, the production build, the development server, the test data, the default accounts"
# The args file comes with the plugin: core/scripts/plugins/nextjs/ is where plugins.sh --install puts it.
source ${WORKSPACE_SCRIPTS}/plugins/nextjs/args/arg-nextjs-cli.sh || exit 1 ;

shift $#;

nextjs_cli_tool ;
