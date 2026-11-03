import type { AgentCallContext } from "../agents/types";
import { env } from "../lib/env";

/**
 * The P1 switch (01-architecture.md B.14): when `LLM_GATEWAY=anthropic`, the services route every
 * model call through runAgent; when `legacy`, the old chatJson path runs and the gateway code
 * stays loaded but idle. The old client is removed in P3.
 */
export const gatewayEnabled = (): boolean => env().LLM_GATEWAY === "anthropic";

/**
 * The context a caller hands a service: the gateway's call context while LLM_GATEWAY=anthropic, undefined on legacy.
 * A service takes the gateway path whenever it is given a context, so this keeps the switch in one place while every
 * caller still passes its user, plan and ids (llm-agents-02): per-user caps, user_daily_usage, user_hash and the stable
 * fence nonce all key off ctx.userId.
 */
export const gatewayCtx = (ctx: AgentCallContext): AgentCallContext | undefined => (gatewayEnabled() ? ctx : undefined);

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
