export interface IsirEventData {
  id: number;
  datumZalozeniUdalosti: string;
  datumZverejneniUdalosti: string;
  dokumentUrl: string;
  spisovaZnacka: string;
  typUdalosti: string;
  popisUdalosti: string;
  oddil: string;
  cisloVOddilu: number;
  poznamka: string;
}

export interface IsirStatus {
  stav: "OK" | "CHYBA";
  kodChyby?: string;
  popisChyby?: string;
}

export interface IsirGetDataResponse {
  data: IsirEventData[];
  status: IsirStatus;
}

export interface IsirGetLastIdResponse {
  cisloPosledniId: number[];
  status: IsirStatus;
}

export interface ApartmentData {
  address: string | null;
  disposition: string | null;
  area: number | null;
  cadastralArea: string | null;
  lvNumber: string | null;
  estimatedPrice: number | null;
  rawText: string;
}

export interface InsolvencyScore {
  score: number;
  reasons: string[];
}

export type InsolvencyStatus = "new" | "contacted" | "offer_sent" | "closed" | "lost";

export interface InsolvencyEvent {
  id: string;
  podnetId: number;
  spisovaZnacka: string;
  court: string | null;
  eventType: string;
  eventDesc: string;
  section: string | null;
  sectionOrder: number | null;
  documentUrl: string | null;
  notes: string | null;
  publishedAt: number;
  apartmentFound: boolean;
  apartmentData: string;
  score: number;
  status: InsolvencyStatus;
  notesUser: string | null;
  contactedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface IsirPoll {
  id: string;
  startedAt: number;
  finishedAt: number | null;
  lastPodnetId: number | null;
  eventsFound: number;
  apartmentsFound: number;
  error: string | null;
  status: "running" | "completed" | "failed";
}
