export type IssueKind = "missing-name" | "missing-or-generic-role" | "positive-tabindex" | "focus-stalled" | "opaque-focus-host" | "opaque-host-limit";

export interface TraversalLimits {
  maxSteps: number;
  maxTabPresses: number;
  maxOpaqueTabPresses: number;
}

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
  tabPressCount: number;
  limits: TraversalLimits;
  viewport: { width: number; height: number };
  document: { width: number; height: number };
  steps: FocusStep[];
  issues: FocusIssue[];
  screenshot: string;
  stoppedBecause: "cycle-complete" | "step-limit" | "tab-press-limit" | "opaque-host-limit" | "no-focusable-elements" | "document-exhausted" | "stalled-on-element";
}

export interface ScanOptions {
  /** Maximum number of observable focus stops recorded in the report. */
  maxSteps?: number;
  /** Maximum total Tab key presses, including movement inside opaque hosts. Defaults to maxSteps × 4. */
  maxTabPresses?: number;
  /** Maximum repeated Tab presses within one opaque host. Defaults to 100. */
  maxOpaqueTabPresses?: number;
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
