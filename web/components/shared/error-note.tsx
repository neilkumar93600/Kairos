import { WarningCircle } from "@phosphor-icons/react/ssr";
import { ApiError } from "@/lib/api";

/**
 * Inline error. Pass `onRetry` (for example a query's `refetch`) to offer "Try again" in place of "refresh".
 * On the backdrop it is a strong glass strip (14px text needs glass-panel); inside another glass panel it drops its
 * own frost so there is never glass on glass. The red hairline needs `!` to beat the unlayered glass edge.
 */
export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof ApiError
      ? error.message
      : onRetry
        ? "Something went wrong loading this."
        : "Something went wrong loading this. Refresh to try again.";
  return (
    <div
      role="alert"
      className="glass-panel flex flex-wrap items-center gap-x-4 gap-y-2 rounded-input border-bad/30! py-2 pr-2 pl-4 in-[.glass-panel]:bg-transparent! in-[.glass-panel]:shadow-none! in-[.glass-panel]:backdrop-filter-none!"
    >
      <p className="flex min-h-9 flex-1 basis-56 items-center gap-2 text-sm text-bad">
        <WarningCircle size={18} weight="light" aria-hidden className="shrink-0" />
        {message}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={() => onRetry()}
          className="inline-flex h-11 cursor-pointer items-center rounded-pill px-4 text-sm font-medium text-ink underline underline-offset-3 transition-colors duration-300 ease-out hover:bg-sunk hover:no-underline active:bg-sunk"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
