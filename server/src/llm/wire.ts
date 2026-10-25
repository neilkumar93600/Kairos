import type { AgentCallContext } from "../agents/types";
import { env } from "../lib/env";

/**
 * The P1 switch (01-architecture.md B.14): when `LLM_GATEWAY=anthropic`, the services route every
 * model call through runAgent; when `legacy`, the old chatJson path runs and the gateway code
 * stays loaded but idle. The old client is removed in P3.
 */
export const gatewayEnabled = (): boolean => env().LLM_GATEWAY === "anthropic";

/** Builds a call context from the pieces services have at hand. */
export function serviceCtx(input: {
  userId?: string;
  jobId?: string;
  applicationId?: string;
  plan?: AgentCallContext["plan"];
  inputRefs?: Record<string, string[]>;
}): AgentCallContext {
  return {
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.jobId ? { jobId: input.jobId } : {}),
    ...(input.applicationId ? { applicationId: input.applicationId } : {}),
    ...(input.plan ? { plan: input.plan } : {}),
    ...(input.inputRefs ? { inputRefs: input.inputRefs } : {}),
  };
}
