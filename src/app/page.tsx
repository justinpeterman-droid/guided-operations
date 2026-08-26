import Link from "next/link";

export default function Home() {
  return (
    <main className="foundation-page">
      <header className="brand-bar">
        <span className="brand-mark" aria-hidden="true">
          GO
        </span>
        <div>
          <p className="eyebrow">One facility · one trusted workspace</p>
          <p className="brand-name">Guided Operations</p>
        </div>
        <span className="foundation-badge">Foundation preview</span>
      </header>

      <section className="foundation-grid" aria-labelledby="page-title">
        <div className="product-intro">
          <p className="eyebrow">Policy grounded. Officer controlled.</p>
          <h1 id="page-title">
            Clear guidance for the work that has to be right.
          </h1>
          <p className="lede">
            Guided Operations brings reports, daily paperwork, forms, and cited
            policy guidance into one calm web workspace. The officer reviews
            every answer and every document before anything becomes official.
          </p>

          <ul className="principle-list">
            <li>
              <strong>Your facts stay yours.</strong>
              <span>
                AI may organize or draft; it may never invent missing facts.
              </span>
            </li>
            <li>
              <strong>Sources stay visible.</strong>
              <span>
                Policy answers must point back to the approved source.
              </span>
            </li>
            <li>
              <strong>Nothing files itself.</strong>
              <span>
                People remain responsible for review, correction, and
                submission.
              </span>
            </li>
          </ul>
        </div>

        <aside className="sign-in-card" aria-labelledby="sign-in-title">
          <p className="eyebrow">Secure access</p>
          <h2 id="sign-in-title">Sign in to your facility</h2>
          <p className="supporting-copy">
            Employee-number and personal-passcode access is being connected to
            the new Supabase identity layer.
          </p>

          <form aria-describedby="connection-status">
            <label htmlFor="employee-number">Employee number</label>
            <input
              id="employee-number"
              name="employee-number"
              autoComplete="username"
              autoCapitalize="none"
              placeholder="Employee number"
              disabled
            />

            <label htmlFor="personal-passcode">Personal passcode</label>
            <input
              id="personal-passcode"
              name="personal-passcode"
              type="password"
              autoComplete="current-password"
              placeholder="Personal passcode"
              disabled
            />

            <button type="button" disabled>
              Sign in
            </button>
          </form>

          <p className="connection-status" id="connection-status" role="status">
            No live operational data or user accounts are connected to this
            preview.
          </p>

          <Link className="preview-link" href="/preview/report-assistant">
            View the fictional report workspace
          </Link>
          <Link className="preview-link" href="/preview/workspace">
            View the officer workspace layout
          </Link>
          <Link className="preview-link" href="/preview/count-sheet">
            Try the fictional Count Sheet
          </Link>
        </aside>
      </section>

      <footer className="foundation-footer">
        <span>Private replacement foundation</span>
        <span>Next.js · Vercel · Supabase</span>
      </footer>
    </main>
  );
}
