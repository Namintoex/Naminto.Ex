import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold text-text-primary">NAMINTO.EX</h1>
      <p className="max-w-md text-sm text-text-secondary">
        Application en construction — l&apos;Application Shell (navigation,
        espaces utilisateur et back office) sera mise en place au Prompt 03.
      </p>
      <Link
        href="/design-system"
        className="text-sm font-medium text-brand hover:text-brand-hover"
      >
        Voir le Design System →
      </Link>
    </main>
  );
}
