export type IssueKind = "missing-name" | "positive-tabindex" | "focus-stalled";

export interface FocusStep {
  index: number;
  selector: string;
  tagName: string;
  role: string | null;
  accessibleName: string;
  tabIndex: number;
  href: string | null;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  focusIndicator: {
    outline: string;
    boxShadow: string;
  };
}

export interface FocusIssue {
  kind: IssueKind;
  severity: "error" | "warning";
  step: number;
  selector: string;
  message: string;
}

export interface FocusReport {
  version: 1;
  url: string;
  title: string;
  scannedAt: string;
  durationMs: number;
  viewport: { width: number; height: number };
  document: { width: number; height: number };
  steps: FocusStep[];
  issues: FocusIssue[];
  screenshot: string;
  stoppedBecause: "cycle" | "limit" | "no-focusable-elements" | "focus-stalled";
}

export interface ScanOptions {
  maxSteps?: number;
  viewport?: { width: number; height: number };
  timeoutMs?: number;
  headless?: boolean;
  /** Return false to block a main-frame or subresource URL before the browser requests it. */
  isUrlAllowed?: (url: string) => boolean | Promise<boolean>;
}
