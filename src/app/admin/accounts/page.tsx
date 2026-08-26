import Link from "next/link";

import { WorkspaceNavigation } from "@/app/components/workspace-navigation";
import { AccountDisableControl } from "./account-disable-control";
import { AccountInvitationForm } from "./account-invitation-form";
import { AccountPasscodeResetControl } from "./account-passcode-reset-control";
import { AccountRoleChangeControl } from "./account-role-change-control";
import { AccountUnlockControl } from "./account-unlock-control";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listAdminAccountsForCurrentSession } from "@/server/auth/list-admin-accounts";

export const dynamic = "force-dynamic";

/** Administrator roster with purpose-bound account lifecycle controls. */
export default async function AdminAccountsPage() {
  const result = await loadAccounts();
  if (result.kind === "denied") return <AccessRequired />;
  if (result.kind === "unavailable") return <Unavailable />;

  return (
    <main className="reports-page">
      <header className="workspace-header reports-header">
        <Link className="workspace-brand" href="/admin">
          <span className="brand-mark" aria-hidden="true">
            GO
          </span>
          <span>
            <span className="eyebrow">Guided Operations</span>
            <strong>Accounts</strong>
          </span>
        </Link>
        <div className="reports-header-actions">
          <WorkspaceNavigation current="Home" />
          <Link className="reports-home-link" href="/account">
            Account
          </Link>
        </div>
      </header>

      <section className="reports-intro" aria-labelledby="accounts-title">
        <p className="eyebrow">Administrator workspace</p>
        <h1 id="accounts-title">Accounts and roster</h1>
        <p>
          Add an account only after a fresh administrator confirmation. Each
          important account action requires its own confirmation.
        </p>
      </section>

      <AccountInvitationForm />

      {result.accounts.length === 0 ? (
        <section className="reports-empty-state" aria-labelledby="empty-title">
          <h2 id="empty-title">No accounts are available.</h2>
          <p>
            No account records have been created in this private environment.
          </p>
        </section>
      ) : (
        <section
          className="reports-list-section"
          aria-labelledby="account-list-title"
        >
          <h2 id="account-list-title">Current accounts</h2>
          <div className="reports-list" role="list">
            {result.accounts.map((account) => (
              <article
                className="report-list-item"
                key={account.accountId}
                role="listitem"
              >
                <div>
                  <p className="eyebrow">
                    Employee ending {account.employeeNumberHint}
                  </p>
                  <h3>{account.displayName}</h3>
                  <p>
                    {account.role === "administrator"
                      ? "Administrator"
                      : "Officer"}{" "}
                    · {account.status}
                    {account.shiftCode
                      ? ` · shift ${account.shiftCode}`
                      : " · no shift"}
                    {account.mustChangePasscode
                      ? " · passcode change required"
                      : ""}
                  </p>
                </div>
                {account.status === "active" ? (
                  <div className="account-session-actions">
                    <AccountRoleChangeControl
                      accountId={account.accountId}
                      currentRole={account.role}
                      displayName={account.displayName}
                    />
                    <AccountPasscodeResetControl
                      accountId={account.accountId}
                      displayName={account.displayName}
                    />
                    <AccountDisableControl
                      accountId={account.accountId}
                      displayName={account.displayName}
                    />
                  </div>
                ) : account.status === "locked" ? (
                  <AccountUnlockControl
                    accountId={account.accountId}
                    displayName={account.displayName}
                  />
                ) : (
                  <span className="report-status">Read only</span>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

async function loadAccounts() {
  try {
    return await listAdminAccountsForCurrentSession(
      await createSupabaseServerClient(),
      50,
    );
  } catch {
    return { kind: "unavailable" } as const;
  }
}

function AccessRequired() {
  return (
    <main className="reports-page reports-message-page">
      <section
        className="reports-empty-state"
        aria-labelledby="admin-access-title"
      >
        <p className="eyebrow">Private workspace</p>
        <h1 id="admin-access-title">Administrator access is required.</h1>
        <p>This account list is available only to a current administrator.</p>
        <Link className="reports-home-link" href="/home">
          Return to your workspace
        </Link>
      </section>
    </main>
  );
}

function Unavailable() {
  return (
    <main className="reports-page reports-message-page">
      <section
        className="reports-empty-state"
        aria-labelledby="accounts-unavailable-title"
      >
        <p className="eyebrow">Accounts unavailable</p>
        <h1 id="accounts-unavailable-title">
          The account list cannot load right now.
        </h1>
        <p>No account settings have been changed.</p>
        <Link className="reports-home-link" href="/admin">
          Return to administrator workspace
        </Link>
      </section>
    </main>
  );
}
