import { notFound } from "next/navigation";
import { Game } from "@/components/Game";
import { isMode } from "@/lib/modes";

// Next 16: dynamic route params are async.
export default async function PlayPage({
  params,
}: {
  params: Promise<{ mode: string }>;
}) {
  const { mode } = await params;
  if (!isMode(mode)) notFound();

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-8">
      <Game mode={mode} />
    </main>
  );
}
