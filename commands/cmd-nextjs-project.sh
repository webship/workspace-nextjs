#!/usr/bin/env bash

# workspace-name: Next.js (default app or the Learn course's app)

# Installed by the Next.js plugin (plugins.sh --install nextjs); __WORKSPACE__ is the workspace it was installed into.
#
# Build a Next.js app in a container, made with create-next-app, at https://<name>.ddev.site: the app it
# makes with its defaults, or with --example learn the finished app of the official Learn course on
# PostgreSQL in a container of the project. With --install the app is built for production and served
# (the Learn app seeded first by the course's own seed); --add-users adds the default accounts of the
# Learn app and --test-data the test data the step pack's features use.

# Bootstrap.
# Find the workspace tooling from this script, so a fresh clone needs no setup.
WORKSPACE_SCRIPTS="${WORKSPACE_SCRIPTS:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../core/scripts" && pwd)}";
source ${WORKSPACE_SCRIPTS}/bootstrap.sh || exit 1 ;

# Load workspace settings.
eval $(parse_yaml ${WORKSPACE_CONFIG}/workspace.__WORKSPACE__.settings.yml);

# Distribution.
distribution_name="nextjs";
distribution_title="Next.js";
distribution_webroot="";

ARGPARSE_DESCRIPTION="Build a ${distribution_title} app in __WORKSPACE__"
# The args file comes with the plugin: core/scripts/plugins/nextjs/ is where plugins.sh --install puts it.
source ${WORKSPACE_SCRIPTS}/plugins/nextjs/args/arg-nextjs.sh || exit 1 ;

shift $#;

nextjs_build ;
