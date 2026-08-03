export interface LeadItem {
  id: string;
  stage: string;
  priority: number | null;
  notes: string | null;
  assignedTo: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  propertyId: string | null;
  propertyTitle: string | null;
  propertyPrice: number | null;
  propertyPricePerSqm: number | null;
  propertyArea: number | null;
  propertyRooms: string | null;
  propertyAddress: string | null;
  propertyCondition: string | null;
  propertyBuildingType: string | null;
  propertyYearBuilt: number | null;
  propertyPortalName: string | null;
  propertyUrl: string | null;
  propertyImageUrl: string | null;
  contactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  analysisScore: number | null;
}
