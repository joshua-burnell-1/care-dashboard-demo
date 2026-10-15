// ABOUTME: Lab metric naming shared by routes, the command palette and the labs pages: the URL
// ABOUTME: slug for a metric name. Task 5 extends this module rather than adding a second slug.
import { canonicalMetricKey } from "./normalizeMetric";

/** URL-safe slug for a metric: its canonical key with anything but letters and digits as "-". */
export function labMetricSlug(metric: string): string {
  return canonicalMetricKey(metric)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
