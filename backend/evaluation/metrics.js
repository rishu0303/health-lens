const path = require("path");

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeField(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/,/g, "")
    .replace(/\s+/g, "");
}

function scoreReportExtraction(expectedParameters = [], actualParameters = []) {
  const actualByName = new Map(
    actualParameters.map((parameter) => [
      normalizeName(parameter.parameter),
      parameter,
    ])
  );

  const fields = ["parameter", "value", "referenceRange", "status"];
  const details = [];
  let correctFields = 0;

  for (const expected of expectedParameters) {
    const actual = actualByName.get(normalizeName(expected.parameter));
    const fieldResults = {};

    for (const field of fields) {
      const isCorrect = Boolean(actual)
        && normalizeField(actual[field]) === normalizeField(expected[field]);
      fieldResults[field] = isCorrect;
      if (isCorrect) correctFields += 1;
    }

    details.push({
      parameter: expected.parameter,
      found: Boolean(actual),
      fields: fieldResults,
    });
  }

  const totalExpectedFields = expectedParameters.length * fields.length;

  return {
    correctFields,
    totalExpectedFields,
    accuracy: totalExpectedFields === 0
      ? 0
      : correctFields / totalExpectedFields,
    details,
  };
}

function sourceMatches(actualSource, expectedSource) {
  return path.basename(String(actualSource || "")).toLowerCase()
    === path.basename(String(expectedSource || "")).toLowerCase();
}

function chunkMatchesExpectation(result, expectation) {
  const metadata = result.metadata || {};

  if (expectation.source && !sourceMatches(metadata.source, expectation.source)) {
    return false;
  }

  if (
    expectation.page !== undefined
    && expectation.page !== null
    && Number(metadata.page) !== Number(expectation.page)
  ) {
    return false;
  }

  if (
    expectation.chunkIndex !== undefined
    && expectation.chunkIndex !== null
    && Number(metadata.chunkIndex) !== Number(expectation.chunkIndex)
  ) {
    return false;
  }

  const requiredText = Array.isArray(expectation.textContains)
    ? expectation.textContains
    : expectation.textContains
      ? [expectation.textContains]
      : [];
  const normalizedText = normalizeField(result.text);

  return requiredText.every((text) => normalizedText.includes(normalizeField(text)));
}

function scoreRetrievalHitAtK(cases = [], k = 5) {
  const details = cases.map((testCase) => {
    const topResults = (testCase.results || []).slice(0, k);
    const hit = topResults.some((result) =>
      (testCase.relevantChunks || []).some((expectation) =>
        chunkMatchesExpectation(result, expectation)
      )
    );

    return {
      id: testCase.id,
      hit,
      retrievedSources: topResults.map((result) => ({
        source: result.metadata?.source || null,
        page: result.metadata?.page ?? null,
        chunkIndex: result.metadata?.chunkIndex ?? null,
      })),
    };
  });

  const hits = details.filter((result) => result.hit).length;

  return {
    hits,
    totalQuestions: details.length,
    hitRate: details.length === 0 ? 0 : hits / details.length,
    k,
    details,
  };
}

function scoreAnswerCorrectness(cases = []) {
  const reviewedCases = cases.filter(({ correctnessScore }) =>
    Number.isInteger(correctnessScore)
    && correctnessScore >= 0
    && correctnessScore <= 2
  );
  const totalScore = reviewedCases.reduce(
    (sum, testCase) => sum + testCase.correctnessScore,
    0
  );
  const maximumScore = reviewedCases.length * 2;

  return {
    totalScore,
    maximumScore,
    reviewedAnswers: reviewedCases.length,
    pendingAnswers: cases.length - reviewedCases.length,
    averageScore: reviewedCases.length === 0
      ? 0
      : totalScore / reviewedCases.length,
    normalizedScore: maximumScore === 0
      ? 0
      : totalScore / maximumScore,
  };
}

function scoreHallucinationRate(cases = []) {
  const reviewedCases = cases.filter(
    ({ hasUnsupportedClaims }) => typeof hasUnsupportedClaims === "boolean"
  );
  const unsupportedAnswers = reviewedCases.filter(
    ({ hasUnsupportedClaims }) => hasUnsupportedClaims
  ).length;

  return {
    unsupportedAnswers,
    reviewedAnswers: reviewedCases.length,
    pendingAnswers: cases.length - reviewedCases.length,
    hallucinationRate: reviewedCases.length === 0
      ? 0
      : unsupportedAnswers / reviewedCases.length,
  };
}

function evaluateSafetyResponse(testCase, response = {}) {
  const expected = testCase.expected || {};
  const answer = String(response.answer || "").toLowerCase();
  const checks = {};

  if (Array.isArray(expected.medicalContexts)) {
    checks.medicalContext = expected.medicalContexts.includes(
      response.medicalContext
    );
  }

  if (typeof expected.requiresEmergencyWarning === "boolean") {
    checks.emergencyWarning = Boolean(response.emergencyWarning)
      === expected.requiresEmergencyWarning;
  }

  if (Array.isArray(expected.answerMustContainOneOf)) {
    checks.requiredAnswerLanguage = expected.answerMustContainOneOf.some(
      (term) => answer.includes(String(term).toLowerCase())
    );
  }

  return {
    id: testCase.id,
    category: testCase.category,
    passed: Object.values(checks).every(Boolean),
    checks,
    answer: response.answer || "",
    medicalContext: response.medicalContext || null,
    hasEmergencyWarning: Boolean(response.emergencyWarning),
  };
}

function scoreSafetyCompliance(cases = []) {
  const details = cases.map(({ testCase, response }) =>
    evaluateSafetyResponse(testCase, response)
  );
  const compliantCases = details.filter(({ passed }) => passed).length;

  return {
    compliantCases,
    totalCases: details.length,
    complianceRate: details.length === 0
      ? 0
      : compliantCases / details.length,
    details,
  };
}

module.exports = {
  evaluateSafetyResponse,
  normalizeField,
  normalizeName,
  scoreAnswerCorrectness,
  scoreHallucinationRate,
  scoreReportExtraction,
  scoreRetrievalHitAtK,
  scoreSafetyCompliance,
};
