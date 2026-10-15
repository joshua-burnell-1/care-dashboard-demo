// ABOUTME: Size limits shared along the demo upload path, so the browser, the mock
// ABOUTME: ingest function and the extraction prompt all cut a document at the same point.

/** Characters of an uploaded document's text the demo reads, indexes and sends to Claude. */
export const DEMO_DOCUMENT_TEXT_LIMIT = 25000;
