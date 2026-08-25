import { Shell } from "@/shell/shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell variant="admin" homeHref="/admin">
      {children}
    </Shell>
  );
}
