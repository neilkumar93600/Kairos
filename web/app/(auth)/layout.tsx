import { Logo } from "@/components/shared/logo";

/** Sign in, sign up, verify, forgot and reset. Split layout: form left, one reassurance right. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="grid min-h-[100dvh] grid-cols-1 lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="flex flex-1 items-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
      <aside className="hidden flex-col justify-end gap-4 border-l border-line bg-surface p-12 lg:flex">
        <p className="max-w-md text-2xl leading-snug tracking-tight">Nothing is sent until you approve it.</p>
        <p className="max-w-md text-body">Every application keeps a receipt of what went out under your name.</p>
      </aside>
    </main>
  );
}
