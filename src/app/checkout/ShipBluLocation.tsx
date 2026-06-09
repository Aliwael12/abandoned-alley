"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { shipbluGovernorateId } from "@/lib/shipblu";

export type ShipBluSelection = {
  cityId: number;
  cityName: string;
  zoneId: number;
  zoneName: string;
};

type Option = { id: number; name: string };

/**
 * City -> zone selectors for ShipBlu-served governorates. ShipBlu's create-order
 * API requires a numeric zone id (a neighborhood), which we can't derive from a
 * free-text address, so the shopper picks it here. Lists come from our own
 * /api/shipblu proxy routes (the secret key stays server-side).
 */
export default function ShipBluLocation({
  governorate,
  value,
  onChange,
  selectCls,
  optionCls,
}: {
  governorate: string;
  value: ShipBluSelection | null;
  onChange: (sel: ShipBluSelection | null) => void;
  selectCls: string;
  optionCls: string;
}) {
  const governorateId = shipbluGovernorateId(governorate);

  const [cities, setCities] = useState<Option[]>([]);
  const [zones, setZones] = useState<Option[]>([]);
  // Starts true: the mount effect immediately fetches cities for the governorate.
  const [loadingCities, setLoadingCities] = useState(true);
  const [loadingZones, setLoadingZones] = useState(false);
  const [failed, setFailed] = useState(false);

  const cityId = value?.cityId ?? 0;
  const zoneId = value?.zoneId ?? 0;

  // Load cities whenever the governorate changes. All state is set past the
  // fetch boundary (never synchronously in the effect body) so re-renders don't
  // cascade. The fetch promise resets prior data on resolve.
  useEffect(() => {
    if (!governorateId) return;
    let cancelled = false;
    fetch(`/api/shipblu/governorates/${governorateId}/cities/`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("cities"))))
      .then((data: { cities: Option[] }) => {
        if (cancelled) return;
        setCities(data.cities ?? []);
        setZones([]);
        setFailed(false);
        onChange(null);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingCities(false);
      });
    return () => {
      cancelled = true;
    };
    // onChange is stable enough for our use; we intentionally key on governorate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [governorateId]);

  // The city the shopper picked, held until they also pick a zone.
  const [pendingCity, setPendingCity] = useState<{ id: number; name: string } | null>(
    value ? { id: value.cityId, name: value.cityName } : null
  );
  // Monotonic id so an earlier, slower zones fetch can't overwrite a later one.
  const zonesReqId = useRef(0);

  function selectCity(id: number) {
    const city = cities.find((c) => c.id === id);
    if (!city) {
      onChange(null);
      setPendingCity(null);
      setZones([]);
      return;
    }
    // City chosen but no zone yet — set pendingCity synchronously so the control
    // always reflects the latest click, and block submit until a zone is picked.
    onChange(null);
    setPendingCity({ id, name: city.name });
    setZones([]);
    setLoadingZones(true);
    setFailed(false);
    const reqId = ++zonesReqId.current;
    fetch(`/api/shipblu/cities/${id}/zones/`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("zones"))))
      .then((data: { zones: Option[] }) => {
        // Ignore a stale response superseded by a newer city pick.
        if (reqId !== zonesReqId.current) return;
        setZones(data.zones ?? []);
      })
      .catch(() => {
        if (reqId === zonesReqId.current) setFailed(true);
      })
      .finally(() => {
        if (reqId === zonesReqId.current) setLoadingZones(false);
      });
  }

  function selectZone(id: number) {
    const zone = zones.find((z) => z.id === id);
    if (!zone || !pendingCity) {
      onChange(null);
      return;
    }
    onChange({
      cityId: pendingCity.id,
      cityName: pendingCity.name,
      zoneId: zone.id,
      zoneName: zone.name,
    });
  }

  if (!governorateId) return null;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] tracking-[0.3em] uppercase text-white/50">
          City {loadingCities && <Loader2 size={11} className="inline animate-spin" />}
        </span>
        <select
          required
          value={cityId || (pendingCity?.id ?? 0) || ""}
          onChange={(e) => selectCity(Number(e.target.value))}
          disabled={loadingCities || cities.length === 0}
          className={selectCls}
        >
          <option className={optionCls} value="" disabled>
            {failed ? "Could not load cities" : "Select city"}
          </option>
          {cities.map((c) => (
            <option key={c.id} className={optionCls} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] tracking-[0.3em] uppercase text-white/50">
          Area / Zone{" "}
          {loadingZones && <Loader2 size={11} className="inline animate-spin" />}
        </span>
        <select
          required
          value={zoneId || ""}
          onChange={(e) => selectZone(Number(e.target.value))}
          disabled={loadingZones || zones.length === 0}
          className={selectCls}
        >
          <option className={optionCls} value="" disabled>
            {zones.length === 0 ? "Select a city first" : "Select area / zone"}
          </option>
          {zones.map((z) => (
            <option key={z.id} className={optionCls} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
