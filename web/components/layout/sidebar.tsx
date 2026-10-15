import { Suspense } from "react";
import { Logo } from "../shared/logo";
import { SidebarNav } from "./sidebar-nav";

/** Static shell; the active-link state streams in once the URL is known. */
export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-8 border-r border-line px-4 py-6 lg:flex">
      <div className="px-2">
        <Logo href="/dashboard" />
      </div>
      <Suspense fallback={<SidebarNav highlightActive={false} />}>
        <SidebarNav />
      </Suspense>
    </aside>
  );
}
