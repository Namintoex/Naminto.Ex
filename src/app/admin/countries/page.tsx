import { listCountries } from "@/domains/countries/queries";
import { CountriesView } from "./countries-view";

export default async function AdminCountriesPage() {
  const countries = await listCountries();
  return <CountriesView countries={countries} />;
}
