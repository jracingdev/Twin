"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TwinSelect } from "@/components/TwinSelect";

export default function TrainerPickerPage() {
  const router = useRouter();
  const [twinId, setTwinId] = useState("");

  function go() {
    if (twinId) router.push(`/twins/${twinId}/trainer`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold neon-text">Twin Trainer</h1>
      <div className="glass max-w-md space-y-4 p-6">
        <label className="block text-sm text-twin-muted">Selecione o twin</label>
        <TwinSelect value={twinId} onChange={setTwinId} className="w-full" />
        <button
          type="button"
          onClick={go}
          disabled={!twinId}
          className="rounded-lg bg-twin-cyan px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          Abrir trainer
        </button>
      </div>
    </div>
  );
}
