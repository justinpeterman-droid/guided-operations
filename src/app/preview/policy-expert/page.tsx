import { PolicyTrainingPreview } from "./policy-training-preview";

export const metadata = {
  title: "Policy Expert preview",
};

/** A safe, non-network preview of the citation-first Policy Expert workflow. */
export default function PolicyExpertPreviewPage() {
  return <PolicyTrainingPreview />;
}
