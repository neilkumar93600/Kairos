import { CONFIRMATION_TEXT, pageText, type AtsFormAdapter } from "./types";

export const leverForm: AtsFormAdapter = {
  provider: "lever",
  matches: (url) => url.hostname === "jobs.lever.co",
  fieldAliases: {
    // Lever asks for one full-name field.
    full_name: ["name"],
    email: ["email"],
    phone: ["phone"],
    linkedin: ["urls[LinkedIn]"],
    github: ["urls[GitHub]"],
    portfolio: ["urls[Portfolio]", "urls[Other]"],
  },
  resumeInputSelector: 'input[type=file][name="resume"]',
  submitSelector: 'button[type=submit], #btn-submit',
  isConfirmation: (doc, url) => url.pathname.endsWith("/thanks") || CONFIRMATION_TEXT.test(pageText(doc)),
};
