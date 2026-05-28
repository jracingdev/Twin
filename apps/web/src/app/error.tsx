"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-xl font-bold text-red-400">Algo deu errado</h2>
      <p className="max-w-md text-sm text-twin-muted">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg border border-twin-cyan/40 px-4 py-2 text-twin-cyan hover:bg-twin-cyan/10"
      >
        Tentar novamente
      </button>
    </div>
  );
}
