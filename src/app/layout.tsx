import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Guided Operations",
    template: "%s | Guided Operations",
  },
  description:
    "A policy-grounded workspace for secure correctional operations and paperwork.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
