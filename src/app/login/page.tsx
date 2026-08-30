import Link from "next/link";

import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="login-page">
      <header className="workspace-header login-header">
        <Link className="workspace-brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            GO
          </span>
          <span>
            <span className="eyebrow">Guided Operations</span>
            <strong>Private workspace</strong>
          </span>
        </Link>
      </header>

      <section className="login-card" aria-labelledby="login-title">
        <h1 id="login-title">Sign in</h1>
        <p>
          Use your employee number and personal passcode. This private workspace
          does not offer public registration or password recovery.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
