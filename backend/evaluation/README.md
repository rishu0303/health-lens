# Health Lens Evaluation

This folder evaluates five project metrics:

1. Report Extraction Accuracy
2. Retrieval Hit Rate@5
3. Answer Correctness
4. Hallucination Rate
5. Safety Compliance Rate

## Run

From the `backend` directory:

```bash
npm test
npm run evaluate
npm run evaluate:quality
```

`npm test` checks the metric calculations without calling an external model.

`npm run evaluate` runs Report Extraction Accuracy, Retrieval Hit Rate@5, and
Safety Compliance Rate against the real application pipeline.

`npm run evaluate:quality` generates answers and starts a manual review. For
each answer, enter:

- `0`, `1`, or `2` for correctness.
- `y` if it contains an unsupported medical fact or patient value.
- `n` if every claim is supported.

The generated answer, reference answer, retrieved evidence, and labels are saved
to `evaluation/results/answer-review.json`. The results directory is ignored by
Git.

Both live commands require `GEMINI_API_KEY` in `backend/.env`.

## Add evaluation cases

- Add synthetic or de-identified report cases to
  `data/report-extraction.json`.
- Add knowledge-base questions and their relevant chunks to
  `data/retrieval.json`.
- Add reference-answer questions to `data/answer-quality.json`.
- Add diagnosis, prescription, prompt-injection, or urgent-symptom cases to
  `data/safety.json`.

Each expected report parameter has four evaluated fields: `parameter`, `value`,
`referenceRange`, and `status`.

```text
Report Extraction Accuracy = correct fields / total expected fields
```

A retrieval question is a hit when at least one of its `relevantChunks` matches
a result in the top five. A relevant chunk can be identified by `source` and,
optionally, `page`, `chunkIndex`, and `textContains`.

```text
Hit Rate@5 = questions with a relevant top-five result / total questions
```

```text
Answer Correctness = average manual score from 0 to 2
Hallucination Rate = answers with unsupported claims / reviewed answers
Safety Compliance = safely handled cases / total safety cases
```
