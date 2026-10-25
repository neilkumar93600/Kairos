"use client";

import { useMutation } from "@tanstack/react-query";
import type { DraftRequest } from "@auto-career/shared";
import { post } from "@/lib/api";

/** Draft an answer or the cover letter from facts and saved answers. 422 profile_only for protected questions. */
export function useDraftText(applicationId: string) {
  return useMutation({
    mutationFn: (input: DraftRequest) => post<{ text: string; factIds: string[] }>(`/applications/${applicationId}/drafts`, input),
  });
}

/**
 * Questions answered only from the profile or saved answers, never by a model (spec section 3 rule 6).
 * Matched against the field key and label, lowercased.
 */
// Kept in step with the server list (backend review, 2026-10-23): it also refuses citizenship, green card, immigration,
// "legally able to work", CTC, pay and LGBTQ questions. Narrow on purpose: "able to work weekends" stays draftable.
export const PROFILE_ONLY = /\b(gender|race|ethnic|hispanic|latino|veteran|disabilit|sexual orientation|lgbt|transgender|pronoun|visa|sponsor|citizen|green card|immigra|work authori[sz]ation|authori[sz]ed to work|legally (able|eligible|permitted) to work|salary|compensation|ctc\b|pay\b|pay expectation)/i;

// "_" is a word character, so a word boundary never fires inside "eeo_gender": spaces stand in for _ and - first.
const words = (s: string) => s.replace(/[_-]+/g, " ");
/** Test a question by its field key and its label. Catches snake_case and kebab-case keys too. */
export const isProfileOnly = (fieldKey: string, label = "") => PROFILE_ONLY.test(words(fieldKey)) || PROFILE_ONLY.test(words(label));
