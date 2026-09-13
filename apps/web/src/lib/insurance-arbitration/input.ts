import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih giriniz.");
const optionalDate = z.union([date, z.literal(""), z.null()]).transform((value) => value || null);
const optionalText = (maximum: number) => z.union([z.string().trim().max(maximum), z.null()]).transform((value) => value || null);
const optionalIdentity = z.union([
  z.string().trim().regex(/^\d{10,11}$/, "TC/VKN 10 veya 11 rakam olmalıdır."),
  z.literal(""),
  z.null(),
]).transform((value) => value || null);
const money = z.union([z.string(), z.number()]).transform((value, context) => {
  const text = String(value).trim();
  const normalized = text.includes(",") ? text.replaceAll(".", "").replace(",", ".") : text;
  try {
    const result = new Prisma.Decimal(normalized || "0");
    if (result.isNegative() || result.gt("9999999999999999.99")) throw new Error();
    return result;
  } catch {
    context.addIssue({ code: "custom", message: "Geçerli bir tutar giriniz." });
    return z.NEVER;
  }
});

export const insuranceCaseInputSchema = z.object({
  arbitrationApplicationNo: optionalText(80), opposingInsuranceCompany: z.string().trim().min(1, "Karşı sigorta zorunludur.").max(150), opposingPolicyNumber: optionalText(80), policyExpiryDate: optionalDate,
  opposingVehicleOwner: optionalText(150), opposingIdentityNumber: optionalIdentity, vehicleOwner: z.string().trim().min(1, "Araç sahibi zorunludur.").max(150), identityNumber: optionalIdentity,
  vehiclePlate: z.string().trim().min(1, "Araç plakası zorunludur.").max(20).transform((value) => value.replace(/\s+/g, " ").toLocaleUpperCase("tr-TR")), accidentDate: date, postalDeliveryDate: optionalDate,
  caseTypes: z.array(z.enum(["DEPRECIATION", "DEPRECIATION_DIFFERENCE", "DAMAGE_DIFFERENCE", "ZERO_DAMAGE"])).min(1, "En az bir dosya türü seçiniz.").max(4), insuranceApplicationDate: optionalDate, insuranceSettlementOffer: money,
  arbitrationApplicationDate: optionalDate, hasArbitration: z.boolean(), arbitrationCaseNumber: optionalText(80),
  status: z.enum(["INSURANCE_APPLICATION", "SETTLEMENT_REVIEW", "ARBITRATION_APPLICATION", "ARBITRATION", "EXPERT_REVIEW", "PAYMENT_PENDING", "INSURANCE_PAYMENT_RECEIVED", "ENFORCEMENT", "LITIGATION", "COMPLETED", "CLOSED"]),
  postageExpense: money, enforcementExpense: money, arbitrationApplicationFee: money, expertFee: money, postalAmount: money, actualDepreciationAmount: money, description: optionalText(500),
}).strict().superRefine((value, context) => {
  if (value.accidentDate > new Date().toISOString().slice(0, 10)) context.addIssue({ code: "custom", path: ["accidentDate"], message: "Kaza tarihi gelecekte olamaz." });
  if (value.hasArbitration && !value.arbitrationApplicationDate) context.addIssue({ code: "custom", path: ["arbitrationApplicationDate"], message: "Tahkim başvuru tarihi zorunludur." });
  if (!value.hasArbitration && (value.arbitrationApplicationDate || value.arbitrationApplicationNo || value.arbitrationCaseNumber)) context.addIssue({ code: "custom", path: ["hasArbitration"], message: "Tahkim yokken tahkim bilgileri girilemez." });
});

export type InsuranceCaseInput = z.infer<typeof insuranceCaseInputSchema>;
export function parseDate(value: string | null) { return value ? new Date(`${value}T00:00:00.000Z`) : null; }
