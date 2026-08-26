import assert from "node:assert/strict";
import test from "node:test";

import { buildSpreadsheetCsv } from "../src/lib/csv-export";

test("quotes fields and preserves Turkish text for spreadsheet export", () => {
  const csv = buildSpreadsheetCsv([["Ruhsat Sahibi", "Borçlu"], ["Çağrı \"Test\"", "Şirket; A.Ş."]]);

  assert.equal(csv, '\uFEFF"Ruhsat Sahibi";"Borçlu"\n"Çağrı ""Test""";"Şirket; A.Ş."');
});

test("neutralizes spreadsheet formula prefixes in exported user data", () => {
  const csv = buildSpreadsheetCsv([["=1+1", "+cmd", "-2+3", "@SUM(A1:A2)", "  =HYPERLINK(\"x\")"]]);

  assert.equal(csv, '\uFEFF"\'=1+1";"\'+cmd";"\'-2+3";"\'@SUM(A1:A2)";"\'  =HYPERLINK(""x"")"');
});
