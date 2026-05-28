import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
      <h2 className="text-2xl font-bold neon-text">Página não encontrada</h2>
      <Link href="/" className="text-twin-cyan hover:underline">
        Voltar ao início
      </Link>
    </div>
  );
}
