"use client";

import { useEffect, useState } from "react";
import { TwinSelect } from "@/components/TwinSelect";
import { twinApi, type TimelineEvent } from "@/lib/api";

export default function TimelinePage() {
  const [twinId, setTwinId] = useState("");
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    twinApi
      .timeline(twinId || undefined)
      .then((res) => setEvents(res.data ?? []))
      .finally(() => setLoading(false));
  }, [twinId]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold neon-text">Timeline de aprendizado</h1>
      <TwinSelect value={twinId} onChange={setTwinId} className="max-w-md" />
      {loading ? (
        <p className="text-twin-muted">Carregando…</p>
      ) : events.length === 0 ? (
        <p className="text-twin-muted">Nenhum evento registrado.</p>
      ) : (
        <div className="relative space-y-8 border-l border-twin-cyan/30 pl-8">
          {events.map((e, i) => (
            <div key={`${e.type}-${e.title}-${i}`} className="relative">
              <span className="absolute -left-[2.4rem] h-3 w-3 rounded-full bg-twin-cyan shadow-glow" />
              <p className="text-xs text-twin-muted">{e.date}</p>
              <p className="font-medium">{e.title}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
