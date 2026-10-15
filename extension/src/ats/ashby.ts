import { CONFIRMATION_TEXT, pageText, type AtsFormAdapter } from "./types";

export const ashbyForm: AtsFormAdapter = {
  provider: "ashby",
  matches: (url) => url.hostname === "jobs.ashbyhq.com",
  fieldAliases: {
    full_name: ["_systemfield_name"],
    email: ["_systemfield_email"],
    phone: ["_systemfield_phone"],
    linkedin: ["_systemfield_linkedin"],
  },
  resumeInputSelector: 'input[type=file][id*="resume" i], input[type=file][name*="resume" i]',
  submitSelector: 'button[type=submit], button[class*="submit" i]',
  isConfirmation: (doc) => CONFIRMATION_TEXT.test(pageText(doc)),
};
