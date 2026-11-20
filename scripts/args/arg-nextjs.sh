#!/usr/bin/env bash

argparse "$@" <<ARGEOF || exit 1
parser.add_argument('PROJECT_NAME',
                    help='The name of the project: its folder, its DDEV project and its host name.')
parser.add_argument('-e', '--example',
                    default="default",
                    choices=['default', 'learn'],
                    help='The app: the one create-next-app makes with its defaults (App Router), or the finished app of the official Learn course (a dashboard with a login, on PostgreSQL). [default %(default)s]')
parser.add_argument('-i', '--install',
                    action='store_true',
                    default=False,
                    help='Build the app for production and serve it at the address of the project (the Learn app is seeded by the course\'s own seed first).')
parser.add_argument('-a', '--add-users',
                    action='store_true',
                    default=False,
                    help='With --install and --example learn, add the default accounts: the ones the test scenarios log in as. The default app has none.')
parser.add_argument('-t', '--test-data',
                    action='store_true',
                    default=False,
                    help='With --install and --example learn, add the test data of the step pack: the customers Ivy Example and Oak Example and their invoices.')
parser.add_argument('-n', '--next-version',
                    default="16.4.6",
                    help='The release of Next.js the app runs on (16.4.6 is the current release and the Active LTS line, 15.5.29 the Maintenance LTS line). Example: --next-version 15.5.29')
parser.add_argument('-d', '--development',
                    action='store_true',
                    default=False,
                    help='With --install, serve the development server (next dev) instead of the production build.')
parser.add_argument('-l', '--launch',
                    action='store_true',
                    default=False,
                    help='Open the app in a browser when it is ready.')
ARGEOF
