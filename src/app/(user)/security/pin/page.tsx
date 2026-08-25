import { PinForm } from "./pin-form";

export default async function PinPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-10 sm:px-6">
      <PinForm welcome={welcome === "1"} />
    </div>
  );
}
