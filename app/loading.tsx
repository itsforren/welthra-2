import { Spinner } from "@/components/ui/shadcn-io/spinner";

export default function Loading() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-2">
      <Spinner variant="bars" />
      <p className="text-neutral-400 text-sm">Loading...</p>
    </div>
  );
}
