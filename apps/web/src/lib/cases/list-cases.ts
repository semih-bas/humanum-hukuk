import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "../database";

export type CaseListQuery = {
  query: string;
  page: number;
  pageSize: number;
};

export type CaseListItem = {
  id: string;
  referenceNumber: string;
  licenseHolder: string;
  vehiclePlate: string;
  accidentDate: string;
  debtorName: string | null;
  enforcementOffice: string | null;
  enforcementFileNumber: string | null;
  status: "OPEN" | "ENFORCEMENT" | "INSTALLMENT" | "PENDING" | "CLOSED";
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CaseListResult = {
  items: CaseListItem[];
  pagination: {
    page: number;
    pageSize: number;
    pageCount: number;
    totalCount: number;
  };
};

export async function listCaseFiles(input: CaseListQuery): Promise<CaseListResult> {
  const normalizedQuery = input.query.trim();
  const where: Prisma.CaseFileWhereInput = {
    archivedAt: null,
    ...(normalizedQuery ? {
      OR: [
        { referenceNumber: { contains: normalizedQuery, mode: "insensitive" } },
        { licenseHolder: { contains: normalizedQuery, mode: "insensitive" } },
        { vehiclePlate: { contains: normalizedQuery, mode: "insensitive" } },
        { debtorName: { contains: normalizedQuery, mode: "insensitive" } },
        { enforcementOffice: { contains: normalizedQuery, mode: "insensitive" } },
        { enforcementFileNumber: { contains: normalizedQuery, mode: "insensitive" } },
      ],
    } : {}),
  };

  return prisma.$transaction(async (transaction) => {
    const totalCount = await transaction.caseFile.count({ where });
    const pageCount = Math.max(1, Math.ceil(totalCount / input.pageSize));
    const page = Math.min(input.page, pageCount);
    const records = await transaction.caseFile.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        id: true,
        referenceNumber: true,
        licenseHolder: true,
        vehiclePlate: true,
        accidentDate: true,
        debtorName: true,
        enforcementOffice: true,
        enforcementFileNumber: true,
        status: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      items: records.map((record) => ({
        ...record,
        accidentDate: record.accidentDate.toISOString().slice(0, 10),
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize: input.pageSize,
        pageCount,
        totalCount,
      },
    };
  }, { isolationLevel: "RepeatableRead" });
}
