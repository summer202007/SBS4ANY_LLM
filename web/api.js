async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload;
}

export const api = {
  health: () => request("/api/health"),
  loadFixture: () => request("/api/package/load-fixture", { method: "POST" }),
  generatePackage: (payload) =>
    request("/api/package/generate", { method: "POST", body: JSON.stringify(payload) }),
  startPackageGeneration: (payload) =>
    request("/api/package/generate-job", { method: "POST", body: JSON.stringify(payload) }),
  getPackageGenerationJob: (jobId) =>
    request(`/api/package/generation-job?jobId=${encodeURIComponent(jobId)}`),
  importPackageTemplate: (payload) =>
    request("/api/package/import-template", { method: "POST", body: JSON.stringify(payload) }),
  getCurrentPackage: () => request("/api/package/current"),
  getTasks: () => request("/api/tasks"),
  createTask: (payload) =>
    request("/api/tasks/create", { method: "POST", body: JSON.stringify(payload) }),
  selectTask: (taskId) =>
    request("/api/tasks/select", { method: "POST", body: JSON.stringify({ taskId }) }),
  saveCaseCuration: (payload) =>
    request("/api/curation/current", { method: "POST", body: JSON.stringify(payload) }),
  startCollection: () => request("/api/run/start-collection", { method: "POST" }),
  getCurrentRun: () => request("/api/run/current"),
  saveCaseRun: (payload) =>
    request("/api/run/current/case", { method: "POST", body: JSON.stringify(payload) }),
  captureDoubaoCurrentChrome: (payload) =>
    request("/api/captures/doubao/current-chrome", { method: "POST", body: JSON.stringify(payload) }),
  captureChallengerCurrentChrome: (payload) =>
    request("/api/captures/challenger/current-chrome", { method: "POST", body: JSON.stringify(payload) }),
  acceptCapture: (payload) =>
    request("/api/capture/session/accept", { method: "POST", body: JSON.stringify(payload) }),
  discardCapture: (payload) =>
    request("/api/capture/session/discard", { method: "POST", body: JSON.stringify(payload) }),
  suggestNextTurn: (payload) =>
    request("/api/simulator/suggest-next-turn", { method: "POST", body: JSON.stringify(payload) }),
  getGrader: () => request("/api/grader/current"),
  startGraderJob: (payload) =>
    request("/api/grader/run-job", { method: "POST", body: JSON.stringify(payload) }),
  getGraderJob: (jobId) =>
    request(`/api/grader/job?jobId=${encodeURIComponent(jobId)}`),
  saveGraderReviewNotes: (payload) =>
    request("/api/grader/review-notes", { method: "POST", body: JSON.stringify(payload) }),
  exportGraderPdf: () => request("/api/grader/export-pdf", { method: "POST" }),
  getReport: () => request("/api/report/current"),
  downloadReport: () => request("/api/report/download", { method: "POST" }),
};
