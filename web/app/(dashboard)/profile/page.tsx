import type { Metadata } from "next";
import { FactList } from "@/components/dashboard/profile/fact-list";
import { ResumeForm } from "@/components/dashboard/profile/resume-form";
import { ButtonLink } from "@/components/shared/button";
import { PageTitle } from "@/components/shared/page-title";
import { Panel } from "@/components/shared/panel";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <>
      <PageTitle title="Profile" body="The facts every application is built from. Tailored lines can only cite what you confirmed here." />
      <div className="grid max-w-4xl gap-6 min-[1400px]:max-w-none min-[1400px]:grid-cols-[minmax(0,1fr)_22.5rem] min-[1400px]:items-start">
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
          className="scroll-mt-8 min-[1400px]:sticky min-[1400px]:top-8"
        >
          <ResumeForm />
        </Panel>
      </div>
    </>
  );
}
