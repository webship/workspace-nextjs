// The session of the browser as JSON: the signed-in user ({ user: { name, email }, expires }), or
// null when nobody is signed in. The one route the test app gets from the step pack: the app's
// authentication library answers this address itself when an app mounts its handlers, and the
// course's app does not. The session steps read it to say who is signed in.
import { auth } from '@/auth';

export async function GET() {
  const session = await auth();
  return Response.json(session ? { user: { name: session.user?.name ?? null, email: session.user?.email ?? null }, expires: session.expires } : null);
}
