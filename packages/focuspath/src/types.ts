export type IssueKind = "missing-name" | "missing-or-generic-role" | "positive-tabindex" | "focus-stalled";

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
  stoppedBecause: "cycle-complete" | "step-limit" | "no-focusable-elements" | "document-exhausted" | "stalled-on-element";
}

export interface ScanOptions {
  maxSteps?: number;
  viewport?: { width: number; height: number };
  timeoutMs?: number;
  /** Delay after each Tab press before reading focus. Defaults to 75ms. */
  focusSettleMs?: number;
  headless?: boolean;
  /** Maximum number of network requests made by the page. */
  maxRequests?: number;
  /** Browser resource types to block before they are downloaded. */
  blockedResourceTypes?: string[];
  /** Maximum document height captured in the embedded screenshot. */
  maxScreenshotHeight?: number;
  /** Return false to block a main-frame or subresource URL before the browser requests it. */
  isUrlAllowed?: (url: string) => boolean | Promise<boolean>;
}
