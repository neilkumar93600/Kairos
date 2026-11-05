import type { Metadata } from "next";
import { Suspense } from "react";
import { DeleteAccount } from "@/components/dashboard/settings/delete-account";
import { ExtensionConnect } from "@/components/dashboard/settings/extension-connect";
import { ForwardingAddress } from "@/components/dashboard/settings/forwarding-address";
import { SignInMethods, SignInMethodsSkeleton } from "@/components/dashboard/settings/sign-in-methods";
import { PageTitle } from "@/components/shared/page-title";
import { Panel } from "@/components/shared/panel";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageTitle title="Settings" body="Choose how you sign in, connect the extension, route replies to Kairos, or close your account." />
      <div className="flex max-w-3xl flex-col gap-6">
        {/* Suspense: the callout reads ?error from a failed OAuth link (useSearchParams). */}
        <Suspense fallback={<SignInMethodsSkeleton />}>
          <SignInMethods />
        </Suspense>
        <Panel title="Chrome extension" description="Connect it once so it can fill applications you approved.">
          <ExtensionConnect />
        </Panel>
        <Panel title="Reply forwarding" description="Forward employer replies to this private address so they land in your inbox here.">
          <ForwardingAddress />
        </Panel>
        <Panel title="Delete account" className="mt-6 border border-danger-fill/50!">
          <DeleteAccount />
        </Panel>
      </div>
    </>
  );
}
