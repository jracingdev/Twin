import type { ReactNode } from "react";

type StringList = string[] | undefined;

type Communication = {
  estilo_comunicacao?: string;
  nivel_formalidade?: number;
  vocabulario_frequente?: StringList;
  girias?: StringList;
  frases_frequentes?: StringList;
  padroes_saudacao?: StringList;
  padroes_encerramento?: StringList;
  comprimento_medio_mensagem?: number;
  taxa_emojis?: number;
  uso_abreviacoes?: number;
};

type Behavior = {
  como_inicia_conversas?: StringList;
  como_encerra_conversas?: StringList;
  resposta_duvidas?: string;
  resposta_reclamacoes?: string;
  tempo_medio_resposta_minutos?: number;
  horarios_ativos?: number[];
};

type Psychological = {
  extroversao?: number;
  assertividade?: number;
  empatia?: number;
  formalidade?: number;
  dominancia?: number;
  cordialidade?: number;
};

type Commercial = {
  perfil_vendas?: string;
  perfil_emocional?: string;
  gatilhos_persuasao?: StringList;
  objecoes_comuns?: { tipo?: string; exemplo?: string; resposta_tipica?: string }[];
  estrategia_negociacao?: string;
  estilo_follow_up?: string;
};

type ProfilePayload = {
  communication?: Communication;
  behavior?: Behavior;
  psychological_estimate?: Psychological;
  commercial?: Commercial;
};

const TRAIT_LABELS: Record<string, string> = {
  extroversao: "Extroversão",
  assertividade: "Assertividade",
  empatia: "Empatia",
  formalidade: "Formalidade",
  dominancia: "Dominância",
  cordialidade: "Cordialidade",
};

function TagList({ items, empty }: { items?: StringList; empty: string }) {
  if (!items?.length) {
    return <p className="text-sm text-twin-muted">{empty}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((t) => (
        <span
          key={t}
          className="rounded-full border border-twin-cyan/25 px-2.5 py-0.5 text-xs"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function TraitBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-twin-muted">{label}</span>
        <span className="text-twin-cyan">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
        <div
          className="h-full rounded-full bg-twin-cyan/70"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="glass p-6">
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <div>
      <p className="text-xs text-twin-muted">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

export function TwinPersonalityProfile({
  payload,
}: {
  payload: ProfilePayload | Record<string, unknown>;
}) {
  const profile = payload as ProfilePayload;
  const { communication, behavior, psychological_estimate, commercial } = profile;

  const hasCommunication =
    communication && Object.keys(communication).length > 0;
  const hasBehavior = behavior && Object.keys(behavior).length > 0;
  const hasPsych =
    psychological_estimate && Object.keys(psychological_estimate).length > 0;
  const hasCommercial = commercial && Object.keys(commercial).length > 0;

  if (!hasCommunication && !hasBehavior && !hasPsych && !hasCommercial) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold neon-text">Perfil de personalidade v2</h2>

      {hasCommunication && (
        <Section title="Comunicação">
          <div className="space-y-4">
            <Field label="Estilo" value={communication!.estilo_comunicacao} />
            {communication!.nivel_formalidade != null && (
              <TraitBar
                label="Nível de formalidade"
                value={Math.round(communication!.nivel_formalidade! * 100)}
              />
            )}
            <div>
              <p className="mb-2 text-xs text-twin-muted">Vocabulário frequente</p>
              <TagList items={communication!.vocabulario_frequente} empty="—" />
            </div>
            <div>
              <p className="mb-2 text-xs text-twin-muted">Gírias</p>
              <TagList items={communication!.girias} empty="—" />
            </div>
            <div>
              <p className="mb-2 text-xs text-twin-muted">Saudações típicas</p>
              <TagList items={communication!.padroes_saudacao} empty="—" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field
                label="Comprimento médio (chars)"
                value={communication!.comprimento_medio_mensagem}
              />
              <Field
                label="Taxa de emojis"
                value={
                  communication!.taxa_emojis != null
                    ? `${Math.round(communication!.taxa_emojis * 100)}%`
                    : undefined
                }
              />
              <Field
                label="Uso de abreviações"
                value={
                  communication!.uso_abreviacoes != null
                    ? `${Math.round(communication!.uso_abreviacoes * 100)}%`
                    : undefined
                }
              />
            </div>
          </div>
        </Section>
      )}

      {hasBehavior && (
        <Section title="Comportamento">
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs text-twin-muted">Como inicia conversas</p>
              <TagList items={behavior!.como_inicia_conversas} empty="—" />
            </div>
            <div>
              <p className="mb-2 text-xs text-twin-muted">Como encerra conversas</p>
              <TagList items={behavior!.como_encerra_conversas} empty="—" />
            </div>
            <Field label="Resposta a dúvidas" value={behavior!.resposta_duvidas} />
            <Field
              label="Resposta a reclamações"
              value={behavior!.resposta_reclamacoes}
            />
            <Field
              label="Tempo médio de resposta (min)"
              value={behavior!.tempo_medio_resposta_minutos}
            />
          </div>
        </Section>
      )}

      {hasPsych && (
        <Section title="Estimativa psicológica">
          <p className="mb-4 text-xs text-twin-muted">
            Estimativas heurísticas — não constituem diagnóstico clínico.
          </p>
          <div className="space-y-3">
            {Object.entries(psychological_estimate!).map(([key, val]) =>
              typeof val === "number" ? (
                <TraitBar
                  key={key}
                  label={TRAIT_LABELS[key] ?? key}
                  value={val}
                />
              ) : null
            )}
          </div>
        </Section>
      )}

      {hasCommercial && (
        <Section title="Comercial">
          <div className="space-y-4">
            <Field label="Perfil de vendas" value={commercial!.perfil_vendas} />
            <Field label="Perfil emocional" value={commercial!.perfil_emocional} />
            <div>
              <p className="mb-2 text-xs text-twin-muted">Gatilhos de persuasão</p>
              <TagList items={commercial!.gatilhos_persuasao} empty="—" />
            </div>
            {commercial!.objecoes_comuns && commercial!.objecoes_comuns.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-twin-muted">Objeções comuns</p>
                {commercial!.objecoes_comuns.map((o, i) => (
                  <div
                    key={i}
                    className="rounded border border-twin-cyan/10 bg-black/30 p-3 text-sm"
                  >
                    <p className="font-medium">{o.tipo ?? "Objeção"}</p>
                    {o.exemplo && (
                      <p className="mt-1 text-twin-muted">Ex.: {o.exemplo}</p>
                    )}
                    {o.resposta_tipica && (
                      <p className="mt-1 text-twin-cyan/90">{o.resposta_tipica}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <Field
              label="Estratégia de negociação"
              value={commercial!.estrategia_negociacao}
            />
            <Field label="Estilo de follow-up" value={commercial!.estilo_follow_up} />
          </div>
        </Section>
      )}
    </div>
  );
}
