import { Header } from "@/components/layout/header";
import { Providers } from "@/components/layout/providers";
import { Sidebar } from "@/components/layout/sidebar";

/**
 * Signed-in area. proxy.ts redirects visitors without a session cookie to /login; the Express API
 * verifies the session on every data request, so this layout stays static and data loads client-side.
 */
export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <Providers>
      <div className="flex min-h-[100dvh]">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10">{children}</main>
        </div>
      </div>
    </Providers>
  );
}
