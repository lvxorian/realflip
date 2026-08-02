"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, MagnifyingGlass } from "@phosphor-icons/react";

interface PropertyMapProps {
  address: string;
  lat?: number;
  lng?: number;
  cityKey?: string | null;
}

export function PropertyMap({ address, lat: defaultLat, lng: defaultLng, cityKey }: PropertyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);
  const [resolved, setResolved] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeFailed, setGeocodeFailed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Geokódování adresy, pokud nemáme souřadnice
  useEffect(() => {
    if (mounted && defaultLat === undefined && defaultLng === undefined && !resolved && !geocoding && !geocodeFailed) {
      setGeocoding(true);
      fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, cityKey }),
      })
        .then((r) => r.json())
        .then((data: { lat: number | null; lng: number | null; displayName: string | null }) => {
          if (data.lat != null && data.lng != null) {
            setResolved({ lat: data.lat, lng: data.lng, label: data.displayName ?? address });
          } else {
            setGeocodeFailed(true);
          }
        })
        .catch(() => setGeocodeFailed(true))
        .finally(() => setGeocoding(false));
    }
  }, [mounted, defaultLat, defaultLng, resolved, geocoding, geocodeFailed, address, cityKey]);

  useEffect(() => {
    if (!mounted) return;

    let cancelled = false;

    async function loadMap() {
      try {
        const L = await import("leaflet");
        if (cancelled) return;

        // Inject Leaflet CSS via link tag
        const linkId = "leaflet-css";
        if (!document.getElementById(linkId)) {
          const link = document.createElement("link");
          link.id = linkId;
          link.rel = "stylesheet";
          link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css";
          document.head.appendChild(link);
          await new Promise((resolve) => { link.onload = resolve; setTimeout(resolve, 500); });
        }

        await new Promise((r) => setTimeout(r, 50));

        const el = containerRef.current;
        if (!el || cancelled) return;

        const pos: [number, number] | null =
          defaultLat !== undefined && defaultLng !== undefined
            ? [defaultLat, defaultLng]
            : resolved
            ? [resolved.lat, resolved.lng]
            : null;

        if (!pos) return;

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

        L.default.marker(pos).addTo(map).bindPopup(resolved?.label ?? address);

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
  }, [mounted, address, defaultLat, defaultLng, resolved]);

  const hasCoords = defaultLat !== undefined && defaultLng !== undefined;

  return (
    <div className="relative overflow-hidden rounded-xl bg-card border border-border/50" style={{ height: "200px" }}>
      {hasCoords || resolved ? (
        <div ref={containerRef} className="h-full w-full" />
      ) : geocoding ? (
        <div className="absolute inset-0 flex items-center justify-center bg-card z-10">
          <div className="flex flex-col items-center gap-2">
            <MagnifyingGlass size={20} weight="duotone" className="text-accent animate-pulse" />
            <span className="text-xs text-muted">Načítám polohu…</span>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-card z-10">
          <div className="flex flex-col items-center gap-1">
            <MapPin size={24} weight="fill" className="text-accent" />
            <span className="text-xs text-muted text-center px-4">{address || "Neznámá adresa"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
