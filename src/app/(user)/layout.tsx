import { Shell } from "@/shell/shell";

export default function UserAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell variant="user" homeHref="/">
      {children}
    </Shell>
  );
}
