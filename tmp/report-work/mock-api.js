const http = require("http");

const reportId = "sample-report-001";

const sampleReport = {
  _id: reportId,
  reportType: "HbA1c Laboratory Report",
  originalFileName: "anjali-hba1c-sample.pdf",
  createdAt: "2026-07-18T10:30:00.000Z",
  summary:
    "The report contains HbA1c and estimated average glucose values. Both values are slightly above the provided reference range and should be reviewed with a qualified healthcare professional.",
  abnormalValues: ["HbA1c: 6.1 %", "Estimated Average Glucose: 128 mg/dL"],
  parameters: [
    {
      parameter: "HbA1c",
      value: "6.1 %",
      referenceRange: "4.0-5.6 %",
      status: "High",
    },
    {
      parameter: "Estimated Average Glucose",
      value: "128 mg/dL",
      referenceRange: "70-126 mg/dL",
      status: "High",
    },
    {
      parameter: "Fasting Glucose",
      value: "96 mg/dL",
      referenceRange: "70-100 mg/dL",
      status: "Normal",
    },
  ],
  suggestedQuestions: [
    "What does HbA1c measure?",
    "Which values in this report need review?",
    "What questions should I ask my doctor?",
  ],
};

const reports = [
  sampleReport,
  {
    _id: "sample-report-002",
    reportType: "Complete Blood Count",
    originalFileName: "cbc-followup.pdf",
    createdAt: "2026-07-07T09:00:00.000Z",
    summary: "CBC values are mostly within range, with hemoglobin mildly low.",
    abnormalValues: ["Hemoglobin: 11.2 g/dL"],
    parameters: [
      {
        parameter: "Hemoglobin",
        value: "11.2 g/dL",
        referenceRange: "12.0-15.5 g/dL",
        status: "Low",
      },
    ],
    suggestedQuestions: ["What does low hemoglobin mean?"],
  },
];

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "http://127.0.0.1:5173",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    return sendJson(res, 200, {});
  }

  if (req.url === "/api/auth/login" || req.url === "/api/auth/register") {
    return sendJson(res, 200, { token: "mock-health-lens-token" });
  }

  if (req.url === "/api/reports?limit=50") {
    return sendJson(res, 200, reports);
  }

  if (req.url === "/api/reports/knowledge-base/status") {
    return sendJson(res, 200, {
      success: true,
      status: {
        ready: true,
        provider: "local",
        namespace: "local",
        chunkCount: 42,
        lastIndexedAt: "2026-07-20T10:15:00.000Z",
        lastError: null,
      },
    });
  }

  if (req.url === "/api/reports/knowledge-base/sync" && req.method === "POST") {
    return sendJson(res, 200, {
      success: true,
      message: "Knowledge base synced successfully.",
      status: {
        ready: true,
        provider: "local",
        namespace: "local",
        chunkCount: 42,
        lastIndexedAt: new Date().toISOString(),
        lastError: null,
      },
    });
  }

  if (req.url === `/api/reports/${reportId}`) {
    return sendJson(res, 200, sampleReport);
  }

  if (req.url === `/api/reports/${reportId}/chat-history`) {
    return sendJson(res, 200, [
      {
        question: "Which values need review?",
        answer:
          "Mode: Report interpretation\n\nThe HbA1c and estimated average glucose values are above the reference ranges printed in the uploaded report. This is educational information only and should be reviewed with a qualified healthcare professional.",
      },
    ]);
  }

  if (req.url === "/api/chat" && req.method === "POST") {
    return sendJson(res, 200, {
      success: true,
      answer: {
        answer:
          "Report interpretation: The uploaded HbA1c value is 6.1 %, which is marked High against the report reference range of 4.0-5.6 %. Educational information: HbA1c estimates average blood glucose over roughly the previous two to three months.",
        medicalContext: "mixed",
        foundInContext: true,
        disclaimer:
          "Educational only; not a diagnosis or treatment plan. Please review medical concerns with a qualified healthcare professional.",
        knowledgeBaseNotice: "",
        followUpQuestions: [
          "Were these values fasting or non-fasting?",
          "Should I repeat the test?",
          "What lifestyle factors can affect HbA1c?",
        ],
      },
    });
  }

  sendJson(res, 404, { message: "Not found" });
});

server.listen(5003, "127.0.0.1", () => {
  console.log("Mock Health Lens API running on http://127.0.0.1:5003");
});
