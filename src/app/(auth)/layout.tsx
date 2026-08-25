import Link from "next/link";
import { LocaleToggle, ThemeToggle } from "@/design-system";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-bg">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/login" className="text-sm font-bold tracking-tight text-text-primary">
          NAMINTO.EX
        </Link>
        <div className="flex items-center gap-1.5">
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
