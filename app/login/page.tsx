import { signIn } from "../actions";

export const dynamic = "force-dynamic";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <section className="card">
      <p className="eyebrow">PRIVATE · PERSONAL</p>
      <h1>Simple Finance</h1>
      <p>Sign in to your personal budget.</p>
      {error && <p role="alert" className="error">Unable to sign in. Check your credentials and try again.</p>}
      <form action={signIn}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
        <button type="submit">Sign in</button>
      </form>
      <p className="muted">Access is restricted to the owner. No public registration.</p>
    </section>
  );
}
