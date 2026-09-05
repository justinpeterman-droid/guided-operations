import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./improvements-surfaces.css";

export const metadata: Metadata = {
  title: {
    default: "Guided Operations",
    template: "%s | Guided Operations",
  },
  description:
    "A policy-grounded workspace for secure correctional operations and paperwork.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
      </body>
    </html>
  );
}
