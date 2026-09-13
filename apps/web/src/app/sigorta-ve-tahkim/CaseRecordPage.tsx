import { notFound } from "next/navigation";
import { getInsuranceCase, InsuranceCaseNotFoundError } from "@/lib/insurance-arbitration/service";
import { requireSession } from "@/lib/session";
import NewInsuranceCaseForm from "./yeni/NewInsuranceCaseForm";

export default async function CaseRecordPage({ id, readOnly }: { id: string; readOnly: boolean }) {
  await requireSession();
  let data;
  try {
    data = await getInsuranceCase(id);
  } catch (error) { if (error instanceof InsuranceCaseNotFoundError) notFound(); throw error; }
  const initialData = { ...data, accidentDate: data.accidentDate ?? "", arbitrationApplicationNo: data.arbitrationApplicationNo ?? "", opposingPolicyNumber: data.opposingPolicyNumber ?? "", policyExpiryDate: data.policyExpiryDate ?? "", opposingVehicleOwner: data.opposingVehicleOwner ?? "", opposingIdentityNumber: data.opposingIdentityNumber ?? "", identityNumber: data.identityNumber ?? "", postalDeliveryDate: data.postalDeliveryDate ?? "", insuranceApplicationDate: data.insuranceApplicationDate ?? "", arbitrationApplicationDate: data.arbitrationApplicationDate ?? "", arbitrationCaseNumber: data.arbitrationCaseNumber ?? "", description: data.description ?? "", payments: data.payments.map((payment) => ({ ...payment, paymentDate: payment.paymentDate ?? "", description: payment.description ?? "" })) };
  return <NewInsuranceCaseForm caseId={id} initialData={initialData} readOnly={readOnly} />;
}
