import assert from "node:assert/strict";
import test from "node:test";

import { insuranceCaseInputSchema, updateInsuranceCaseInputSchema } from "../src/lib/insurance-arbitration/input";

const valid = {
  arbitrationApplicationNo: null,
  opposingInsuranceCompany: "Örnek Sigorta",
  opposingPolicyNumber: null,
  policyExpiryDate: null,
  opposingVehicleOwner: null,
  opposingIdentityNumber: null,
  vehicleOwner: "Örnek Müvekkil",
  identityNumber: null,
  vehiclePlate: "34 ABC 123",
  accidentDate: "2026-09-01",
  postalDeliveryDate: null,
  caseTypes: ["DEPRECIATION"],
  insuranceApplicationDate: null,
  insuranceSettlementOffer: "0",
  arbitrationApplicationDate: null,
  hasArbitration: false,
  arbitrationCaseNumber: null,
  status: "INSURANCE_APPLICATION",
  postageExpense: "0",
  enforcementExpense: "0",
  arbitrationApplicationFee: "0",
  expertFee: "0",
  postalAmount: "0",
  actualDepreciationAmount: "0",
  description: null,
  payments: [],
} as const;

test("sigorta dosyası oluşturma verisini sürüm olmadan kabul eder", () => {
  assert.equal(insuranceCaseInputSchema.safeParse(valid).success, true);
});

test("sigorta dosyası güncellemesinde geçerli sürüm zorunludur", () => {
  assert.equal(updateInsuranceCaseInputSchema.safeParse(valid).success, false);
  assert.equal(updateInsuranceCaseInputSchema.safeParse({ ...valid, version: 1 }).success, true);
  assert.equal(updateInsuranceCaseInputSchema.safeParse({ ...valid, version: 0 }).success, false);
});

test("takvimde bulunmayan sigorta tarihlerini reddeder", () => {
  assert.equal(insuranceCaseInputSchema.safeParse({ ...valid, accidentDate: "2026-02-31" }).success, false);
  assert.equal(insuranceCaseInputSchema.safeParse({ ...valid, policyExpiryDate: "2026-13-01" }).success, false);
});
