import Link from "next/link";

import {
  chainOfCustodyGuidance,
  countSheetCapabilities,
  dailyPaperworkCapabilities,
  unavailableForms,
} from "@/features/forms-library/catalog";

/**
 * Honest visual contract for the future Forms Library. It contains no copied
 * forms, real records, or invented paper workflows.
 */
export default function FormsLibraryPreviewPage() {
  return (
    <main className="forms-library-page">
      <header className="workspace-preview-header">
        <Link className="workspace-brand" href="/preview/workspace">
          <span className="brand-mark" aria-hidden="true">
            GO
          </span>
          <span>
            <span className="eyebrow">Guided Operations</span>
            <strong>Forms Library</strong>
          </span>
        </Link>
        <span className="preview-status">Fictional training preview</span>
      </header>

      <section className="forms-library-intro" aria-labelledby="forms-title">
        <p className="eyebrow">Forms Library</p>
        <h1 id="forms-title">Find the right paperwork.</h1>
        <p>
          This fictional preview shows how the protected library separates
          working tools, administrator paperwork, and official physical forms.
        </p>
      </section>

      <section className="forms-library-group" aria-labelledby="preview-ready">
        <div className="forms-library-section-heading">
          <div>
            <p className="eyebrow">Working tool</p>
            <h2 id="preview-ready">Available for training review</h2>
          </div>
        </div>
        <div className="forms-library-list">
          <article>
            <div>
              <h3>North Central Unit Count Sheet</h3>
              <p>
                The fictional practice version demonstrates the approved
                structure without creating an official record.
              </p>
              <CapabilityList items={countSheetCapabilities} />
            </div>
            <Link className="forms-library-action" href="/preview/count-sheet">
              Open Count Sheet <span aria-hidden="true">→</span>
            </Link>
          </article>
        </div>
      </section>

      <section className="forms-library-group" aria-labelledby="preview-admin">
        <div className="forms-library-section-heading">
          <div>
            <p className="eyebrow">Restricted by role</p>
            <h2 id="preview-admin">Administrator paperwork</h2>
          </div>
        </div>
        <div className="forms-library-list">
          <article>
            <div>
              <h3>Daily paperwork</h3>
              <p>
                The live app opens the protected six-form workspace only for a
                verified administrator.
              </p>
              <CapabilityList items={dailyPaperworkCapabilities} />
            </div>
            <span className="forms-not-ready">Administrator only</span>
          </article>
        </div>
      </section>

      <section
        className="forms-library-group"
        aria-labelledby="preview-physical"
      >
        <div className="forms-library-section-heading">
          <div>
            <p className="eyebrow">Official paper process</p>
            <h2 id="preview-physical">Physical-only paperwork</h2>
          </div>
        </div>
        <div className="forms-library-list forms-library-physical-list">
          <article>
            <div>
              <h3>{chainOfCustodyGuidance.title}</h3>
              <p>{chainOfCustodyGuidance.description}</p>
              <CapabilityList items={chainOfCustodyGuidance.capabilities} />
            </div>
            <span className="forms-physical-only">Use official paper form</span>
          </article>
        </div>
        <aside className="forms-library-warning">
          This app does not create, save, print, or replace the official Chain
          of Custody form.
        </aside>
      </section>

      <section className="forms-library-group" aria-labelledby="preview-later">
        <div className="forms-library-section-heading">
          <div>
            <p className="eyebrow">Not yet approved</p>
            <h2 id="preview-later">Coming later</h2>
          </div>
        </div>
        <div className="forms-library-list">
          {unavailableForms.map((item) => (
            <article key={item.title}>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
              <span className="forms-not-ready">Not available</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function CapabilityList({ items }: Readonly<{ items: readonly string[] }>) {
  return (
    <ul className="forms-capability-list" aria-label="Capabilities">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
