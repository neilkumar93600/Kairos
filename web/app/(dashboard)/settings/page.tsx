import type { Metadata } from "next";
import { DeleteAccount } from "@/components/dashboard/settings/delete-account";
import { ExtensionConnect } from "@/components/dashboard/settings/extension-connect";
import { ForwardingAddress } from "@/components/dashboard/settings/forwarding-address";
import { PageTitle } from "@/components/shared/page-title";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageTitle title="Settings" />
      <div className="flex max-w-3xl flex-col gap-12">
        <section className="flex flex-col gap-4">
          <h2 className="">Chrome extension</h2>
          <ExtensionConnect />
        </section>
        <section className="flex flex-col gap-4">
          <h2 className="">Reply forwarding</h2>
          <ForwardingAddress />
        </section>
        <section className="flex flex-col gap-4">
          <h2 className="">Delete account</h2>
          <DeleteAccount />
        </section>
      </div>
    </>
  );
}
