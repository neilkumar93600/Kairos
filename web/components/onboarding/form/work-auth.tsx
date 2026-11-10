"use client";

import { WORK_AUTHORIZATIONS, type WorkAuthorization } from "@auto-career/shared";
import { AUTH_LABEL } from "@/components/dashboard/preferences/preferences-form";
import { Field, Select } from "@/components/shared/field";
import { useMe } from "@/hooks/use-me";
import { draftKey } from "@/lib/onboarding/form-facts";
import { readSession, writeSession } from "@/lib/onboarding/session";
import { useWizard } from "../wizard";

const key = (userId: string) => draftKey(userId, "work-auth");

/** Kept for the rules step across a reload: the choice lives in wizard state, and only the rules step saves it. */
export function storedWorkAuthorization(userId: string): WorkAuthorization | null {
  const v = readSession(key(userId));
  return WORK_AUTHORIZATIONS.find((w) => w === v) ?? null;
}

/** The four WORK_AUTHORIZATIONS in plain words. Nothing to save here: the rules step sends it with the preferences. */
export function WorkAuthSection() {
  const { state, setWorkAuthorization } = useWizard();
  const user = useMe().data?.user.id ?? "";
  return (
    <div className="ob-fields">
      <div className="ob-wide">
        <Field label="Where you can work" htmlFor="ob-work-auth" hint="Kairos uses this to skip jobs you could not take.">
          <Select
            id="ob-work-auth"
            value={state.workAuthorization ?? ""}
            onChange={(e) => {
              const v = WORK_AUTHORIZATIONS.find((w) => w === e.target.value) ?? null;
              setWorkAuthorization(v);
              writeSession(key(user), v);
            }}
          >
            <option value="">Choose one</option>
            {WORK_AUTHORIZATIONS.map((w) => (
              <option key={w} value={w}>
                {AUTH_LABEL[w]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </div>
  );
}
