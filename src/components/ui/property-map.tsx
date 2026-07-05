"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "@phosphor-icons/react";

interface PropertyMapProps {
  address: string;
  lat?: number;
  lng?: number;
}

const coords: [number, number] = [50.092, 14.455];

export function PropertyMap({ address, lat: defaultLat, lng: defaultLng }: PropertyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let cancelled = false;

    async function loadMap() {
      try {
        const L = await import("leaflet");
        if (cancelled) return;

        // Inject Leaflet CSS via link tag (more reliable than CSS import)
        const linkId = "leaflet-css";
        if (!document.getElementById(linkId)) {
          const link = document.createElement("link");
          link.id = linkId;
          link.rel = "stylesheet";
          link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css";
          document.head.appendChild(link);
          // Wait for CSS to load
          await new Promise((resolve) => { link.onload = resolve; setTimeout(resolve, 500); });
        }

        // Wait a tick for CSS to apply
        await new Promise((r) => setTimeout(r, 50));

        const el = containerRef.current;
        if (!el || cancelled) return;

        const pos: [number, number] =
          defaultLat !== undefined && defaultLng !== undefined
            ? [defaultLat, defaultLng]
            : coords;

        delete (L.default.Icon.Default.prototype as any)._getIconUrl;
        L.default.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
          iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        });

        const map = L.default.map(el, {
          center: pos,
          zoom: 15,
          scrollWheelZoom: false,
          zoomControl: true,
        });

        L.default.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        L.default.marker(pos).addTo(map).bindPopup(address);

        mapRef.current = map;
        setTimeout(() => map.invalidateSize(), 300);
      } catch (err) {
        console.error("Map init failed", err);
      }
    }

    loadMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mounted, address, defaultLat, defaultLng]);

  return (
    <div className="relative overflow-hidden rounded-xl bg-card border border-border/50" style={{ height: "200px" }}>
      <div ref={containerRef} className="h-full w-full" />
      {!mounted && (
        <div className="absolute inset-0 flex items-center justify-center bg-card z-10">
          <div className="flex flex-col items-center gap-1">
            <MapPin size={24} weight="fill" className="text-accent" />
            <span className="text-xs text-muted">{address}</span>
          </div>
        </div>
      )}
    </div>
  );
}
