import type { Metadata } from "next";
import { ContactDetails } from "@/components/dashboard/profile/contact-details";
import { FactList } from "@/components/dashboard/profile/fact-list";
import { ProfileHeader } from "@/components/dashboard/profile/profile-header";
import { ResumeForm } from "@/components/dashboard/profile/resume-form";
import { ButtonLink } from "@/components/shared/button";
import { Panel } from "@/components/shared/panel";

export const metadata: Metadata = { title: "Profile" };

/** The h1 is the user's name, inside ProfileHeader. */
export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader />
      <ContactDetails />
      <FactList
        emptyAction={
          <ButtonLink href="#add-resume" variant="secondary" size="sm" className="relative after:absolute after:inset-x-0 after:-inset-y-1">
            Paste a resume
          </ButtonLink>
        }
      />
      <Panel
        id="add-resume"
        title="Add a resume"
        description="Each resume is read into new facts, unconfirmed, beside the ones you have."
        className="scroll-mt-8 lg:scroll-mt-[calc(var(--app-header-h)+1rem)]"
      >
        <div className="max-w-3xl">
          <ResumeForm />
        </div>
      </Panel>
    </div>
  );
}
