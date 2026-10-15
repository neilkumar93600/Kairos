import type { Metadata } from "next";
import { FactList } from "@/components/dashboard/profile/fact-list";
import { ResumeForm } from "@/components/dashboard/profile/resume-form";
import { PageTitle } from "@/components/shared/page-title";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <>
      <PageTitle title="Profile" body="The facts every application is built from. Tailored lines can only cite what you confirmed here." />
      <div className="flex flex-col gap-12">
        <FactList />
        <section className="flex flex-col gap-4">
          <h2 className="">Add or replace a resume</h2>
          <ResumeForm />
        </section>
      </div>
    </>
  );
}
