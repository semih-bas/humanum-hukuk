import assert from "node:assert/strict";
import test from "node:test";

import { generalCaseAccessWhere } from "../src/lib/general-legal-cases/access";
import { generalLegalCaseListQuerySchema } from "../src/lib/general-legal-cases/query";

test("liste sorgusu güvenli varsayılanları uygular", () => {
  assert.deepEqual(generalLegalCaseListQuerySchema.parse({}), {
    query: "", kind: "ALL", status: "ALL", stage: "ALL", dateFrom: null, dateTo: null, page: 1, pageSize: 10,
  });
});

test("liste sorgusu bilinmeyen alan ve ters tarih aralığını reddeder", () => {
  assert.equal(generalLegalCaseListQuerySchema.safeParse({ unexpected: "value" }).success, false);
  assert.equal(generalLegalCaseListQuerySchema.safeParse({ dateFrom: "2026-09-10", dateTo: "2026-09-01" }).success, false);
});

test("yönetici tüm dosyalara erişebilir", () => {
  assert.deepEqual(generalCaseAccessWhere({ id: "admin-id", role: "admin" }), {});
});

test("normal kullanıcı kısıtlı dosyalarda yalnızca ilişkili olduğu kayıtları görür", () => {
  assert.deepEqual(generalCaseAccessWhere({ id: "user-id", role: "user" }), {
    OR: [
      { confidentiality: "NORMAL" },
      { createdById: "user-id" },
      { responsibleUserId: "user-id" },
      { fileStaffUserId: "user-id" },
      { parties: { some: { representativeUserId: "user-id" } } },
    ],
  });
});
