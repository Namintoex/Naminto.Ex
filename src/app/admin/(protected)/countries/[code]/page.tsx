import { notFound } from "next/navigation";
import { getCountryProfile } from "@/domains/countries/profile";
import { requirePermission } from "@/domains/rbac";
import { CountryProfileView } from "./country-profile-view";

export default async function AdminCountryProfilePage({ params }: { params: Promise<{ code: string }> }) {
  await requirePermission("country.manage");

  const { code } = await params;
  const profile = await getCountryProfile(code);
  if (!profile) notFound();

  return <CountryProfileView profile={profile} />;
}
