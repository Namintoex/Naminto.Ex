import { adminListUsers } from "@/domains/identity/admin-queries";
import { UsersView } from "./users-view";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;
  const result = await adminListUsers({ search: sp.q }, page);

  return <UsersView result={result} search={sp.q ?? ""} />;
}
