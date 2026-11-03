/**
 * A seeded resume for the fail-closed parse test (CISO mustFix 6): contact header, personal-details lines and real
 * experience. None of `leaks` may reach a model call; every line of `kept` must.
 */
export const profile = { name: "Jane Doe", email: "jane.doe@example.com", phone: "+1 (415) 555-0132", links: ["https://www.linkedin.com/in/janedoe"] };

export const kept = ["Experience", "Built the billing service at Nordbeam in TypeScript", "Fixed race conditions in the payout scheduler"];

export const resumeText = [
  "JANE DOE",
  "jane.doe@example.com | +1 (415) 555-0132 | linkedin.com/in/janedoe",
  "Date of Birth: 14/03/1994 | Gender: Female | Marital Status: Married",
  "Nationality: Indian, Religion: Hindu",
  "Visa Status: H-1B, requires sponsorship from 2026",
  "Work Authorization: EAD (STEM OPT)",
  "Current CTC: 18 LPA, Expected salary $140,000",
  "Passport No: K1234567",
  "SSN 123-45-6789",
  "Aadhaar 1234 5678 9012, PAN ABCPD1234E",
  "Disability: None. Veteran Status: Protected veteran",
  "Ethnicity: Asian (she/her)",
  ...kept,
].join("\n");

export const leaks = [
  "Jane",
  "jane.doe@example.com",
  "555-0132",
  "linkedin.com/in/janedoe",
  "14/03/1994",
  "Female",
  "Married",
  "Indian",
  "Hindu",
  "H-1B",
  "sponsorship",
  "STEM OPT",
  "LPA",
  "140,000",
  "K1234567",
  "123-45-6789",
  "1234 5678 9012",
  "ABCPD1234E",
  "Disability",
  "veteran",
  "Asian",
  "she/her",
];
