import "@/components/onboarding/onboarding.css";
import { Providers } from "@/components/layout/providers";
import { Toaster } from "@/components/ui/sonner";

/**
 * Onboarding stands alone: no sidebar or tab bar, the form beside the painting as on the auth pages. proxy.ts sends
 * visitors without a session to /login. The wizard renders the main landmark (#main) next to the painting's aside.
 */
export default function OnboardingLayout({ children }: LayoutProps<"/">) {
  return (
    <Providers>
      <a
        href="#main"
        className="fixed top-3 left-3 z-50 inline-flex h-11 -translate-y-24 items-center rounded-pill bg-action px-5 text-[15px] font-medium text-on-action transition-transform duration-300 ease-out focus:translate-y-0"
      >
        Skip to content
      </a>
      {children}
      <Toaster />
    </Providers>
  );
}
