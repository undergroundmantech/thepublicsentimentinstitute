import test from "node:test";
import assert from "node:assert/strict";
import { csvCell, csvFilename, toCsv, CSV_COLUMNS } from "../../app/lib/csv/csv";

test("missing values are blank, never zero", () => {
  assert.equal(csvCell(null), ""); assert.equal(csvCell(undefined), ""); assert.equal(csvCell(NaN), ""); assert.equal(csvCell(Infinity), "");
  assert.equal(csvCell(0), "0"); assert.equal(csvCell(-3.7), "-3.7");
});
test("quotes, commas and newlines are escaped", () => {
  assert.equal(csvCell('Smith, "Jr."'), '"Smith, ""Jr."""');
  assert.equal(csvCell("a\nb"), "a b");
});
test("formula injection is neutralised, numbers and negatives are not", () => {
  assert.equal(csvCell("=SUM(A1)"), "'=SUM(A1)"); assert.equal(csvCell("@x"), "'@x"); assert.equal(csvCell("-cmd"), "'-cmd");
  assert.equal(csvCell("-12.5"), "-12.5");
});
test("rows are CRLF and follow the column order", () => {
  const out = toCsv([{ race_id: "sen-FL", votes: 0, vote_pct: null }]);
  const [h, r] = out.split("\r\n"); assert.equal(h, CSV_COLUMNS.join(","));
  const cells = r.split(","); assert.equal(cells[CSV_COLUMNS.indexOf("race_id")], "sen-FL");
  assert.equal(cells[CSV_COLUMNS.indexOf("votes")], "0"); assert.equal(cells[CSV_COLUMNS.indexOf("vote_pct")], "");
  assert.ok(out.endsWith("\r\n"));
});
test("filename is UTC and safe", () => {
  assert.equal(csvFilename("Race: sen-FL!", new Date("2026-11-03T23:15:07.123Z")), "onpoint-race-sen-fl-20261103T231507Z.csv");
});
