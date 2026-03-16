// ─── OCDS (Open Contracting Data Standard) — tipos SERCOP ───

export interface OCDSValue {
  amount: number;
  currency: string;
}

export interface OCDSAddress {
  streetAddress?: string;
  locality?: string;
  region?: string;
  countryName?: string;
}

export interface OCDSOrganization {
  name: string;
  id: string;
  address?: OCDSAddress;
}

export interface OCDSClassification {
  scheme: string;
  id: string;
  description: string;
}

export interface OCDSItem {
  id: string;
  description: string;
  classification?: OCDSClassification;
  additionalClassifications?: OCDSClassification[];
  quantity?: number;
  unit?: { name: string };
}

export interface OCDSPeriod {
  startDate?: string;
  endDate?: string;
}

export interface OCDSTender {
  id: string;
  title: string;
  description?: string;
  status: string;
  procurementMethod: string;
  procurementMethodDetails?: string;
  value?: OCDSValue;
  minValue?: OCDSValue;
  tenderPeriod?: { startDate?: string; endDate: string };
  enquiryPeriod?: { endDate?: string };
  items?: OCDSItem[];
  numberOfTenderers?: number;
}

export interface OCDSPlanning {
  budget?: {
    amount?: OCDSValue;
    description?: string;
  };
  rationale?: string;
}

export interface OCDSAward {
  id: string;
  title?: string;
  status: string;
  date?: string;
  value?: OCDSValue;
  suppliers?: OCDSOrganization[];
  items?: OCDSItem[];
}

export interface OCDSContract {
  id: string;
  awardID?: string;
  title?: string;
  status?: string;
  value?: OCDSValue;
  period?: OCDSPeriod;
  dateSigned?: string;
}

export interface OCDSRelease {
  ocid: string;
  id: string;
  date: string;
  tag: string[];
  initiationType: string;
  language: string;
  buyer: OCDSOrganization;
  planning?: OCDSPlanning;
  tender?: OCDSTender;
  awards?: OCDSAward[];
  contracts?: OCDSContract[];
}

// ─── Respuestas de la API SERCOP ─────────────────────

export interface SERCOPSearchResponse {
  releases: OCDSRelease[];
  links: {
    self: string;
    next?: string;
    prev?: string;
  };
  meta?: {
    count: number;
    page: number;
    pages: number;
  };
}

export interface SERCOPRecordResponse {
  records: Array<{
    ocid: string;
    releases: OCDSRelease[];
    compiledRelease?: OCDSRelease;
  }>;
}

// ─── Parámetros de búsqueda ──────────────────────────

export interface SERCOPSearchParams {
  year: number;
  page?: number;
  search?: string;
  buyer?: string;
  supplier?: string;
}
