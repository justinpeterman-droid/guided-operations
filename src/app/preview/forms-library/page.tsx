import Link from "next/link";
import { Button } from "@/components/ui/button";

import { PreviewShell } from "@/app/components/preview-shell";
import {
  chainOfCustodyGuidance,
  dailyPaperworkCapabilities,
  unavailableForms,
} from "@/features/forms-library/catalog";

export const metadata = {
  title: "Forms Library preview",
};

/**
 * Honest visual contract for the future Forms Library. It contains no copied
 * forms, real records, or invented paper workflows.
 */
export default function FormsLibraryPreviewPage() {
  return (
    <PreviewShell
      current="Forms"
      className="forms-library-page"
      title="Forms Library"
    >
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
              <CapabilityList
                items={[
                  "Local calculation",
                  "Fictional print preview",
                  "Not saved",
                ]}
              />
            </div>
            <div className="go-ui">
              <Button asChild>
                <Link href="/preview/count-sheet">
                  Open Count Sheet <span aria-hidden="true">→</span>
                </Link>
              </Button>
            </div>
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
    </PreviewShell>
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
