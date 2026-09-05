import type { Metadata } from "next";

import { WorkspaceBrand } from "@/app/components/workspace-brand";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <main className="login-page">
      <header className="workspace-header login-header">
        <WorkspaceBrand href="/" title="Private workspace" />
      </header>

      <section className="login-card" aria-labelledby="login-title">
        <p className="eyebrow">Your facility workspace</p>
        <h1 id="login-title">Sign in</h1>
        <p>Use your employee number and personal passcode.</p>
        <LoginForm />
        <p className="login-help">
          Accounts are issued by your unit administrator. Contact them if you
          need access or help signing in. This workspace does not offer public
          registration or password recovery.
        </p>
      </section>
    </main>
  );
}
