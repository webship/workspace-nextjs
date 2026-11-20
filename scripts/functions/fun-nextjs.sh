#!/usr/bin/env bash

# Next.js for the Webship Workspace: make an app with create-next-app (the app it makes with its
# defaults, or the finished app of the official Learn course on PostgreSQL), build it for production
# and serve it, run next and npm on it, add its accounts and its test data, and wire its step pack
# into the testing setup.
#
# Placed by `plugins.sh --install nextjs` in core/scripts/plugins/nextjs/functions/, where bootstrap
# sources it after the core's own functions. Everything runs in the project's container (DDEV by
# default), never on the host: the app is a Node.js project in the project's site/ folder, the web
# container builds it and serves it as a daemon (`next start`, or `next dev`), and the router serves
# that at the project's address. The Learn app's database is PostgreSQL in a container of the project.
#
# DDEV has no project type for Next.js, so a Next.js project is recognised by a file
# (.ddev/config.nextjs.yaml, written by the builder), and four names are the ones the core's tools
# look for:
#   set_nextjs_users          the default accounts of the Learn app  (cmd-tools-add-users.sh <project> nextjs)
#   add_nextjs_users          write them into the app's users table  (the same tool, and --add-users of the builder)
#   cancel_nextjs_users       remove them                            (cmd-tools-cancel-users.sh <project> nextjs)
#   testing_configure_nextjs  the step pack in the testing stack     (cmd-tools-testing.sh <project>)
# The project type is generic, which the Users menu of the dashboard does not know: the accounts of a
# project are managed with cmd-tools-nextjs-cli.sh <project> --add-users / --cancel-users.

# The step pack a Next.js app is tested with, and the release line it is required at.
readonly NEXTJS_STEPS_PACKAGE='@webship-js/nextjs-steps';
readonly NEXTJS_STEPS_VERSION='^2.0.0';

# Where the app lives in the web container, and the port its server listens on.
readonly NEXTJS_SITE='/var/www/html/site';
readonly NEXTJS_PORT='3000';

# The release an app is made on unless --next-version says otherwise (16.4.6 is the current release
# and the Active LTS line; 15.5.29 is the Maintenance LTS line).
readonly NEXTJS_DEFAULT_VERSION='16.4.6';

# The commit of the Learn course's repository the Learn app is made from (its dashboard/final-example).
readonly NEXTJS_LEARN_REF='bb2558441a6673ab76c89914c25018bffa27a2ba';

# The Node.js scripts the plugin places with itself in core/scripts/plugins/nextjs/: the accounts and
# the test data of the Learn app (written into its own tables with its own packages), and the one
# route the Learn app gets for the step pack (the session of the browser as JSON).
NEXTJS_TEST_APP="${WORKSPACE_SCRIPTS}/plugins/nextjs/nextjs-test-app.cjs";
NEXTJS_SESSION_ROUTE="${WORKSPACE_SCRIPTS}/plugins/nextjs/nextjs-session-route.ts";

# The default accounts of the Learn app, the ones a scenario logs in as. The app has no roles: both
# can do everything. Accounts are configuration, created once in the app; a test suite never creates
# or deletes one. The course's own account stays as its seed makes it.
#   administrator  administrator@example.com
#   editor         editor@example.com
function set_nextjs_users() {
  users=(administrator editor);
  local user ;
  for user in "${users[@]}" ; do
    printf -v "user_${user}_name" '%s' "${user}" ;
    printf -v "user_${user}_mail" '%s' "${user}@example.com" ;
    printf -v "user_${user}_password" '%s' 'dD.123123ddd' ;
  done
  user_administrator_fullname='Administrator' ;
  user_editor_fullname='Editor' ;
}

# Is this folder a Next.js project? The builder leaves .ddev/config.nextjs.yaml in it.
function nextjs_is_project() {
  local project_path="$1";
  [ -f "${project_path}/.ddev/config.nextjs.yaml" ] ;
}

# Which app the project has: learn or default (the builder writes it in .ddev/nextjs-example).
function nextjs_example() {
  local project_path="${1:-.}";
  cat "${project_path}/.ddev/nextjs-example" 2>/dev/null || echo default ;
}

# Go to the project a tool was asked about, or say why not.
function nextjs_enter_project() {
  local project_path="${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME}";
  if [ ! -d "${project_path}" ] ; then
    echo "No project ${PROJECT_NAME} in ${WORKSPACE_ROOT}/${doc_name}." ;
    return 1 ;
  fi
  if ! nextjs_is_project "${project_path}" ; then
    echo "${doc_name}/${PROJECT_NAME} is not a Next.js project (it has no .ddev/config.nextjs.yaml)." ;
    return 1 ;
  fi
  cd "${project_path}" || return 1 ;
}

# What the container tool is told about the app: the router sends the project's address to the app's
# server, which the web container runs as a daemon; Node.js 24 and pnpm (the Learn course's package
# manager) are in the web image itself, so the server has them before anything starts, on every
# restart, on a slow connection and offline. For the Learn app: PostgreSQL with TLS, as the app asks
# for it (ssl 'require'; the certificate is the self-signed one of the PostgreSQL image).
function nextjs_write_ddev_config() {
  local project_path="$1" nodejs_version="$2" example="$3";
  mkdir -p "${project_path}/.ddev/web-build" || return 1 ;
  cat > "${project_path}/.ddev/config.nextjs.yaml" <<YAMLEOF
# Next.js in this project. Written by the Next.js builder of the workspace; build again rather than
# editing by hand. The web container serves no files of its own: the router sends ports 80 and 443 of
# the project's address to the app's server on port ${NEXTJS_PORT}, which the web container runs as a
# daemon (.ddev/nextjs-serve.sh): the production build, or the development server.
web_environment:
  - NEXT_TELEMETRY_DISABLED=1
web_extra_exposed_ports:
  - name: nextjs
    container_port: ${NEXTJS_PORT}
    http_port: 80
    https_port: 443
web_extra_daemons:
  - name: nextjs
    command: "bash /var/www/html/.ddev/nextjs-serve.sh"
    directory: /var/www/html
YAMLEOF
  cat > "${project_path}/.ddev/nextjs-serve.sh" <<SERVEEOF
#!/usr/bin/env bash
# Serves the app on port ${NEXTJS_PORT}: its production build (next start), or the development server
# (next dev) when .ddev/nextjs-mode says "development". Run by the web container's supervisor.
# Written by the Next.js builder of the workspace.
cd ${NEXTJS_SITE} 2>/dev/null || { sleep 5; exit 1; }
mode="\$(cat /var/www/html/.ddev/nextjs-mode 2>/dev/null || echo production)"
if [ ! -x node_modules/.bin/next ]; then sleep 5; exit 1; fi
if [ "\$mode" = "development" ]; then
  exec node_modules/.bin/next dev --port ${NEXTJS_PORT} --hostname 0.0.0.0
fi
if [ ! -f .next/BUILD_ID ]; then sleep 5; exit 1; fi
exec node_modules/.bin/next start --port ${NEXTJS_PORT} --hostname 0.0.0.0
SERVEEOF
  chmod +x "${project_path}/.ddev/nextjs-serve.sh" ;
  echo production > "${project_path}/.ddev/nextjs-mode" ;
  echo "${example}" > "${project_path}/.ddev/nextjs-example" ;
  cat > "${project_path}/.ddev/web-build/Dockerfile.nextjs" <<DOCKEREOF
# Node.js ${nodejs_version} and pnpm in the web image, so the app's server has them before the
# container's daemons start. Written by the Next.js builder of the workspace.
RUN N_PREFIX=/usr/local n install ${nodejs_version} && node --version && npm install -g pnpm@10.33.0 && pnpm --version
DOCKEREOF
  if [ "${example}" == 'learn' ] ; then
    mkdir -p "${project_path}/.ddev/db-build" || return 1 ;
    cat > "${project_path}/.ddev/db-build/Dockerfile.tls" <<'DOCKEREOF'
# A copy of the image's self-signed certificate that the database server (the postgres user of the
# image) may read: PostgreSQL refuses a key file that it does not own or that others can read.
# Written by the Next.js builder of the workspace.
RUN mkdir -p /etc/postgresql-tls \
 && cp /etc/ssl/certs/ssl-cert-snakeoil.pem /etc/postgresql-tls/server.crt \
 && cp /etc/ssl/private/ssl-cert-snakeoil.key /etc/postgresql-tls/server.key \
 && chmod 0644 /etc/postgresql-tls/server.crt /etc/postgresql-tls/server.key
DOCKEREOF
    cat > "${project_path}/.ddev/docker-compose.postgres-tls.yaml" <<'YAMLEOF'
# PostgreSQL with TLS, as a hosted database has it: the Learn app connects with ssl 'require'.
# Written by the Next.js builder of the workspace.
services:
  db:
    # The key file must belong to the user the server runs as and be readable by it alone: copied at
    # start, then the image's own entrypoint runs with the command below.
    entrypoint:
      - bash
      - -c
      - install -m 0644 /etc/postgresql-tls/server.crt /tmp/server.crt && install -m 0600 /etc/postgresql-tls/server.key /tmp/server.key && exec docker-entrypoint.sh "$$@"
      - postgres-tls
    command:
      - -c
      - config_file=/etc/postgresql/postgresql.conf
      - -c
      - hba_file=/etc/postgresql/pg_hba.conf
      - -c
      - ssl=on
      - -c
      - ssl_cert_file=/tmp/server.crt
      - -c
      - ssl_key_file=/tmp/server.key
YAMLEOF
  fi
}

# A command in the app's folder in the web container, with stdin closed: an open stdin pipe keeps
# some tools waiting for input when a builder runs in the background.
function nextjs_exec() {
  ddev exec -d "${NEXTJS_SITE}" "$*" < /dev/null ;
}

# next and the app's package manager (pnpm for the Learn app, npm for the others) in the container.
function nextjs_cli() {
  nextjs_exec "node_modules/.bin/next $*" ;
}

function nextjs_package_manager() {
  if [ -f site/pnpm-lock.yaml ] ; then echo pnpm ; else echo npm ; fi
}

function nextjs_npm() {
  nextjs_exec "$(nextjs_package_manager) $*" ;
}

# The release of Next.js the app has installed.
function nextjs_version() {
  ddev exec "node -p \"require('${NEXTJS_SITE}/node_modules/next/package.json').version\"" < /dev/null 2>/dev/null | tr -d '\r' ;
}

# Stop the app's server, and wait until its port is free: the server finishes the requests it has
# before it lets the port go, and a server started before that would find the port taken while the
# old one still answers. A server that keeps the port longer is stopped by its port.
function nextjs_stop_server() {
  ddev exec "supervisorctl stop webextradaemons:nextjs" < /dev/null > /dev/null 2>&1 ;
  ddev exec "for i in \$(seq 1 20); do fuser ${NEXTJS_PORT}/tcp >/dev/null 2>&1 || exit 0; sleep 1; done; fuser -k -TERM ${NEXTJS_PORT}/tcp >/dev/null 2>&1; sleep 2; fuser -k -KILL ${NEXTJS_PORT}/tcp >/dev/null 2>&1; exit 0" < /dev/null ;
  return 0 ;
}

# Wait until the app's server answers on its own port.
function nextjs_wait() {
  local path="${1:-/}" attempt ;
  for attempt in $(seq 1 90) ; do
    if ddev exec "curl -fsS -o /dev/null http://127.0.0.1:${NEXTJS_PORT}${path}" < /dev/null > /dev/null 2>&1 ; then
      return 0 ;
    fi
    sleep 2 ;
  done
  echo "The app's server did not start; what it said:" ;
  docker logs --tail 40 "ddev-${PROJECT_NAME}-web" 2>&1 | tail -40 ;
  return 1 ;
}

# The page a server is checked on: the login page of the Learn app (its front page sends a visitor
# who is signed in elsewhere), the front page of the others.
function nextjs_check_path() {
  if [ "$(nextjs_example)" == 'learn' ] ; then echo /login ; else echo / ; fi
}

# Serve the app: "production" builds it for production (next build) and serves the build (next
# start); "development" serves the development server (next dev).
function nextjs_serve() {
  local mode="${1:-production}" ;
  nextjs_stop_server ;
  echo "${mode}" > .ddev/nextjs-mode ;
  if [ "${mode}" == 'production' ] ; then
    echo "Building the app for production (next build)." ;
    nextjs_cli build || { echo "The build of the app failed." ; return 1 ; } ;
  fi
  ddev exec "supervisorctl start webextradaemons:nextjs" < /dev/null > /dev/null || return 1 ;
  nextjs_wait "$(nextjs_check_path)" ;
}

# The development server answers at the project's address, not at localhost: the release refuses
# its development resources (/_next/hmr) to another origin unless next.config names it.
function nextjs_allow_dev_origin() {
  local host="$1" ;
  python3 - "${PWD}/site" "${host}" <<'PYEOF'
import os, re, sys
site, host = sys.argv[1:3]
line = "  // The development server answers at the project's address, not at localhost.\n  allowedDevOrigins: ['%s'],\n" % host
for name in ('next.config.ts', 'next.config.mjs', 'next.config.js'):
    path = os.path.join(site, name)
    if os.path.exists(path):
        src = open(path).read()
        if 'allowedDevOrigins' in src:
            sys.exit(0)
        m = re.search(r'(const nextConfig[^=]*=\s*\{\s*\n|module\.exports\s*=\s*\{\s*\n)', src)
        if not m:
            sys.exit('%s has no config object to add allowedDevOrigins to: add allowedDevOrigins: [\'%s\'] by hand.' % (name, host))
        open(path, 'w').write(src[:m.end()] + line + src[m.end():])
        sys.exit(0)
open(os.path.join(site, 'next.config.mjs'), 'w').write('/** @type {import("next").NextConfig} */\nconst nextConfig = {\n' + line + '};\n\nexport default nextConfig;\n')
PYEOF
}

# Run the plugin's script for the Learn app's accounts and test data (nextjs-test-app.cjs) in the
# app's folder, with the app's own Node.js packages; the script is in the app only for that call.
function nextjs_test_app() {
  if [ ! -f "${NEXTJS_TEST_APP}" ] ; then
    echo "The plugin's test app script is missing: ${NEXTJS_TEST_APP} (install the plugin again)." ;
    return 1 ;
  fi
  cp "${NEXTJS_TEST_APP}" site/.webship-test-app.cjs || return 1 ;
  local status=0 ;
  nextjs_exec "ACCOUNT_PASSWORD='${NEXTJS_ACCOUNT_PASSWORD:-dD.123123ddd}' node .webship-test-app.cjs $*" || status=$? ;
  rm -f site/.webship-test-app.cjs ;
  return ${status} ;
}

# Make the Learn app in site/: the course's own way to start from its example (create-next-app
# --example, at a pinned commit, with pnpm, which builds bcrypt and sharp as the example's
# pnpm-workspace.yaml allows), moved to the release asked for; its database settings (the
# container's own), the session secret, and the one route of the step pack.
function nextjs_make_learn() {
  local version="$1" base_url="$2" ;
  ddev exec -d /var/www/html "npx -y create-next-app@${version} site --example 'https://github.com/vercel/next-learn/tree/${NEXTJS_LEARN_REF}/dashboard/final-example' --use-pnpm --skip-install --disable-git --yes" < /dev/null \
    || { echo "create-next-app could not make the Learn app." ; return 1 ; } ;
  cat > site/.env <<ENVEOF
# The database of this project (the db container), and the secret of the app's sessions.
POSTGRES_URL=postgres://db:db@db:5432/db
AUTH_SECRET=$(openssl rand -base64 32)
AUTH_URL=${base_url}/api/auth
AUTH_TRUST_HOST=true
ENVEOF
  echo "Installing the packages of the app (pnpm). This takes a minute or two." ;
  nextjs_exec "pnpm install --reporter=append-only" || return 1 ;
  nextjs_exec "pnpm add next@${version} --reporter=append-only" || return 1 ;
  # The course names its middleware proxy.ts, the name of the 16.x line; the 15.x line reads the
  # same file as middleware.ts.
  case "${version}" in
    1[0-5].*) [ -f site/proxy.ts ] && [ ! -f site/middleware.ts ] && mv site/proxy.ts site/middleware.ts ;;
  esac
  # The one route the app gets for the step pack: the session of the browser as JSON, at the address
  # the app's authentication library answers when an app mounts its handlers (the course does not).
  mkdir -p site/app/api/auth/session && cp "${NEXTJS_SESSION_ROUTE}" site/app/api/auth/session/route.ts ;
}

# Seed the Learn app's database the course's way: its own /seed route, on the development server,
# before the production build (the dashboard's start page is prerendered with its data). The seed's
# three tables that need the uuid-ossp extension create it at the same moment, which the database
# refuses for all but one: the extension is made first. A second seed would add the invoices again:
# the tables are emptied first.
function nextjs_seed_learn() {
  ddev exec "psql -h db -U db -d db -c 'DROP TABLE IF EXISTS users, customers, invoices, revenue' -c 'CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"'" < /dev/null || return 1 ;
  nextjs_stop_server ;
  echo development > .ddev/nextjs-mode ;
  ddev exec "supervisorctl start webextradaemons:nextjs" < /dev/null > /dev/null || return 1 ;
  nextjs_wait /login || return 1 ;
  local seeded ;
  seeded="$(ddev exec "curl -sS http://127.0.0.1:${NEXTJS_PORT}/seed" < /dev/null)" ;
  echo "Seed: ${seeded}" ;
  case "${seeded}" in
    *"seeded successfully"*) return 0 ;;
    *) echo "The course's seed failed." ; return 1 ;;
  esac
}

# Build a Next.js app from nothing: the container, the app, its packages, and with --install the
# production build, served (the Learn app seeded first, its accounts and test data when asked for).
function nextjs_build() {
  trim_project_name ;
  local base_url="https://${PROJECT_NAME}.ddev.site" ;
  local example="${EXAMPLE:-default}" ;
  local version="${NEXT_VERSION:-${NEXTJS_DEFAULT_VERSION}}" ;
  local project_path="${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME}" ;

  cd ${WORKSPACE_ROOT}/${doc_name} || exit 1 ;

  drop_database ;
  rm -rf "${PROJECT_NAME}" ;
  mkdir -p "${PROJECT_NAME}" ;
  cd "${project_path}" || exit 1 ;

  # A generic web server: the app's own server answers. PostgreSQL for the Learn app, no database for
  # the default app.
  if [ "${example}" == 'learn' ] ; then
    ddev config --project-type=generic --webserver-type=generic --docroot="" --project-name=${PROJECT_NAME} \
      --database=postgres:17 --nodejs-version=$(ddev_nodejs_version) < /dev/null || exit 1 ;
  else
    ddev config --project-type=generic --webserver-type=generic --docroot="" --project-name=${PROJECT_NAME} \
      --omit-containers=db --nodejs-version=$(ddev_nodejs_version) < /dev/null || exit 1 ;
  fi
  nextjs_write_ddev_config "${project_path}" "$(ddev_nodejs_version)" "${example}" || exit 1 ;
  ddev_up start -y || exit 1 ;

  if [ "${example}" == 'learn' ] ; then
    echo "Making the Learn app (the finished app of the official Learn course) on ${version}." ;
    nextjs_make_learn "${version}" "${base_url}" || exit 1 ;
  else
    echo "Making the app create-next-app makes with its defaults, on ${version}." ;
    ddev exec -d /var/www/html "npx -y create-next-app@${version} site --yes --use-npm --disable-git --skip-install" < /dev/null \
      || { echo "create-next-app could not make the app." ; exit 1 ; } ;
    echo "Installing the packages of the app (npm). This takes a minute." ;
    nextjs_exec "npm install --no-audit --no-fund" || exit 1 ;
  fi
  nextjs_allow_dev_origin "${PROJECT_NAME}.ddev.site" || exit 1 ;

  if [ "${INSTALL}" == 'yes' ] ; then
    if [ "${example}" == 'learn' ] ; then
      nextjs_seed_learn || exit 1 ;
      if [ "${TEST_DATA}" == 'yes' ] ; then
        echo "Adding the test data of the step pack (the customers Ivy Example and Oak Example, and their invoices)." ;
        nextjs_test_app customers || exit 1 ;
      fi
      if [ "${ADD_USERS}" == 'yes' ] ; then
        set_nextjs_users ;
        add_nextjs_users || exit 1 ;
        cd "${project_path}" || exit 1 ;
      fi
    else
      [ "${ADD_USERS}" == 'yes' ] && echo "--add-users: the default app has no login and no accounts; nothing is added." ;
      [ "${TEST_DATA}" == 'yes' ] && echo "--test-data: the test data is the Learn app's (--example learn); nothing is added." ;
    fi
    if [ "${DEVELOPMENT}" == 'yes' ] ; then
      nextjs_serve development || exit 1 ;
      echo "${doc_name} ${PROJECT_NAME} is served by the development server: Next.js $(nextjs_version) (${example})." ;
    else
      nextjs_serve production || exit 1 ;
      echo "${doc_name} ${PROJECT_NAME} has been built and is served: Next.js $(nextjs_version) (${example}), a production build." ;
    fi
    echo "Go to ${base_url}" ;
  else
    echo "${doc_name} ${PROJECT_NAME} is ready to build: Next.js $(nextjs_version) (${example})." ;
    if [ "${example}" == 'learn' ] ; then
      echo "Its database is empty: build it with --install, which seeds it, then builds and serves the app." ;
    else
      echo "Build and serve it with: bash cmd-tools-nextjs-cli.sh ${PROJECT_NAME} --build   (or build with --install)" ;
    fi
  fi

  if [ "${LAUNCH}" == 'yes' ] ; then
    ddev launch ;
  fi

  cd ${WORKSPACE_ROOT}/${doc_name};
}

# Write the default accounts into the Learn app's users table, with the app's own bcrypt; an account
# that is there already gets its name and password back. The default app has no accounts.
function add_nextjs_users() {
  nextjs_enter_project || return 1 ;
  if [ "$(nextjs_example)" != 'learn' ] ; then
    echo "The default app has no login and no accounts: there are none to add." ;
    cd ${WORKSPACE_ROOT}/${doc_name}; return 0 ;
  fi
  local user list="" n m p f ;
  for user in "${users[@]}" ; do
    n="user_${user}_name"; m="user_${user}_mail"; p="user_${user}_password"; f="user_${user}_fullname";
    echo " ---------------------------------------------------------------- ";
    echo "         Handle: ${!n}";
    echo "     User email: ${!m}";
    echo "  User password: ${!p}";
    echo "           Name: ${!f:-${!n}}";
    echo " ================================================================= ";
    list="${list:+${list},}{\"name\":\"${!f:-${!n}}\",\"email\":\"${!m}\"}" ;
  done
  local first="${users[0]}" ; p="user_${first}_password" ;
  NEXTJS_ACCOUNT_PASSWORD="${!p}" nextjs_test_app accounts add "'[${list}]'" ;
  local rc=$? ;
  cd ${WORKSPACE_ROOT}/${doc_name};
  return ${rc} ;
}

# Remove the default accounts from the Learn app's users table.
function cancel_nextjs_users() {
  nextjs_enter_project || return 1 ;
  if [ "$(nextjs_example)" != 'learn' ] ; then
    echo "The default app has no login and no accounts: there are none to remove." ;
    cd ${WORKSPACE_ROOT}/${doc_name}; return 0 ;
  fi
  local user list="" m ;
  for user in "${users[@]}" ; do
    m="user_${user}_mail";
    list="${list:+${list},}\"${!m}\"" ;
  done
  nextjs_test_app accounts cancel "'[${list}]'" ;
  local rc=$? ;
  cd ${WORKSPACE_ROOT}/${doc_name};
  return ${rc} ;
}

# What cmd-tools-nextjs-cli.sh does: the first of --run, --npm, --build, --dev, --restart, --update,
# --test-data, --add-users, --cancel-users that was asked for; with none of them, what the app is.
function nextjs_cli_tool() {
  trim_project_name ;
  nextjs_enter_project || exit 1 ;

  if ! ddev describe -j 2>/dev/null | grep -q '"status":"running"' ; then
    ddev start -y < /dev/null || exit 1 ;
  fi

  local example ; example="$(nextjs_example)" ;
  if [ ! "${RUN}" == '_none_' ] ; then
    # Unquoted on purpose: --run "info" is a command and its arguments.
    nextjs_cli ${RUN} ;
    exit $? ;
  fi
  if [ ! "${NPM}" == '_none_' ] ; then
    nextjs_npm ${NPM} ;
    exit $? ;
  fi

  if [ "${BUILD}" == 'yes' ] ; then
    nextjs_serve production || exit 1 ;
    echo "Next.js $(nextjs_version): the new production build is served at https://${PROJECT_NAME}.ddev.site" ;
  elif [ "${DEV}" == 'yes' ] ; then
    nextjs_serve development || exit 1 ;
    echo "Next.js $(nextjs_version): the development server answers at https://${PROJECT_NAME}.ddev.site" ;
  elif [ "${RESTART}" == 'yes' ] ; then
    nextjs_stop_server ;
    ddev exec "supervisorctl start webextradaemons:nextjs" < /dev/null > /dev/null || exit 1 ;
    nextjs_wait "$(nextjs_check_path)" || exit 1 ;
    echo "Next.js $(nextjs_version): served again ($(cat .ddev/nextjs-mode 2>/dev/null || echo production)) at https://${PROJECT_NAME}.ddev.site" ;
  elif [ "${UPDATE}" == 'yes' ] ; then
    echo "Next.js $(nextjs_version) is installed; updating it to the latest release." ;
    nextjs_npm "$( [ "$(nextjs_package_manager)" == pnpm ] && echo 'add' || echo 'install --no-audit --no-fund' ) next@latest" || exit 1 ;
    nextjs_serve production || exit 1 ;
    echo "Next.js $(nextjs_version): the new build is served at https://${PROJECT_NAME}.ddev.site" ;
  elif [ "${TEST_DATA}" == 'yes' ] ; then
    if [ "${example}" != 'learn' ] ; then echo "The test data is the Learn app's; this project has the ${example} app." ; exit 1 ; fi
    nextjs_test_app customers || exit 1 ;
  elif [ "${ADD_USERS}" == 'yes' ] ; then
    set_nextjs_users ;
    add_nextjs_users || exit 1 ;
  elif [ "${CANCEL_USERS}" == 'yes' ] ; then
    set_nextjs_users ;
    cancel_nextjs_users || exit 1 ;
  else
    echo "${doc_name}/${PROJECT_NAME}: Next.js $(nextjs_version) (the ${example} app) at https://${PROJECT_NAME}.ddev.site" ;
    echo "" ;
    if [ -f site/.next/BUILD_ID ] ; then
      echo "Production build: site/.next, built $(date -r site/.next/BUILD_ID '+%Y-%m-%d %H:%M')" ;
    else
      echo "Production build: none yet; build it with --build" ;
    fi
    echo "Served: $(cat .ddev/nextjs-mode 2>/dev/null || echo production)$(ddev exec "curl -fsS -o /dev/null http://127.0.0.1:${NEXTJS_PORT}$(nextjs_check_path)" < /dev/null > /dev/null 2>&1 && echo ', answering' || echo ', not answering: serve it again with --restart')" ;
    if [ "${example}" == 'learn' ] ; then
      echo "Accounts:" ;
      nextjs_test_app accounts list ;
    else
      echo "Accounts: none (the default app has no login)" ;
    fi
  fi
  cd ${WORKSPACE_ROOT}/${doc_name};
}

# The step pack in the testing stack of a Next.js project. The core's testing_configure calls this in
# the project folder once webship-js is scaffolded and before the dependencies are installed; for a
# project that is not Next.js it changes nothing.
#
# It adds the pack to package.json, lists its step definitions in cucumber.js after webship-js's own,
# adds the tags that keep the pack's assertions that must fail out of a normal run, and, for the
# Learn app, the users registry, the login page and the session address; then it writes a first
# feature when the project has none of its own. Every part is skipped when it is already there, so a
# second run adds what the first missed and never resets a suite. The suite is the project's (its
# package.json, cucumber.js and tests/ are next to site/, not in it).
function testing_configure_nextjs() {
  local project_path="$1";
  nextjs_is_project "${project_path}" || return 0 ;
  if [ ! -f "${project_path}/cucumber.js" ] || [ ! -f "${project_path}/package.json" ] ; then
    echo "  Next.js: cucumber.js is not here yet — run the testing setup again once webship-js is scaffolded." ;
    return 1 ;
  fi

  echo "Adding the Next.js step pack (${NEXTJS_STEPS_PACKAGE} ${NEXTJS_STEPS_VERSION}).";
  local example ; example="$(nextjs_example "${project_path}")" ;
  set_nextjs_users ;
  local registry="" user n m p f ;
  if [ "${example}" == 'learn' ] ; then
    for user in "${users[@]}" ; do
      n="user_${user}_name"; m="user_${user}_mail"; p="user_${user}_password"; f="user_${user}_fullname";
      registry="${registry}${user}|${!m}|${!p}|${!f:-${!n}}"$'\n' ;
    done
  fi

  python3 - "${project_path}" "${NEXTJS_STEPS_PACKAGE}" "${NEXTJS_STEPS_VERSION}" 'NEXTJS' "${registry}" <<'PYEOF' || return 1
import json, re, sys

project, pack, version, prefix, registry = sys.argv[1:6]

# package.json: the pack as a dev dependency, at the release line this plugin was proven on.
pkg_file = project + '/package.json'
pkg = json.load(open(pkg_file))
if pack not in pkg.get('dependencies', {}) and pack not in pkg.get('devDependencies', {}):
    pkg.setdefault('devDependencies', {})[pack] = version
    open(pkg_file, 'w').write(json.dumps(pkg, indent=4) + '\n')
    print('  package.json: %s %s' % (pack, version))

# cucumber.js: the pack's step definitions after webship-js's own, the tags, and for the Learn app the
# users registry, the login page and the session address.
cucumber_file = project + '/cucumber.js'
src = open(cucumber_file).read()
before = src

if ('node_modules/%s/' % pack) not in src:
    line = "'node_modules/%s/tests/step-definitions/**/*.js'," % pack
    core = re.search(r"^([ \t]*)'node_modules/webship-js/tests/step-definitions/[^']*',.*$", src, re.M)
    opening = re.search(r"^([ \t]*)require:[ \t]*\[[ \t]*$", src, re.M)
    if core:
        src = src[:core.end()] + '\n' + core.group(1) + line + src[core.end():]
    elif opening:
        src = src[:opening.end()] + '\n' + opening.group(1) + '  ' + line + src[opening.end():]
    else:
        sys.exit("  cucumber.js has no require list this can add to. Add this line to it:\n    " + line)
    print('  cucumber.js: the step definitions of %s' % pack)

if not re.search(r"^[ \t]*tags:", src, re.M):
    default = re.search(r"^([ \t]*)default:[ \t]*\{[ \t]*$", src, re.M)
    if default:
        pad = default.group(1) + '  '
        block = [
            pad + "// The pack's assertions that must fail are no part of a normal run.",
            pad + "tags: process.env.CUCUMBER_TAGS || 'not @wip and not @must-fail',",
        ]
        src = src[:default.end()] + '\n' + '\n'.join(block) + src[default.end():]
        print('  cucumber.js: the tags that keep the assertions that must fail out of a normal run')

rows = [r.split('|') for r in registry.splitlines() if r.strip()]
if rows:
    world = re.search(r"^([ \t]*)worldParameters:[ \t]*\{[ \t]*$", src, re.M)
    if not world:
        sys.exit("  cucumber.js has no worldParameters block to add the users registry to.")
    pad = world.group(1) + '  '
    additions = []
    if not re.search(r"^[ \t]*loginPath:", src, re.M):
        additions += [
            pad + "// The app's login page, and the address that answers with the session of the browser.",
            pad + "loginPath: '/login',",
            pad + "sessionPath: '/api/auth/session',",
        ]
        print('  cucumber.js: the login page and the session address')
    if not re.search(r"^[ \t]*users:[ \t]*\{", src, re.M):
        additions += [
            pad + "// The users registry: a handle a scenario reads, mapped to an account of this app (the default",
            pad + "// accounts: cmd-tools-nextjs-cli.sh --add-users). Override one with %s_<HANDLE>_EMAIL," % prefix,
            pad + "// %s_<HANDLE>_PASSWORD and %s_<HANDLE>_NAME." % (prefix, prefix),
            pad + "users: {",
        ]
        for handle, email, password, name in rows:
            env = '%s_%s' % (prefix, handle.upper())
            additions.append(pad + "  %s: { email: process.env.%s_EMAIL || '%s', password: process.env.%s_PASSWORD || '%s', name: process.env.%s_NAME || '%s' }," % (handle, env, email, env, password, env, name))
        additions.append(pad + "},")
        print('  cucumber.js: the users registry (%s)' % ', '.join(r[0] for r in rows))
    if additions:
        src = src[:world.end()] + '\n' + '\n'.join(additions) + src[world.end():]

if src != before:
    open(cucumber_file, 'w').write(src)
PYEOF

  # A first feature, when the project has none for the app yet: the production build, its pages and,
  # for the Learn app, each default account.
  local feature="${WORKSPACE_SCRIPTS}/plugins/nextjs/site.feature" ;
  if [ "${example}" != 'learn' ] ; then feature="${WORKSPACE_SCRIPTS}/plugins/nextjs/default-site.feature" ; fi
  if [ -f "${feature}" ] && [ ! -f "${project_path}/tests/features/site.feature" ] ; then
    mkdir -p "${project_path}/tests/features" && cp "${feature}" "${project_path}/tests/features/site.feature" \
      && echo "  tests/features/site.feature: a first feature for the app" ;
  fi

  if [ ! -f "${project_path}/site/.next/BUILD_ID" ] ; then
    echo "  the app has no production build yet: build it (cmd-tools-nextjs-cli.sh ${PROJECT_NAME} --build) before the suite runs" ;
  fi
}
