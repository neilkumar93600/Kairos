import type { ResumeParserInput } from "./schema";
import type { RenderedPrompt } from "../types";
import { fence } from "../../llm/fence";

/** Pure render: the resume text is user-authored data, so it is fenced and uncached (7.1). */
export function renderResumeParser(input: ResumeParserInput): RenderedPrompt {
  return {
    task: "Split the resume into atomic facts.",
    untrusted: [{ label: "resume_text", text: input.resumeText, maxTokens: 3_000 }],
  };
}
