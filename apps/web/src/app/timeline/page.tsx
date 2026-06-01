"use client";

import { useEffect, useMemo, useState } from "react";
import { TwinSelect } from "@/components/TwinSelect";
import { twinApi, type TimelineEvent } from "@/lib/api";

const TYPE_LABELS: Record<string, string> = {
  import: "Importação",
  dna: "DNA",
  training: "Treino",
  twin: "Twin",
};

const TYPE_ICONS: Record<string, string> = {
  import: "⬇",
  dna: "🧬",
  training: "⚡",
  twin: "👤",
};

const STATUS_COLORS: Record<string, string> = {
  completed: "text-green-400 bg-green-950/40 border-green-500/30",
  failed:    "text-red-400   bg-red-950/40   border-red-500/30",
  queued:    "text-yellow-400 bg-yellow-950/40 border-yellow-500/30",
  processing:"text-blue-400  bg-blue-950/40  border-blue-500/30",
};

const FILTER_OPTS = [
  { id: "all",      label: "Todos" },
  { id: "import",   label: "Importações" },
  { id: "dna",      label: "DNA" },
  { id: "training", label: "Treinos" },
  { id: "twin",     label: "Twins" },
] as const;

type FilterId = (typeof FILTER_OPTS)[number]["id"];

type CollapsedEvent = TimelineEvent & { count: number };

function collapseEvents(events: TimelineEvent[]): CollapsedEvent[] {
  const map = new Map<string, CollapsedEvent>();
  for (const e of events) {
    const key = `${e.type}|${e.title}`;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
    } else {
      map.set(key, { ...e, count: 1 });
    }
  }
  return Array.from(map.values());
}

function extractStatus(title: string): string | null {
  for (const s of ["completed", "failed", "queued", "processing"]) {
    if (title.includes(s)) return s;
  }
  return null;
}

function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(dateStr + "T12:00:00"));
  } catch {
    return dateStr;
  }
}

export default function TimelinePage() {
  const [twinId, setTwinId]   = useState("");
  const [events, setEvents]   = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<FilterId>("all");

  useEffect(() => {
    setLoading(true);
    twinApi
      .timeline(twinId || undefined)
      .then((res) => setEvents(res.data ?? []))
      .finally(() => setLoading(false));
  }, [twinId]);

  const grouped = useMemo(() => {
    const filtered = filter === "all" ? events : events.filter((e) => e.type === filter);
    const byDate = new Map<string, TimelineEvent[]>();
    for (const e of filtered) {
      const list = byDate.get(e.date) ?? [];
      list.push(e);
      byDate.set(e.date, list);
    }
    return Array.from(byDate.entries()).map(([date, evts]) => ({
      date,
      events: collapseEvents(evts),
    }));
  }, [events, filter]);

  const total = events.length;
  const shown = grouped.reduce((s, g) => s + g.events.length, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold neon-text">Timeline</h1>
          {!loading && (
            <p className="mt-1 text-sm text-twin-muted">
              {total} evento{total !== 1 ? "s" : ""} •{" "}
              {shown} linha{shown !== 1 ? "s" : ""} exibida{shown !== 1 ? "s" : ""}{" "}
              {total !== shown && `(${total - shown} agrupado${total - shown !== 1 ? "s" : ""})`}
            </p>
          )}
        </div>
        <TwinSelect value={twinId} onChange={setTwinId} className="max-w-xs" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setFilter(opt.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              filter === opt.id
                ? "border-twin-cyan bg-twin-cyan/10 text-twin-cyan"
                : "border-twin-cyan/20 text-twin-muted hover:border-twin-cyan/50 hover:text-white"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <p className="text-twin-muted">Carregando…</p>
      ) : grouped.length === 0 ? (
        <p className="text-twin-muted">Nenhum evento{filter !== "all" ? " nesta categoria" : ""}.</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ date, events: dayEvents }) => (
            <div key={date}>
              {/* Cabeçalho do dia */}
              <div className="mb-2 flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-twin-cyan">
                  {formatDate(date)}
                </span>
                <span className="h-px flex-1 bg-twin-cyan/15" />
                <span className="text-xs text-twin-muted">{dayEvents.length} item{dayEvents.length !== 1 ? "s" : ""}</span>
              </div>

              {/* Eventos do dia */}
              <div className="divide-y divide-white/5 rounded-xl border border-white/5 bg-black/20">
                {dayEvents.map((e, i) => {
                  const status = extractStatus(e.title);
                  const icon = TYPE_ICONS[e.type] ?? "•";
                  const cleanTitle = e.title
                    .replace(/ — (completed|failed|queued|processing)$/, "")
                    .replace(/^(Importação|Treino|DNA|Twin)\s+/i, "");
                  const typeLabel = TYPE_LABELS[e.type] ?? e.type;

                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02]">
                      {/* Ícone */}
                      <span className="w-6 text-center text-sm" title={typeLabel}>
                        {icon}
                      </span>

                      {/* Tipo badge */}
                      <span className="w-20 shrink-0 text-xs text-twin-muted">
                        {typeLabel}
                      </span>

                      {/* Título */}
                      <span className="flex-1 truncate text-sm text-white/80">
                        {cleanTitle || e.title}
                      </span>

                      {/* Count badge (se duplicatas colapsadas) */}
                      {e.count > 1 && (
                        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs text-twin-muted">
                          ×{e.count}
                        </span>
                      )}

                      {/* Status badge */}
                      {status && (
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${
                            STATUS_COLORS[status] ?? "text-twin-muted border-white/10"
                          }`}
                        >
                          {status}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
