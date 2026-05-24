/**
 * ENAZIZI — k6 Load Test
 * Simulates 59 concurrent users across different behavioral profiles.
 *
 * Run: k6 run tests/load/k6-load-test.js
 * Env:  BASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, TEST_USER_EMAIL, TEST_USER_PASSWORD
 */

import http from "k6/http";
import { check, group, sleep, fail } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import { SharedArray } from "k6/data";

/* ─── Custom metrics ─── */
const errorRate = new Rate("error_rate");
const studyNextDuration = new Trend("study_next_duration", true);
const studyCompleteDuration = new Trend("study_complete_duration", true);
const analyticsDuration = new Trend("analytics_snapshot_duration", true);
const explainSimpleDuration = new Trend("explain_simple_duration", true);
const summarizeDuration = new Trend("summarize_topic_duration", true);
const generateQuestionDuration = new Trend("generate_question_duration", true);
const loginDuration = new Trend("login_duration", true);
const endpointErrors = new Counter("endpoint_errors");

/* ─── Config ─── */
const BASE = __ENV.SUPABASE_URL || "https://qszsyskumcmuknumwxtk.supabase.co";
const ANON_KEY =
  __ENV.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzenN5c2t1bWNtdWtudW13eHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDUwNjUsImV4cCI6MjA4NjIyMTA2NX0.B2Si8zb8YJcDhIsyj6edriyXsG3p2rP-NLrGfBFAoZw";
const TEST_EMAIL = __ENV.TEST_USER_EMAIL || "test-user@enazizi.com";
const TEST_PASSWORD = __ENV.TEST_USER_PASSWORD || "TestPass123!";

const headers = {
  "Content-Type": "application/json",
  apikey: ANON_KEY,
  Authorization: "", // filled after login
};

/* ─── Thresholds ─── */
export const options = {
  scenarios: {
    light_users: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 20 },
        { duration: "2m", target: 20 },
        { duration: "30s", target: 0 },
      ],
      exec: "lightUser",
    },
    moderate_users: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 15 },
        { duration: "2m", target: 15 },
        { duration: "30s", target: 0 },
      ],
      exec: "moderateUser",
    },
    intense_users: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 10 },
        { duration: "2m", target: 10 },
        { duration: "30s", target: 0 },
      ],
      exec: "intenseUser",
    },
    abandon_users: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 7 },
        { duration: "1m", target: 7 },
        { duration: "30s", target: 0 },
      ],
      exec: "abandonUser",
    },
    error_users: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 5 },
        { duration: "2m", target: 5 },
        { duration: "30s", target: 0 },
      ],
      exec: "errorUser",
    },
    quick_action_users: {
      executor: "constant-vus",
      vus: 2,
      duration: "2m30s",
      exec: "quickActionUser",
    },
  },
  thresholds: {
    error_rate: [{ threshold: "rate<0.03", abortOnFail: true }],
    study_next_duration: ["p(95)<2500", "p(99)<5000"],
    study_complete_duration: ["p(95)<2500", "p(99)<5000"],
    analytics_snapshot_duration: ["p(95)<2500", "p(99)<5000"],
    explain_simple_duration: ["p(95)<2500", "p(99)<5000"],
    summarize_topic_duration: ["p(95)<2500", "p(99)<5000"],
    generate_question_duration: ["p(95)<2500", "p(99)<5000"],
    login_duration: ["p(95)<3000"],
  },
};

/* ─── Helpers ─── */
function login() {
  const res = http.post(
    `${BASE}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    { headers: { "Content-Type": "application/json", apikey: ANON_KEY }, tags: { endpoint: "login" } }
  );
  loginDuration.add(res.timings.duration);
  const ok = check(res, { "login 200": (r) => r.status === 200 });
  errorRate.add(!ok);
  if (!ok) { endpointErrors.add(1, { endpoint: "login" }); return null; }
  const token = res.json("access_token");
  return `Bearer ${token}`;
}

function invoke(fnName, body, metricTrend) {
  const res = http.post(
    `${BASE}/functions/v1/${fnName}`,
    JSON.stringify(body),
    { headers, tags: { endpoint: fnName } }
  );
  if (metricTrend) metricTrend.add(res.timings.duration);
  const ok = check(res, { [`${fnName} ok`]: (r) => r.status === 200 });
  errorRate.add(!ok);
  if (!ok) endpointErrors.add(1, { endpoint: fnName });
  return res;
}

function authSetup() {
  const bearer = login();
  if (!bearer) fail("login failed");
  headers.Authorization = bearer;
}

/* ─── Scenarios ─── */

export function lightUser() {
  authSetup();
  group("light — study-next", () => {
    invoke("study-next", { context: {} }, studyNextDuration);
    sleep(2);
  });
  group("light — study-complete", () => {
    invoke("study-complete", {
      actionType: "free_study", wasCorrect: true,
      themeId: "light-theme", topicId: "light-topic",
      metadata: { source: "k6_load", originModule: "study_loop" },
    }, studyCompleteDuration);
    sleep(3);
  });
}

export function moderateUser() {
  authSetup();
  for (let i = 0; i < 3; i++) {
    group(`moderate — loop ${i + 1}`, () => {
      invoke("study-next", { context: {} }, studyNextDuration);
      sleep(1);
      invoke("generate-adaptive-question", {
        theme: "moderate-theme", subtopic: "", difficulty: "medium", context: {},
      }, generateQuestionDuration);
      sleep(2);
      invoke("study-complete", {
        actionType: "daily_task", wasCorrect: i % 2 === 0,
        themeId: "moderate-theme", topicId: "moderate-topic",
        metadata: { source: "k6_load", originModule: "study_loop" },
      }, studyCompleteDuration);
      sleep(1);
    });
  }
  invoke("analytics-snapshot", {}, analyticsDuration);
}

export function intenseUser() {
  authSetup();
  for (let i = 0; i < 5; i++) {
    group(`intense — loop ${i + 1}`, () => {
      invoke("study-next", { context: {} }, studyNextDuration);
      invoke("generate-adaptive-question", {
        theme: "intense-theme", subtopic: "sub-intense", difficulty: "hard", context: {},
      }, generateQuestionDuration);
      invoke("explain-simple", { theme: "intense-theme", doubt: "" }, explainSimpleDuration);
      sleep(1);
      invoke("study-complete", {
        actionType: "review", wasCorrect: true,
        themeId: "intense-theme", topicId: "intense-topic",
        metadata: { source: "k6_load", originModule: "study_loop" },
      }, studyCompleteDuration);
    });
    sleep(0.5);
  }
}

export function abandonUser() {
  authSetup();
  group("abandon — start then leave", () => {
    invoke("study-next", { context: {} }, studyNextDuration);
    sleep(1);
    invoke("generate-adaptive-question", {
      theme: "abandon-theme", subtopic: "", difficulty: "medium", context: {},
    }, generateQuestionDuration);
    // user leaves — no study-complete
    sleep(5);
  });
}

export function errorUser() {
  authSetup();
  for (let i = 0; i < 3; i++) {
    group(`error — cycle ${i + 1}`, () => {
      invoke("study-next", { context: {} }, studyNextDuration);
      invoke("generate-adaptive-question", {
        theme: "error-theme", subtopic: "", difficulty: "easy", context: { fromError: true },
      }, generateQuestionDuration);
      invoke("study-complete", {
        actionType: "error_review", wasCorrect: false,
        themeId: "error-theme", topicId: "error-topic",
        metadata: { source: "k6_load", originModule: "study_loop" },
      }, studyCompleteDuration);
      invoke("reinforce-error", {
        theme: "error-theme", errorType: "", userAnswer: "wrong answer",
      }, null);
      sleep(1);
    });
  }
}

export function quickActionUser() {
  authSetup();
  group("quick-actions", () => {
    invoke("study-next", { context: {} }, studyNextDuration);
    invoke("explain-simple", { theme: "qa-theme", doubt: "" }, explainSimpleDuration);
    sleep(0.5);
    invoke("summarize-topic", { theme: "qa-theme" }, summarizeDuration);
    sleep(0.5);
    invoke("explain-deep", { theme: "qa-theme", subtopic: "" }, null);
    sleep(0.5);
    invoke("generate-adaptive-question", {
      theme: "qa-theme", subtopic: "", difficulty: "medium", context: {},
    }, generateQuestionDuration);
    sleep(1);
  });
}
