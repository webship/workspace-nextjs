// The accounts and the test data of the Learn app (the finished app of the
// official Learn course), written into its own tables the way its seed writes
// the course's data. Run with the app's Node.js in the app's folder:
//
//   node nextjs-test-app.cts accounts add '[{"name":"Administrator","email":"administrator@example.com"}]'
//   node nextjs-test-app.cts accounts cancel '["administrator@example.com"]'
//   node nextjs-test-app.cts accounts list
//   node nextjs-test-app.cts customers
//
// accounts add: the password of every account added is ACCOUNT_PASSWORD,
// hashed with the app's own bcrypt; an account that is there already gets its
// name and password back.
//
// customers: the suite's own customers, "Ivy Example" and "Oak Example" (at
// example.com, each with a copy of a picture of the course under a name of its
// own, in public/customers/), and their three invoices, made
// again as they were: anything a stopped run left for them (an invoice it
// created, an amount it changed) is put back. The course's own customers and
// invoices are not touched.
//
// The database is the app's own (POSTGRES_URL in its .env).
//
// TypeScript, run by Node.js as it is (type stripping, Node.js 24 or later): a CommonJS module (.cts) with
// erasable syntax only, so there is nothing to build. `npm run lint` of the plugin type-checks it.
'use strict';

const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');

/** What the script uses of the app's bcrypt. */
interface Bcrypt {
  hash(data: string, rounds: number): Promise<string>;
}

/** What the script uses of the app's postgres client: a tagged template that answers rows, and a list helper. */
interface Sql {
  <Row extends object = Record<string, unknown>>(strings: TemplateStringsArray, ...values: readonly unknown[]): Promise<Row[]>;
  (list: readonly string[]): unknown;
  end(): Promise<void>;
}
type Postgres = (url: string | undefined, options: { ssl: 'require'; max: number }) => Sql;

interface Account {
  name: string;
  email: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  image_url: string;
}

interface Invoice {
  id: string;
  customer_id: string;
  amount: number;
  status: 'pending' | 'paid';
  date: string;
}

process.loadEnvFile(path.join(process.cwd(), '.env'));
const bcrypt: Bcrypt = require(path.join(process.cwd(), 'node_modules', 'bcrypt'));
const postgres: Postgres = require(path.join(process.cwd(), 'node_modules', 'postgres'));

// Each customer has a picture of its own address (a copy of a picture of the course): a browser that
// has an address already shows it at once, which would hide whether a lazy image loads.
const PICTURE = 'public/customers/evil-rabbit.png';
const CUSTOMERS: readonly [Customer, Customer] = [
  { id: '7f3c2a10-0000-4000-8000-000000000001', name: 'Ivy Example', email: 'ivy@example.com', image_url: '/customers/ivy-example.png' },
  { id: '7f3c2a10-0000-4000-8000-000000000002', name: 'Oak Example', email: 'oak@example.com', image_url: '/customers/oak-example.png' },
];
// Amounts in cents, as the course keeps them; dates older than the course's own, so they are last in the list.
const INVOICES: readonly Invoice[] = [
  { id: '7f3c2a10-0000-4000-8000-0000000000a1', customer_id: CUSTOMERS[0].id, amount: 12000, status: 'pending', date: '2021-03-01' },
  { id: '7f3c2a10-0000-4000-8000-0000000000a2', customer_id: CUSTOMERS[0].id, amount: 7550, status: 'paid', date: '2021-02-01' },
  { id: '7f3c2a10-0000-4000-8000-0000000000a3', customer_id: CUSTOMERS[1].id, amount: 3000, status: 'paid', date: '2021-01-15' },
];

async function main(): Promise<void> {
  const [what, action, list] = process.argv.slice(2);
  const sql = postgres(process.env.POSTGRES_URL, { ssl: 'require', max: 1 });
  try {
    if (what === 'accounts' && action === 'add') {
      const password = process.env.ACCOUNT_PASSWORD;
      if (!password) throw new Error('ACCOUNT_PASSWORD is not set.');
      for (const account of JSON.parse(list ?? '') as Account[]) {
        const hash = await bcrypt.hash(password, 10);
        await sql`
          INSERT INTO users (name, email, password)
          VALUES (${account.name}, ${account.email}, ${hash})
          ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password = EXCLUDED.password`;
        console.log(`  account ${account.email} (${account.name})`);
      }
    } else if (what === 'accounts' && action === 'cancel') {
      for (const email of JSON.parse(list ?? '') as string[]) {
        const removed = await sql`DELETE FROM users WHERE email = ${email} RETURNING email`;
        console.log(`  account ${email}: ${removed.length ? 'removed' : 'not there'}`);
      }
    } else if (what === 'accounts' && action === 'list') {
      for (const row of await sql<Account>`SELECT name, email FROM users ORDER BY email`) console.log(`  ${row.email} (${row.name})`);
    } else if (what === 'customers') {
      for (const c of CUSTOMERS) {
        fs.copyFileSync(path.join(process.cwd(), PICTURE), path.join(process.cwd(), 'public', c.image_url));
        await sql`
          INSERT INTO customers (id, name, email, image_url) VALUES (${c.id}, ${c.name}, ${c.email}, ${c.image_url})
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, image_url = EXCLUDED.image_url`;
      }
      const ids = CUSTOMERS.map((c) => c.id);
      const kept = INVOICES.map((i) => i.id);
      const left = await sql`DELETE FROM invoices WHERE customer_id IN ${sql(ids)} AND id NOT IN ${sql(kept)} RETURNING id`;
      for (const i of INVOICES) {
        await sql`
          INSERT INTO invoices (id, customer_id, amount, status, date) VALUES (${i.id}, ${i.customer_id}, ${i.amount}, ${i.status}, ${i.date})
          ON CONFLICT (id) DO UPDATE SET customer_id = EXCLUDED.customer_id, amount = EXCLUDED.amount, status = EXCLUDED.status, date = EXCLUDED.date`;
      }
      console.log(`  customers ${CUSTOMERS.map((c) => c.name).join(', ')}; ${INVOICES.length} invoices${left.length ? `; ${left.length} invoice(s) a stopped run left removed` : ''}`);
    } else {
      throw new Error(`Unknown action "${[what, action].filter(Boolean).join(' ')}": accounts add, accounts cancel, accounts list or customers.`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
