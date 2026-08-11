export interface StageData {
  meeting?: {
    date: string | null;
    location: string | null;
    notes?: string | null;
  };
  offer?: {
    amount: number | null;
    expiresAt: string | null;
    items?: { price: number; date: string }[];
  };
  negotiation?: {
    currentAmount: number | null;
    history?: { price: number; date: string; by: "us" | "them" }[];
  };
}

export interface LeadItem {
  id: string;
  dealId: string | null;
  stage: string;
  priority: number | null;
  notes: string | null;
  assignedTo: string | null;
  stageData: StageData | null;
  position: number | null;
  stageEnteredAt: number | null;
  lostReason: string | null;
  nextStep: string | null;
  nextStepDueAt: number | null;
  createdAt: number | null;
  updatedAt: number | null;
  propertyId: string | null;
  propertyTitle: string | null;
  propertyPrice: number | null;
  propertyPricePerSqm: number | null;
  propertyFirstSeen: number | null;
  propertyArea: number | null;
  propertyRooms: string | null;
  propertyAddress: string | null;
  propertyCondition: string | null;
  propertyBuildingType: string | null;
  propertyYearBuilt: number | null;
  propertyPortalName: string | null;
  propertyUrl: string | null;
  propertyImageUrl: string | null;
  propertyRemoved: boolean;
  propertyIsActive: boolean;
  propertyRemovedAt: number | null;
  contactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  analysisScore: number | null;
  analysisArv: number | null;
  analysisTargetPurchasePrice: number | null;
}
