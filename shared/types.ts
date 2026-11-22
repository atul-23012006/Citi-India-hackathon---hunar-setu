// Shared data model. Every module (browser engine, server, Claude tools) speaks these types.

export type Lang = "en" | "hi" | "ta" | "kn";
export type I18n = Partial<Record<Lang, string>> & { en: string };

export type Interest =
  | "hands_on" // fixing, building, machines
  | "nature" // farming, animals, outdoors
  | "caring" // health, helping people
  | "numbers" // business, accounts, selling
  | "creative" // art, craft, design, tailoring
  | "talking" // teaching, people, speaking
  | "computers" // phones, computers, digital
  | "uniform" // service, discipline, physical
  | "cooking"; // food, hospitality

export type EducationLevel =
  | "class8"
  | "class9"
  | "class10"
  | "class11"
  | "class12"
  | "iti"
  | "diploma"
  | "ug"
  | "pg";

export type Category = "GEN" | "EWS" | "OBC" | "SC" | "ST";

export type DocKey =
  | "aadhaar"
  | "bank_account"
  | "aadhaar_seeded"
  | "income_cert"
  | "caste_cert"
  | "domicile_cert"
  | "disability_cert"
  | "marksheet_10"
  | "marksheet_12"
  | "bonafide";

export interface StudentProfile {
  id: string;
  name: string;
  pinHash?: string; // shared-phone mode: each student unlocks their own space
  lang: Lang;
  age?: number;
  gender?: "female" | "male" | "other";
  education?: EducationLevel;
  // still studying vs. finished / dropped out; drives scheme eligibility
  inEducation?: boolean;
  marksPercent?: number;
  state?: string; // ISO-like short code, e.g. "TN", "KA"
  district?: string;
  pincode?: string;
  category?: Category;
  minority?: boolean;
  disabilityPercent?: number;
  familyIncome?: number; // annual, rupees
  govtEmployeeInFamily?: boolean;
  interests: Interest[];
  skills: string[]; // demonstrated or declared skill tags
  demonstrated: { task: string; score: number; at: string }[];
  canRelocate?: boolean;
  maxDistanceKm?: number;
  needsHostel?: boolean;
  goals?: string;
  chosenOccupation?: string;
  consent?: { at: string; guardian: boolean }; // DPDP: guardian consent for under-18s
  docs: Partial<Record<DocKey, boolean>>;
  facilitatorId?: string;
  accountId?: string; // formal account on the hub's Postgres; unlocked by password, not PIN
  updatedAt: string;
}

// ---- Knowledge base ----

export interface Source {
  name: string;
  url?: string;
  asOf: string; // YYYY-MM date the record was last checked
}

export interface Occupation {
  id: string;
  nco: string; // NCO-2015 unit group (4-digit, ISCO-08 aligned)
  name: I18n;
  summary: I18n;
  interests: Interest[];
  track: "vocational" | "degree" | "service" | "self_employed" | "green" | "care" | "agri" | "digital" | "creative";
  minEducation: EducationLevel;
  nsqfLevel?: number;
  steps: PathwayStep[]; // ordered: what to learn next
  exams: string[]; // exam ids
  schemes: string[]; // scheme ids relevant to this route
  demandNote?: string; // why this route is real now (with source)
  sources: Source[];
}

export interface PathwayStep {
  label: I18n;
  courseId?: string;
  duration?: string;
}

export interface Course {
  id: string;
  name: string;
  provider: "DIKSHA" | "SWAYAM" | "Skill India Digital Hub" | "NCVT ITI" | "NIOS" | "PMKVY" | "DGCA RPTO" | "NISE" | "State" | "University" | "Facilitator";
  mode: "online" | "classroom" | "blended";
  duration: string;
  cost: "free" | "fee" | "stipend";
  minEducation: EducationLevel;
  url?: string;
  sources: Source[];
}

export interface Exam {
  id: string;
  name: string;
  body: string;
  forWhat: string;
  minEducation: EducationLevel;
  ageMin?: number;
  ageMax?: number;
  typicalMonth?: string;
  url?: string;
  sources: Source[];
}

// Eligibility rules are data so a state can correct one without a code release.
export type Condition =
  | { kind: "age"; min?: number; max?: number }
  | { kind: "education"; anyOf: EducationLevel[] }
  | { kind: "inEducation"; value: boolean }
  | { kind: "category"; anyOf: Category[] }
  | { kind: "minority"; value: true }
  | { kind: "gender"; anyOf: ("female" | "male" | "other")[] }
  | { kind: "incomeMax"; value: number }
  | { kind: "marksMin"; value: number }
  | { kind: "disabilityMin"; value: number }
  | { kind: "state"; anyOf: string[] }
  | { kind: "noGovtEmployeeInFamily" }
  | { kind: "doc"; doc: DocKey };

export interface Scheme {
  id: string;
  name: string;
  ministry: string;
  type: "scholarship" | "stipend" | "apprenticeship" | "internship" | "training" | "enterprise" | "employment_incentive";
  benefit: I18n;
  benefitRupeesPerYear?: number; // for true-cost and "rupees that landed"
  conditions: Condition[];
  notes?: string;
  applyAt: string; // portal URL
  window?: string; // indicative application window
  dbt: boolean; // paid by Direct Benefit Transfer: needs an Aadhaar-seeded account
  sources: Source[];
}

export interface Opportunity {
  id: string;
  kind: "apprenticeship" | "internship" | "job" | "mentor" | "training";
  title: string;
  employer: string;
  employerVerified: boolean;
  epfRegistered: boolean;
  district: string;
  state: string;
  distanceKmFromHub?: number;
  stipendMonthly?: number;
  hostel: boolean;
  womenStaffed: boolean;
  occupationIds: string[];
  minEducation: EducationLevel;
  schemeIds: string[]; // schemes that co-pay (NAPS, PM Internship...)
  seats: number;
  demo: true; // every listing in this prototype is synthetic and labelled as such
  postedBy: string;
}

export interface Doc {
  key: DocKey;
  name: I18n;
  issuer: string;
  typicalDays: number; // indicative; varies by state service-guarantee law
  inDigiLocker: boolean;
  howTo: I18n;
}
