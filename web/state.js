export const state = {
  currentView: "tasks",
  health: null,
  packageState: null,
  cases: {
    selectedCaseId: null,
    caseTypeFilter: "all",
    caseStatusFilter: "all",
  },
  collect: {
    selectedCaseId: null,
    challengerCaptureSetup: {},
  },
  packageGeneration: {
    job: null,
  },
  grader: {
    job: null,
    bundle: null,
    pdfExporting: false,
  },
};

export function setHealth(value) {
  state.health = value;
}

export function setPackageState(value) {
  state.packageState = value;
}

export function setCurrentView(value) {
  state.currentView = value;
}

export function setCaseUiState(value) {
  state.cases = { ...state.cases, ...value };
}

export function setCollectUiState(value) {
  state.collect = { ...state.collect, ...value };
}

export function setPackageGenerationState(value) {
  state.packageGeneration = { ...state.packageGeneration, ...value };
}

export function setGraderState(value) {
  state.grader = { ...state.grader, ...value };
}
