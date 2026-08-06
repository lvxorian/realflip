export interface RecipientLike {
  id: string;
  email: string | null;
  portalEnabled: number | null;
}

export function filterRecipients(investorsList: RecipientLike[], alreadySentInvestorIds: Set<string>): RecipientLike[] {
  return investorsList.filter(
    (investor) =>
      investor.portalEnabled === 1 &&
      typeof investor.email === "string" &&
      investor.email.trim().length > 0 &&
      !alreadySentInvestorIds.has(investor.id)
  );
}
