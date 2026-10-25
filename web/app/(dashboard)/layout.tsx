import { Suspense } from "react";
import { AppCommand } from "@/components/layout/app-command";
import { AppRouteFocus } from "@/components/layout/app-route-focus";
import { AppTabBar, AppTabBarStatic } from "@/components/layout/app-tab-bar";
import { Header } from "@/components/layout/header";
import { Providers } from "@/components/layout/providers";
import { Sidebar } from "@/components/layout/sidebar";

/**
 * Signed-in area. proxy.ts redirects visitors without a session cookie to /login; the Express API
 * verifies the session on every data request, so this layout stays static and data loads client-side.
 *
 * `--app-tabbar-h` is the height of the fixed phone tab bar (0 from lg). Anything a page pins to the bottom of the
 * viewport (an approve bar, a toast) offsets by it: `bottom-[var(--app-tabbar-h)]`.
 * `--app-header-h` is the sticky glass header's footprint from lg (12px inset plus the 56px bar; 0 below lg, where the
 * header scrolls away). Anything a page pins to the top offsets by it: `lg:top-[calc(var(--app-header-h)+1rem)]`.
 *
 * Nothing here paints a background: the site backdrop (root layout) shows through, and the chrome is glass over it.
 */
export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <Providers>
      <div className="[--app-header-h:0px] [--app-tabbar-h:calc(4rem+1px+env(safe-area-inset-bottom))] lg:[--app-header-h:4.25rem] lg:[--app-tabbar-h:0px]">
        <a
          href="#main"
          className="fixed top-3 left-3 z-50 inline-flex h-11 -translate-y-24 items-center rounded-pill bg-action px-5 text-[15px] font-medium text-on-action transition-transform duration-300 ease-out focus:translate-y-0"
        >
          Skip to content
        </a>
        <div className="flex min-h-dvh">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            <main
              id="main"
              tabIndex={-1}
              className="flex-1 px-4 pt-8 pb-[calc(var(--app-tabbar-h)+2rem)] outline-none sm:px-6 lg:px-10 [&_h1:focus]:outline-none"
            >
              <div className="mx-auto w-full max-w-[1280px]">{children}</div>
            </main>
          </div>
        </div>
        <Suspense fallback={<AppTabBarStatic />}>
          <AppTabBar />
        </Suspense>
        <Suspense fallback={null}>
          <AppRouteFocus />
        </Suspense>
        <AppCommand />
      </div>
    </Providers>
  );
}
