export interface AresNotificationBatch {
  cisloDavky: number;
  datovyZdroj: string;
  datumUvolneniDavky: string;
  pocetZmen: number;
}

export interface AresNotification {
  typZmeny: "INS" | "UPD" | "DEL";
  icoId: string;
}

export type AresCompanyStatus = "LIKVIDACE" | "EXEKUCE" | "ZANIKLY";
export type AresPipelineStatus = "new" | "contacted" | "offer_sent" | "closed" | "lost";

// Normalized VR record — only fields we care about.
export interface VrCompanyDetail {
  ico: string;
  name: string | null;
  legalForm: string | null;
  sidlo: string | null;
  court: string | null;
  spisovaZnacka: string | null;
  status: string; // AKTIVNI / ZANIKLY / ...
  hasExecution: boolean;
  isLiquidating: boolean;
  liquidationReasoning: string | null;
  liquidationDate: number | null;
  lastUpdatedAres: number | null;
  rawJson: Record<string, unknown>;
}

export interface CatastrOwnership {
  verified: boolean;
  reason: string;
  totalLvs: number;
  properties: {
    katuzeKod: number;
    lvId: number;
    parcelniCislo: string | null;
    typParcely: string | null;
    vymera: number | null;
    typBudovy: string | null;
  }[];
}

export interface AresScore {
  score: number;
  reasons: string[];
}

export interface AresCompany {
  id: string;
  ico: string;
  name: string | null;
  legalForm: string | null;
  sidlo: string | null;
  court: string | null;
  spisovaZnacka: string | null;
  status: AresCompanyStatus;
  liquidationDate: number | null;
  lastUpdatedAres: number | null;
  reasoning: string | null;
  isLiquidating: boolean;
  hasExecution: boolean;
  propertyOwned: string;
  propertyVerified: boolean;
  apartmentFound: boolean;
  score: number;
  pipeline: AresPipelineStatus;
  notesUser: string | null;
  contactedAt: number | null;
  createdAt: number;
  updatedAt: number;
}
