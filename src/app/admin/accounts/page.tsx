import { AdminAccountLink, AdminShell } from "@/app/components/admin-shell";
import {
  AdminAccessRequiredMessage,
  AdminUnavailableMessage,
} from "@/app/components/workspace-message-presets";
import { AccountDisableControl } from "./account-disable-control";
import { AccountInvitationForm } from "./account-invitation-form";
import { AccountPasscodeResetControl } from "./account-passcode-reset-control";
import { AccountRoleChangeControl } from "./account-role-change-control";
import { AccountShiftChangeControl } from "./account-shift-change-control";
import { AccountUnlockControl } from "./account-unlock-control";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listAdminAccountsForCurrentSession } from "@/server/auth/list-admin-accounts";

export const metadata = {
  title: "Account administration",
};

export const dynamic = "force-dynamic";

/** Administrator roster with purpose-bound account lifecycle controls. */
export default async function AdminAccountsPage() {
  const result = await loadAccounts();
  if (result.kind === "denied") return <AccessRequired />;
  if (result.kind === "unavailable") return <Unavailable />;

  return (
    <AdminShell actions={<AdminAccountLink />} title="Accounts">
      <section className="reports-intro" aria-labelledby="accounts-title">
        <p className="eyebrow">Administrator workspace</p>
        <h1 id="accounts-title">Accounts and roster</h1>
        <p>
          Add an account only after a fresh administrator confirmation. Each
          important account action requires its own confirmation.
        </p>
      </section>

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
                    <AccountShiftChangeControl
                      accountId={account.accountId}
                      currentShiftCode={account.shiftCode}
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
      <section className="admin-account-create" aria-label="Add an account">
        <AccountInvitationForm />
      </section>
    </AdminShell>
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
    <AdminAccessRequiredMessage description="This account list is available only to a current administrator." />
  );
}

function Unavailable() {
  return (
    <AdminUnavailableMessage
      description="No account settings have been changed."
      eyebrow="Accounts unavailable"
      title="The account list cannot load right now."
    />
  );
}
