import assert from "node:assert/strict";
import { File } from "node:buffer";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  DocumentValidationError,
  type DocumentUpload,
  inspectDocumentUpload,
  MAX_DOCUMENT_BYTES,
} from "../src/lib/document-validation";

test("accepts a PDF whose declared type matches its signature", async () => {
  const contents = Buffer.from("%PDF-1.7\n% test document");
  const result = await inspectDocumentUpload(new File([contents], "dilekce.pdf", { type: "application/pdf" }));

  assert.equal(result.originalName, "dilekce.pdf");
  assert.equal(result.extension, "pdf");
  assert.equal(result.sha256, createHash("sha256").update(contents).digest("hex"));
});

test("removes directory parts from uploaded names", async () => {
  const contents = Buffer.from("%PDF-1.7\n% test document");
  const result = await inspectDocumentUpload(new File([contents], "..\\gizli\\dilekce.pdf", { type: "application/pdf" }));

  assert.equal(result.originalName, "dilekce.pdf");
});

test("uses a safe custom document name while preserving the real extension", async () => {
  const contents = Buffer.from("%PDF-1.7\n% test document");
  const result = await inspectDocumentUpload(
    new File([contents], "uzun-orijinal-ad.pdf", { type: "application/pdf" }),
    "Bilirkişi Raporu",
  );

  assert.equal(result.originalName, "Bilirkişi Raporu.pdf");
});

test("rejects unsafe custom document names", async () => {
  const contents = Buffer.from("%PDF-1.7\n% test document");
  await assert.rejects(
    inspectDocumentUpload(new File([contents], "dilekce.pdf", { type: "application/pdf" }), "../gizli"),
    DocumentValidationError,
  );
});

test("rejects content whose signature does not match the declared type", async () => {
  await assert.rejects(
    inspectDocumentUpload(new File(["not a pdf"], "sahte.pdf", { type: "application/pdf" })),
    DocumentValidationError,
  );
});

test("rejects unsupported and empty documents", async () => {
  await assert.rejects(
    inspectDocumentUpload(new File(["<svg></svg>"], "resim.svg", { type: "image/svg+xml" })),
    DocumentValidationError,
  );
  await assert.rejects(
    inspectDocumentUpload(new File([], "bos.pdf", { type: "application/pdf" })),
    DocumentValidationError,
  );
});

test("rejects a declared document above the size limit before reading it", async () => {
  let arrayBufferRead = false;
  const oversized = {
    name: "buyuk.pdf",
    type: "application/pdf",
    size: MAX_DOCUMENT_BYTES + 1,
    arrayBuffer: async () => {
      arrayBufferRead = true;
      return new ArrayBuffer(0);
    },
  } as DocumentUpload;

  await assert.rejects(inspectDocumentUpload(oversized), DocumentValidationError);
  assert.equal(arrayBufferRead, false);
});
