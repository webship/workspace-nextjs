#!/usr/bin/env bash

argparse "$@" <<ARGEOF || exit 1
parser.add_argument('PROJECT_NAME',
                    help='The Next.js app in this workspace.')
parser.add_argument('-r', '--run',
                    default="_none_",
                    help='A next command of the app, with its arguments. Example: --run "info"')
parser.add_argument('-m', '--npm',
                    default="_none_",
                    help='The package manager of the app (pnpm for the Learn app, npm for the default app), with its arguments. Example: --npm "ls next"')
parser.add_argument('-b', '--build',
                    action='store_true',
                    default=False,
                    help='Build the app for production (next build) and serve the new build.')
parser.add_argument('-d', '--dev',
                    action='store_true',
                    default=False,
                    help='Serve the development server (next dev) instead of the production build; --build goes back.')
parser.add_argument('-s', '--restart',
                    action='store_true',
                    default=False,
                    help='Serve the app again, as it was served (production or development).')
parser.add_argument('-u', '--update',
                    action='store_true',
                    default=False,
                    help='Update Next.js to its latest release, then build for production and serve the new build.')
parser.add_argument('-t', '--test-data',
                    action='store_true',
                    default=False,
                    help='Make the test data of the step pack again in the Learn app (the customers Ivy Example and Oak Example and their invoices).')
parser.add_argument('-a', '--add-users',
                    action='store_true',
                    default=False,
                    help='Add the default accounts of the Learn app. An account that is already there gets its name and password back.')
parser.add_argument('-x', '--cancel-users',
                    action='store_true',
                    default=False,
                    help='Remove the default accounts of the Learn app.')
ARGEOF
