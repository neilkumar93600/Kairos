"use client";

import type { Contact } from "@/hooks/use-onboarding";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useMe } from "@/hooks/use-me";
import { useProfile, type Profile } from "@/hooks/use-profile";
import { ApiError } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { SectionAlert, TextField, useSection, type SectionProps } from "./kit";

/** PUT /profile/contact replaces all six fields: what this section does not edit goes back as it is. */
export const contactOf = (p: Profile | undefined): Contact => ({
  phone: p?.phone ?? null,
  city: p?.city ?? null,
  country: p?.country ?? null,
  linkedinUrl: p?.linkedinUrl ?? null,
  githubUrl: p?.githubUrl ?? null,
  portfolioUrl: p?.portfolioUrl ?? null,
});

const orNull = (v: string) => v.trim() || null;

/** Full name on the account (Better Auth), email read-only, phone and place on the profile. No headline: it would cite no fact. */
export function ContactSection({ bind }: SectionProps) {
  const me = useMe();
  const profile = useProfile();
  const { saveContact } = useOnboarding();
  const s = useSection({
    name: "contact",
    bind,
    initial: () => ({ name: me.data?.user.name ?? "", phone: profile.data?.phone ?? "", city: profile.data?.city ?? "", country: profile.data?.country ?? "" }),
    validate: (v): Record<string, string> => (v.name.trim() ? {} : { "ob-name": "Enter your full name." }),
    save: async (v) => {
      const name = v.name.trim();
      if (name !== me.data?.user.name) {
        const { error } = await authClient.updateUser({ name });
        if (error) throw new ApiError(error.status, "name", error.message ?? "Could not save your name. Try again.");
      }
      await saveContact.mutateAsync({ ...contactOf(profile.data), phone: orNull(v.phone), city: orNull(v.city), country: orNull(v.country) });
    },
  });
  const v = s.value;
  return (
    <div className="ob-fields">
      <TextField {...s.field("ob-name")} wide label="Full name" autoComplete="name" maxLength={120} aria-required value={v.name} onChange={(name) => s.set({ ...v, name })} />
      <TextField
        id="ob-email"
        wide
        label="Email"
        type="email"
        autoComplete="email"
        readOnly
        className="read-only:bg-sunk"
        hint="From your account. Applications use it."
        value={me.data?.user.email ?? ""}
        onChange={() => {}}
      />
      <TextField {...s.field("ob-phone")} label="Phone" type="tel" autoComplete="tel" maxLength={40} value={v.phone} onChange={(phone) => s.set({ ...v, phone })} />
      <TextField {...s.field("ob-city")} label="City" autoComplete="address-level2" maxLength={120} value={v.city} onChange={(city) => s.set({ ...v, city })} />
      <TextField {...s.field("ob-country")} label="Country" autoComplete="country-name" maxLength={120} value={v.country} onChange={(country) => s.set({ ...v, country })} />
      <SectionAlert message={s.alert} />
    </div>
  );
}
