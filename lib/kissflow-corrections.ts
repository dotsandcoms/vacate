/** Audited per-request ownership corrections. Kissflow itself stays unchanged.
 * Codes beginning EMP are historical internal references, never payroll codes.
 */
const CORRECTIONS: Record<string, Record<string, string>> = {
  Staff_Leave_Request: {
    PkBns3v6d9pK: "0225", // Mabongie Ngubane
    PkBkxPXmRD52: "0219", // Samuel Makubu
    PkBguFul_8UD: "0250", // Refilwe Makgoba
    PkBeGqOXN1GQ: "EMP0186", // Siphiwe Enock Ntuli
    PkBdY2TCfiEV: "EMP0186",
    PkBZskRyC2vI: "0256", // Thulani Masondo; same dates in historical register
    PkBUfo3JzABo: "EMP0149", // Patric Ngobese
    Pk9y1wXavv0E: "0132", // Donovin Re
    Pk9y1h509LOn: "0144", // Heinrich Kok
    Pk9tzsCt8agQ: "0145", // Mashudu Mulaudzi
  },
  Family_Responsibility_lapses_at_end_of_l: {
    PkAB9Z57zLXD: "EMP0192", // Siyabonga Mgidlana; rejected
    PkA1R7_TV2TU: "0045", // Collen Nxumalo
  },
  Sick_Leave_Register: {
    PkC8g3VTMfeZ: "0241", // Kleinboy Mapasha
    PkBthxnUj0Is: "0241",
    PkBsyxGCWQ98: "0266", // Clifford Moyo
    PkBm30zRbRJz: "0242", // Sipho Cyril Nxumalo
    PkBkxP20AcIM: "0241",
    PkBi1cUTvxRI: "0241",
    PkBZXccbSevl: "EMP0186", // matches old Ntuli sick record
    PkBXb31l2Q6h: "0266",
    Pk9oBVRh_cK2: "0160", // Phillip Mashabela
  },
};

export function correctedEmployeeNo(processId: string, requestId: string): string | undefined {
  return CORRECTIONS[processId]?.[requestId];
}

/** Stored webhook rows predate source-process tracking. Resolve only unique IDs. */
export function correctedEmployeeNoForStoredRequest(requestId: string): string | undefined {
  const matches = Object.values(CORRECTIONS).map((source) => source[requestId]).filter(Boolean);
  return matches.length === 1 ? matches[0] : undefined;
}

export function isUnresolvedJonoCode(employeeNo: string | undefined): boolean {
  return !!employeeNo && /^0*1$/.test(employeeNo.trim());
}
