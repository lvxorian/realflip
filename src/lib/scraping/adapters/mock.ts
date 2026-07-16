import { PortalAdapter } from "./base";
import { RawListing, PortalName } from "../types";

interface MockTemplate {
  title: string;
  price: number;
  area: number;
  rooms: string;
  floor: number;
  condition: string;
  buildingType: string | null;
  yearBuilt: number;
  address: string;
  lat: number;
  lng: number;
  description: string;
}

const MOCK_TEMPLATES: MockTemplate[] = [
  {
    title: "Byt 2+kk, Praha 7 - Holesovice",
    price: 4350000,
    area: 48,
    rooms: "2+kk",
    floor: 3,
    condition: "puvodni",
    buildingType: "brick",
    yearBuilt: 1935,
    address: "Dukelska 14, Praha 7",
    lat: 50.104,
    lng: 14.438,
    description:
      "Prodam byt 2+kk v cihlovem dome v Holesovicich. Puvodni stav, vyborna lokalita blizko parku Stromovka. MHD 5 minut.",
  },
  {
    title: "Byt 3+1, Praha 10 - Vrsovice",
    price: 5650000,
    area: 62,
    rooms: "3+1",
    floor: 2,
    condition: "dobry",
    buildingType: "brick",
    yearBuilt: 1960,
    address: "Vrsovicka 88, Praha 10",
    lat: 50.068,
    lng: 14.471,
    description:
      "Prostorny byt 3+1 ve Vrsovicich v dobrem stavu. Po castecne rekonstrukci (nova kuchyn, koupelna). Balkon jih.",
  },
  {
    title: "Byt 1+kk, Praha 2 - Vinohrady",
    price: 3850000,
    area: 32,
    rooms: "1+kk",
    floor: 5,
    condition: "po rekonstrukci",
    buildingType: "brick",
    yearBuilt: 1920,
    address: "Korunni 23, Praha 2",
    lat: 50.078,
    lng: 14.443,
    description:
      "Maly byt 1+kk po kompletni rekonstrukci v prestizni lokalite Vinohrady. Energeticky efektivni, moderni vybaveni.",
  },
  {
    title: "Byt 4+1, Praha 6 - Dejvice",
    price: 8900000,
    area: 95,
    rooms: "4+1",
    floor: 1,
    condition: "puvodni",
    buildingType: "panel",
    yearBuilt: 1958,
    address: "Tychonova 5, Praha 6",
    lat: 50.099,
    lng: 14.401,
    description:
      "Prostorny byt 4+1 v Dejvicich. Puvodni stav, vhodny pro investici a rekonstrukci. Klidna ulice blizko parku.",
  },
];

export class MockAdapter extends PortalAdapter {
  constructor(portalName: PortalName = "bazos") {
    super(portalName);
  }

  async crawlListings(): Promise<RawListing[]> {
    const listings: RawListing[] = MOCK_TEMPLATES.map((t, i) => {
      const id = `mock-${this.config.name}-${i + 1}`;
      const now = Date.now() - i * 47 * 60 * 1000;

      return {
        portalName: this.config.name,
        url: `${this.config.baseUrl}/predam/byt/${id}.html`,
        title: t.title,
        price: t.price,
        pricePerSqm: Math.round(t.price / t.area),
        area: t.area,
        rooms: t.rooms,
        floor: t.floor,
        condition: t.condition,
        buildingType: t.buildingType,
        yearBuilt: t.yearBuilt,
        address: t.address,
        lat: t.lat,
        lng: t.lng,
        contactPhone: `+420 60${i + 1} ${100 + i} ${200 + i}`,
        contactName: "Majitel",
        contactEmail: null,
        description: t.description,
        imageUrls: Array.from(
          { length: 5 },
          (_, n) => `https://picsum.photos/seed/${id}-${n + 1}/1200/800`
        ),
        publishedAt: now,
        updatedAt: now,
      };
    });

    return listings;
  }

  extractContact(_html: string): {
    phone: string | null;
    name: string | null;
    email: string | null;
  } {
    return {
      phone: "+420 601 100 200",
      name: "Majitel",
      email: null,
    };
  }
}
