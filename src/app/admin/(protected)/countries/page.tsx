import { listCountries } from "@/domains/countries/queries";
import { requirePermission } from "@/domains/rbac";
import { CountriesView } from "./countries-view";

export default async function AdminCountriesPage() {
  await requirePermission("country.manage");

  const countries = await listCountries();
  return <CountriesView countries={countries} />;
}
