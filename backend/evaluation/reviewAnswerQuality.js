const fs = require("fs").promises;
const path = require("path");
const readline = require("readline/promises");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const answerCases = require("./data/answer-quality.json");
const {
  scoreAnswerCorrectness,
  scoreHallucinationRate,
} = require("./metrics");
const answerUnifiedChat = require("../services/unifiedChatService");
const {
  indexKnowledgeBase,
  retrieveKnowledgeContext,
} = require("../services/ragService");

const RESULTS_PATH = path.join(__dirname, "results/answer-review.json");

function percentage(value) {
  return `${(value * 100).toFixed(2)}%`;
}

async function askForCorrectnessScore(terminal) {
  while (true) {
    const value = Number(await terminal.question(
      "Correctness score (0 = incorrect, 1 = partial, 2 = fully correct): "
    ));
    if (Number.isInteger(value) && value >= 0 && value <= 2) {
      return value;
    }
    console.log("Please enter 0, 1, or 2.");
  }
}

async function askForHallucinationLabel(terminal) {
  while (true) {
    const value = (await terminal.question(
      "Does the answer contain any unsupported medical fact or patient value? (y/n): "
    )).trim().toLowerCase();
    if (value === "y" || value === "yes") return true;
    if (value === "n" || value === "no") return false;
    console.log("Please enter y or n.");
  }
}

async function saveReview(results) {
  await fs.mkdir(path.dirname(RESULTS_PATH), { recursive: true });
  await fs.writeFile(
    RESULTS_PATH,
    JSON.stringify({
      reviewedAt: new Date().toISOString(),
      model: process.env.GEMINI_ANALYSIS_MODEL || "gemini-3.1-flash-lite",
      results,
    }, null, 2)
  );
}

async function main() {
  if (!process.stdin.isTTY) {
    throw new Error("Manual review requires an interactive terminal.");
  }
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required to generate answers for review.");
  }

  const status = await indexKnowledgeBase({ force: false });
  if (!status.ready) {
    throw new Error(status.lastError || "The knowledge base could not be initialized.");
  }

  const terminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const results = [];

  try {
    for (const [index, testCase] of answerCases.entries()) {
      const knowledgeContext = await retrieveKnowledgeContext(testCase.question);
      const response = await answerUnifiedChat({
        question: testCase.question,
        report: null,
        knowledgeContext,
      });

      console.log(`\nAnswer Review ${index + 1}/${answerCases.length}: ${testCase.id}`);
      console.log(`Question:\n${testCase.question}`);
      console.log(`\nReference answer:\n${testCase.referenceAnswer}`);
      console.log(`\nGenerated answer:\n${response.answer}`);
      console.log(`\nRetrieved evidence:\n${knowledgeContext.context || "No context retrieved."}`);

      const correctnessScore = await askForCorrectnessScore(terminal);
      const hasUnsupportedClaims = await askForHallucinationLabel(terminal);

      results.push({
        id: testCase.id,
        question: testCase.question,
        referenceAnswer: testCase.referenceAnswer,
        generatedAnswer: response.answer,
        citations: knowledgeContext.citations,
        retrievedContext: knowledgeContext.context,
        correctnessScore,
        hasUnsupportedClaims,
      });
      await saveReview(results);
    }
  } finally {
    terminal.close();
  }

  const correctness = scoreAnswerCorrectness(results);
  const hallucination = scoreHallucinationRate(results);

  console.log("\nAnswer Correctness");
  console.log(`Overall: ${correctness.averageScore.toFixed(2)}/2 (${percentage(correctness.normalizedScore)})`);
  console.log("\nHallucination Rate");
  console.log(`Overall: ${percentage(hallucination.hallucinationRate)} (${hallucination.unsupportedAnswers}/${hallucination.reviewedAnswers})`);
  console.log(`\nReview saved to ${RESULTS_PATH}`);
}

main().catch((error) => {
  console.error(`\nAnswer review failed: ${error.message}`);
  process.exitCode = 1;
});
