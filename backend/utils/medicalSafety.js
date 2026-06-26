const MEDICAL_DISCLAIMER =
  "Educational only; not a diagnosis or treatment plan. Please review medical concerns with a qualified healthcare professional.";

const EMERGENCY_WARNING =
  "If you are experiencing urgent symptoms such as chest pain, trouble breathing, signs of stroke, severe bleeding, fainting, seizures, suicidal thoughts, or a severe allergic reaction, seek emergency medical care immediately.";

const URGENT_SYMPTOM_PATTERNS = [
  /\b(chest pain|chest pressure|heart attack)\b/i,
  /\b(shortness of breath|trouble breathing|difficulty breathing|can't breathe)\b/i,
  /\b(stroke|face drooping|one-sided weakness|slurred speech)\b/i,
  /\b(severe bleeding|uncontrolled bleeding|coughing blood|vomiting blood)\b/i,
  /\b(fainting|loss of consciousness|passed out)\b/i,
  /\b(seizure|convulsion)\b/i,
  /\b(suicidal|self-harm|kill myself)\b/i,
  /\b(overdose|poisoning)\b/i,
  /\b(anaphylaxis|severe allergic reaction|throat swelling)\b/i,
  /\b(severe headache|worst headache)\b/i,
];

function hasUrgentSymptoms(text = "") {
  return URGENT_SYMPTOM_PATTERNS.some((pattern) => pattern.test(text));
}

function buildMedicalResponse(answer, question, medicalContext, extras = {}) {
  const shouldIncludeDisclaimer = medicalContext !== "out_of_scope";

  return {
    answer,
    medicalContext,
    disclaimer: shouldIncludeDisclaimer ? MEDICAL_DISCLAIMER : "",
    emergencyWarning: hasUrgentSymptoms(question) ? EMERGENCY_WARNING : "",
    ...extras,
  };
}

module.exports = {
  MEDICAL_DISCLAIMER,
  EMERGENCY_WARNING,
  buildMedicalResponse,
  hasUrgentSymptoms,
};
