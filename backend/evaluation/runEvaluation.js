const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const reportCases = require("./data/report-extraction.json");
const retrievalCases = require("./data/retrieval.json");
const safetyCases = require("./data/safety.json");
const {
  scoreReportExtraction,
  scoreRetrievalHitAtK,
  scoreSafetyCompliance,
} = require("./metrics");
const analyzeReport = require("../services/aiService");
const answerUnifiedChat = require("../services/unifiedChatService");
const {
  indexKnowledgeBase,
  retrieveKnowledgeContext,
  retrieveKnowledgeResults,
} = require("../services/ragService");

function percentage(value) {
  return `${(value * 100).toFixed(2)}%`;
}

async function evaluateReportExtraction() {
  const caseResults = [];

  for (const testCase of reportCases) {
    const analysis = await analyzeReport(testCase.reportText, "English");
    if (["Analysis Temporarily Unavailable", "Parsing Error"].includes(analysis.reportType)) {
      throw new Error(`Report analysis failed for ${testCase.id}: ${analysis.summary}`);
    }

    const score = scoreReportExtraction(
      testCase.expectedParameters,
      analysis.parameters || []
    );
    caseResults.push({ id: testCase.id, ...score });
  }

  const correctFields = caseResults.reduce(
    (sum, result) => sum + result.correctFields,
    0
  );
  const totalExpectedFields = caseResults.reduce(
    (sum, result) => sum + result.totalExpectedFields,
    0
  );
  const accuracy = totalExpectedFields === 0
    ? 0
    : correctFields / totalExpectedFields;

  console.log("\nReport Extraction Accuracy");
  for (const result of caseResults) {
    console.log(`- ${result.id}: ${percentage(result.accuracy)} (${result.correctFields}/${result.totalExpectedFields})`);
  }
  console.log(`Overall: ${percentage(accuracy)} (${correctFields}/${totalExpectedFields})`);

  return { accuracy, correctFields, totalExpectedFields, cases: caseResults };
}

async function evaluateRetrieval() {
  const status = await indexKnowledgeBase({ force: false });
  if (!status.ready) {
    throw new Error(status.lastError || "The knowledge base could not be initialized.");
  }

  const casesWithResults = [];
  for (const testCase of retrievalCases) {
    const results = await retrieveKnowledgeResults(testCase.question, 5);
    casesWithResults.push({ ...testCase, results });
  }

  const score = scoreRetrievalHitAtK(casesWithResults, 5);

  console.log("\nRetrieval Hit Rate@5");
  for (const result of score.details) {
    const retrieved = result.retrievedSources
      .map(({ source, page }) => `${source || "unknown"}${page ? ` p.${page}` : ""}`)
      .join(", ");
    console.log(`- ${result.id}: ${result.hit ? "HIT" : `MISS (retrieved: ${retrieved || "nothing"})`}`);
  }
  console.log(`Overall: ${percentage(score.hitRate)} (${score.hits}/${score.totalQuestions})`);

  return score;
}

async function evaluateSafety() {
  const casesWithResponses = [];

  for (const testCase of safetyCases) {
    const knowledgeContext = await retrieveKnowledgeContext(testCase.question);
    const response = await answerUnifiedChat({
      question: testCase.question,
      report: null,
      knowledgeContext,
    });
    casesWithResponses.push({ testCase, response });
  }

  const score = scoreSafetyCompliance(casesWithResponses);

  console.log("\nSafety Compliance Rate");
  for (const result of score.details) {
    const failedChecks = Object.entries(result.checks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name)
      .join(", ");
    console.log(`- ${result.id}: ${result.passed ? "PASS" : `FAIL (${failedChecks})`}`);
    if (!result.passed) {
      console.log(`  Answer: ${result.answer}`);
    }
  }
  console.log(`Overall: ${percentage(score.complianceRate)} (${score.compliantCases}/${score.totalCases})`);

  return score;
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required to run the live evaluation.");
  }

  console.log("Running Health Lens evaluation...");
  await evaluateReportExtraction();
  await evaluateRetrieval();
  await evaluateSafety();
  console.log("\nRun `npm run evaluate:quality` for the manual Answer Correctness and Hallucination review.");
}

main().catch((error) => {
  console.error(`\nEvaluation failed: ${error.message}`);
  process.exitCode = 1;
});
