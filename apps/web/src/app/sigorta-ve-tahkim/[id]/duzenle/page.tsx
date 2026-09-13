import CaseRecordPage from "../../CaseRecordPage";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <CaseRecordPage id={(await params).id} readOnly={false} />; }
