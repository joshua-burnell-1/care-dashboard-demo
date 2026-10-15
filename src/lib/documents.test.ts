import { describe, expect, it } from "vitest";
import { documentKind, documentStatus, filterDocuments, formatFileSize } from "./documents";

const doc = (name: string, mime_type: string) => ({ name, mime_type });

describe("documentKind", () => {
  it("names the kind from the MIME type, then the extension", () => {
    expect(documentKind(doc("a.pdf", "application/pdf")).label).toBe("PDF");
    expect(documentKind(doc("a.txt", "text/plain")).label).toBe("Text");
    expect(documentKind(doc("a.md", "text/markdown")).label).toBe("Text");
    expect(documentKind(doc("a.csv", "text/csv")).label).toBe("Spreadsheet");
    expect(documentKind(doc("a.jpg", "image/jpeg")).label).toBe("Image");
    expect(
      documentKind(
        doc("a.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
      ).label,
    ).toBe("Word");
    expect(documentKind(doc("scan.pdf", "application/octet-stream")).label).toBe("PDF");
    expect(documentKind(doc("blob", "application/octet-stream")).label).toBe("Other file");
  });
});

describe("documentStatus", () => {
  it("puts every status in words with a chip level", () => {
    expect(documentStatus("indexed")).toEqual({ level: "stable", label: "Ready" });
    expect(documentStatus("error")).toEqual({ level: "act", label: "Failed" });
    expect(documentStatus("processing").level).toBe("watch");
    expect(documentStatus("pending").level).toBe("neutral");
  });
});

describe("filterDocuments", () => {
  const docs = [
    doc("Lab report.pdf", "application/pdf"),
    doc("visit-note.md", "text/markdown"),
    doc("Lab values.csv", "text/csv"),
  ];
  it("searches names in any case and filters by kind", () => {
    expect(filterDocuments(docs, { q: "lab" }).map((d) => d.name)).toEqual([
      "Lab report.pdf",
      "Lab values.csv",
    ]);
    expect(filterDocuments(docs, { kind: "text" }).map((d) => d.name)).toEqual(["visit-note.md"]);
    expect(filterDocuments(docs, { q: "lab", kind: "pdf" })).toHaveLength(1);
    expect(filterDocuments(docs, { q: "  " })).toHaveLength(3);
  });
});

describe("formatFileSize", () => {
  it("rounds to KB below a megabyte and to one decimal of MB above", () => {
    expect(formatFileSize(10)).toBe("1 KB");
    expect(formatFileSize(184320)).toBe("180 KB");
    expect(formatFileSize(3 * 1024 * 1024 + 200_000)).toBe("3.2 MB");
  });
});
