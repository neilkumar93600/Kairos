import { ApiError } from "@/lib/api";

export function ErrorNote({ error }: { error: unknown }) {
  const message = error instanceof ApiError ? error.message : "Something went wrong loading this. Refresh to try again.";
  return (
    <p role="alert" className="rounded-input border border-bad/30 bg-surface px-4 py-3 text-sm text-bad">
      {message}
    </p>
  );
}
