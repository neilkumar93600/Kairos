import type { Metadata } from "next";
import { Suspense } from "react";
import { ResumeWorkspace, WorkspaceSkeleton } from "@/components/resume/workspace";

export const metadata: Metadata = { title: "Resume" };

/** `/resume` and `/resume?job=<jobId>`. The workspace reads the query in the browser, so it renders inside Suspense. */
export default function ResumePage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <ResumeWorkspace />
    </Suspense>
  );
}
