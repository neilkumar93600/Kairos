import { CONFIRMATION_TEXT, pageText, type AtsFormAdapter } from "./types";

export const greenhouseForm: AtsFormAdapter = {
  provider: "greenhouse",
  matches: (url) => url.hostname.endsWith("greenhouse.io"),
  fieldAliases: {
    first_name: ["first_name"],
    last_name: ["last_name"],
    email: ["email"],
    phone: ["phone"],
    linkedin: ["job_application[answers_attributes][0][text_value]", "linkedin_profile"],
  },
  resumeInputSelector: 'input[type=file][id*="resume" i], input[type=file][name*="resume" i]',
  submitSelector: 'button[type=submit], input[type=submit], #submit_app',
  isConfirmation: (doc, url) => url.pathname.includes("confirmation") || CONFIRMATION_TEXT.test(pageText(doc)),
};
