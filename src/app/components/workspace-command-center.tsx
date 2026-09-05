import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  FilePenLine,
  FileText,
  History,
  Search,
  CheckCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GuidedMark } from "@/app/components/workspace-brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ReportSummary } from "@/server/incidents/list-reports";

export { GuidedMark };

type WorkItem = {
  id: string;
  label: string;
  title: string;
  status: string;
  href: string;
};
type Tool = { label: string; href: string; icon: LucideIcon };

const previewWork: readonly WorkItem[] = [
  {
    id: "draft",
    label: "Training example",
    title: "Training report · Draft",
    status: "Draft",
    href: "/preview/report-assistant",
  },
  {
    id: "review",
    label: "Training example",
    title: "Training report · Ready for review",
    status: "Ready for review",
    href: "/preview/report-assistant",
  },
];
const previewTools: readonly Tool[] = [
  {
    label: "Open forms",
    href: "/preview/forms-library",
    icon: FilePenLine,
  },
  { label: "Reports and history", href: "/reports", icon: History },
  { label: "Policy reference", href: "/preview/policy-expert", icon: BookOpen },
  {
    label: "Daily paperwork",
    href: "/preview/forms-library",
    icon: ClipboardList,
  },
];
const officerTools: readonly Tool[] = [
  { label: "Reports and history", href: "/reports", icon: History },
  { label: "Policy reference", href: "/policy-expert", icon: BookOpen },
  { label: "Count Sheet", href: "/count-sheet", icon: ClipboardList },
  { label: "Forms library", href: "/forms", icon: FileText },
];

function PriorityAction({
  copy,
  href,
  icon: Icon,
  label,
}: Readonly<{ copy: string; href: string; icon: LucideIcon; label: string }>) {
  return (
    <Link
      href={href}
      className="group block min-w-0 rounded-xl focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      <Card variant="action" className="h-full justify-center">
        <CardHeader className="flex min-w-0 flex-row items-center gap-5">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground motion-reduce:transition-none">
            <Icon aria-hidden="true" className="size-7" strokeWidth={1.6} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <CardTitle>
              <h2>{label}</h2>
            </CardTitle>
            <CardDescription>{copy}</CardDescription>
          </div>
          <ArrowRight
            aria-hidden="true"
            className="size-5 text-primary transition-transform group-hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none"
          />
        </CardHeader>
      </Card>
    </Link>
  );
}

function CommandCenter({
  preview,
  work,
}: Readonly<{ preview: boolean; work: readonly WorkItem[] | null }>) {
  const tools = preview ? previewTools : officerTools;
  return (
    <div className="go-ui my-8 flex flex-col gap-6 md:my-10">
      <section
        aria-labelledby="command-center-title"
        className="flex flex-col gap-7"
      >
        <header className="flex max-w-4xl flex-col gap-3">
          <h1
            id="command-center-title"
            className="text-3xl font-semibold leading-tight tracking-tight md:text-[2.625rem]"
          >
            You did the work. <br />
            Keep the paperwork clear.
          </h1>
          <p className="text-base text-muted-foreground">
            Choose the right starting point. Both paths keep the source and your
            review in view.
          </p>
        </header>
        <div className="grid items-stretch gap-5 lg:grid-cols-[1.15fr_1fr]">
          <div className="grid min-w-0 auto-rows-fr gap-4">
            <PriorityAction
              label="Start a report"
              copy="Turn known facts into reviewable paperwork."
              href={preview ? "/preview/report-assistant" : "/incidents/new"}
              icon={FilePenLine}
            />
            <PriorityAction
              label="Ask Policy Expert"
              copy="Get cited policy guidance and source passages."
              href={preview ? "/preview/policy-expert" : "/policy-expert"}
              icon={BookOpen}
            />
          </div>
          <Card
            role="region"
            aria-labelledby="your-work-title"
            className="min-w-0 gap-3"
          >
            <CardHeader>
              <CardTitle>
                <h2 id="your-work-title">Your work</h2>
              </CardTitle>
              <CardDescription>
                {preview ? "Fictional training examples" : "Authorized reports"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {work === null ? (
                <p role="status" className="py-5 text-sm text-muted-foreground">
                  Your report list cannot load right now. Your work has not been
                  changed.
                </p>
              ) : work.length === 0 ? (
                <p className="py-5 text-sm text-muted-foreground">
                  No reports are available for your account yet.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {work.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="group flex min-h-24 items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-accent motion-reduce:transition-none"
                      >
                        <FileText
                          aria-hidden="true"
                          className="size-4 text-primary"
                          strokeWidth={1.5}
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <span className="text-xs text-muted-foreground">
                            {item.label}
                          </span>
                          <strong className="break-words text-sm font-semibold">
                            {item.title}
                          </strong>
                          <Badge variant="secondary">{item.status}</Badge>
                        </div>
                        <ArrowRight
                          aria-hidden="true"
                          className="size-4 text-muted-foreground"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
            <div className="px-6">
              <Separator />
            </div>
            <CardFooter>
              <Button
                asChild
                variant="link"
                className="w-full justify-between px-0"
              >
                <Link href="/reports" prefetch={false}>
                  View report history
                  <ArrowRight aria-hidden="true" data-icon="inline-end" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
        <section
          aria-labelledby="review-path-title"
          className="flex flex-col gap-4 border-b px-1 pb-6 pt-1 md:flex-row md:items-center md:justify-between md:gap-8"
        >
          <h2 id="review-path-title" className="sr-only">
            Review path
          </h2>
          <ol className="flex items-center justify-between gap-4 md:gap-6">
            {[
              { label: "Capture", icon: FilePenLine },
              { label: "Review", icon: Search },
              { label: "Confirm", icon: CheckCheck },
            ].map(({ label, icon: Icon }, index) => (
              <li key={label} className="flex items-center gap-4 md:gap-6">
                {index > 0 && (
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                )}
                <span className="flex items-center gap-2 text-xs font-medium">
                  <Icon
                    aria-hidden="true"
                    className="size-4 text-primary"
                    strokeWidth={1.5}
                  />
                  {label}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted-foreground">
            You review before anything becomes official.
          </p>
        </section>
      </section>
      <section aria-labelledby="all-tools-title">
        <div className="flex flex-col gap-3">
          <h2
            id="all-tools-title"
            className="px-3 text-sm font-semibold text-muted-foreground"
          >
            More tools
          </h2>
          <div>
            <ul className="grid gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap">
              {tools.map(({ label, href, icon: Icon }) => (
                <li key={label} className="min-w-0 xl:flex-1">
                  <Button
                    asChild
                    variant="ghost"
                    className="w-full justify-between"
                  >
                    <Link href={href} prefetch={href !== "/reports"}>
                      <Icon aria-hidden="true" data-icon="inline-start" />
                      <span className="flex-1 text-left">{label}</span>
                      <ArrowRight aria-hidden="true" data-icon="inline-end" />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Presentational preview only; it never creates data. */
export function WorkspaceCommandCenter() {
  return <CommandCenter preview work={previewWork} />;
}

/** Receives only server-authorized summaries, with no fallback sample data. */
export function OfficerCommandCenter({
  reports,
}: Readonly<{ reports: readonly ReportSummary[] | null }>) {
  const work =
    reports === null
      ? null
      : reports.slice(0, 2).map((report) => ({
          id: report.reportId,
          label: report.incidentNumber,
          title: report.incidentName,
          status: report.status.replaceAll("_", " "),
          href: `/reports/${report.reportId}`,
        }));
  return <CommandCenter preview={false} work={work} />;
}
