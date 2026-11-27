import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const port = 4175,
  base = `http://127.0.0.1:${port}`,
  server = spawn(
    "node",
    [
      "node_modules/vite/bin/vite.js",
      "web",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { stdio: "pipe" },
  );
const results = [],
  errors = [];
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await mkdir("artifacts/screenshots", { recursive: true });
  async function check(name, shots = true, scrollBottom = false) {
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(100);
      if (scrollBottom)
        await page
          .locator("#dialog")
          .evaluate((d) => (d.scrollTop = d.scrollHeight));
      await page.evaluate(() => {
        document.querySelector("#toast")?.classList.remove("show");
      });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      assert.equal(overflow, false, `${name}: horizontal overflow at ${width}`);
      if (shots)
        await page.screenshot({
          path: `artifacts/screenshots/${name}-${width}.png`,
          fullPage: true,
        });
    }
    results.push(name);
  }
  async function role(name) {
    await page.locator("#demo-tools").click();
    await page.locator(`[data-demo-role="${name}"]`).click();
    await page.waitForTimeout(150);
  }
  await page.goto(base);
  await expect(page.locator(".course-card")).toHaveCount(6);
  await check("catalogue-en");
  await page.locator("#search").fill("JavaScript");
  await expect(page.locator(".course-card")).toHaveCount(1);
  await page.locator("#search").fill("not-a-course");
  await expect(page.locator(".course-card")).toHaveCount(0);
  await page.locator("#search").fill("");
  await page.locator("#course-language").selectOption("ar");
  await expect(page.locator(".course-card")).toHaveCount(3);
  await page.locator("#course-language").selectOption("all");
  await page.locator("#language").click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await check("catalogue-ar");
  await page.locator("#language").click();
  await page.locator("#login").click();
  await expect(page.locator('[data-signup-role="admin"]')).toHaveCount(0);
  await check("signup");
  await page.locator("#auth-go").click();
  await page.locator('[data-course="aws-foundations"]').click();
  await check("free-detail");
  await page.locator("#enroll").click();
  await expect(page.locator(".lesson-content")).toBeVisible();
  await check("player");
  await page.locator("#complete-lesson").click();
  await expect(page.locator(".curriculum")).toContainText("33%");
  await page.reload();
  await page.locator("#learning-nav").click();
  await expect(page.locator(".course-card")).toHaveCount(1);
  await check("my-learning");
  await page.locator("#explore-nav").click();
  await page.locator('[data-course="interfaces"]').click();
  await page.locator("#enroll").click();
  await expect(page.locator("#receipt-form")).toBeVisible();
  await check("receipt-submit");
  await page
    .locator('input[name="receipt"]')
    .setInputFiles("docs/assets/test-receipt.png");
  await page.locator("#receipt-form button").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await page.locator("#learning-nav").click();
  await expect(page.locator(".course-card")).toHaveCount(1);
  await page.locator("#workspace-nav").click();
  await expect(page.locator("main .dashboard-panel")).toContainText(
    "Pending review",
  );
  await check("student-payments");
  await role("admin");
  await expect(page.locator(".page-title")).toHaveText("Payment review");
  await check("owner-queue");
  await page.locator("[data-review]").first().click();
  await expect(page.locator("#receipt-image img")).toBeVisible();
  await check("owner-review");
  await page
    .locator("#review-form textarea")
    .fill("TEST: transfer independently verified");
  await page.locator('input[name="verified"]').check();
  await page.locator('button[value="approved"]').click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await expect(page.locator("main .dashboard-panel")).toContainText("Approved");
  await role("student");
  await expect(page.locator(".course-card")).toHaveCount(2);
  await page.locator('[data-course="interfaces"]').click();
  await page.locator("#enroll").click();
  await expect(page.locator(".lesson-content")).toBeVisible();
  results.push("paid-unlock-only-after-approval");
  await role("instructor");
  await expect(page.locator("#new-course")).toBeVisible();
  await check("instructor-empty");
  await page.locator("#new-course").click();
  await check("instructor-form");
  await page
    .locator("#dialog")
    .evaluate((el) => (el.scrollTop = el.scrollHeight));
  await check("instructor-form-bottom");
  await page.locator("#dialog").evaluate((el) => (el.scrollTop = 0));
  const vals = {
    titleEn: "Security by design",
    titleAr: "الأمان من البداية",
    descriptionEn: "Build a careful first learning project",
    descriptionAr: "ابنِ مشروعك التعليمي الأول بعناية",
    author: "Demo instructor",
    price: "199.50",
    lessonEn: "Define the trust boundary",
    lessonAr: "حدد حدود الثقة",
    bodyEn: "A private lesson belongs behind an authorization boundary.",
    bodyAr: "الدرس الخاص يحتاج تحققًا من الصلاحيات قبل عرضه.",
  };
  for (const [key, value] of Object.entries(vals))
    await page.locator(`[name="${key}"]`).first().fill(value);
  await page.locator("#quiz-enabled").check();
  await page
    .locator("[data-prompt-en]")
    .fill("Where should authorization run?");
  await page.locator("[data-prompt-ar]").fill("أين نتحقق من الصلاحيات؟");
  for (const [i, en, ar] of [
    [0, "Backend", "السيرفر"],
    [1, "Button only", "الزر فقط"],
    [2, "Nowhere", "لا مكان"],
  ]) {
    await page.locator(`[data-option-en="${i}"]`).fill(en);
    await page.locator(`[data-option-ar="${i}"]`).fill(ar);
  }
  await check("quiz-authoring");
  await page.locator('#course-form button[type="submit"]').click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await expect(page.locator("main .dashboard-panel")).toContainText(
    "Security by design",
  );
  await check("instructor-drafts");
  await page.locator("[data-ai-quiz]").click();
  await expect(page.locator("#dialog-content")).toContainText(
    "fixed hand-written sample",
  );
  await check("bedrock-simulation-setup");
  await page.locator("#ai-quiz-form button").click();
  await expect(page.locator("#ai-quiz-form")).toBeVisible();
  await page.locator('#ai-quiz-form [name="consent"]').check();
  await page.locator("#ai-quiz-form button").click();
  await expect(page.locator("#dialog-content")).toContainText(
    "NOT A BEDROCK RESPONSE",
  );
  await check("bedrock-sample-review");
  await check("bedrock-review-bottom", true, true);
  await page.locator("#ai-discard").click();
  await page.locator("[data-ai-quiz]").click();
  await page.locator('#ai-quiz-form [name="consent"]').check();
  await page.locator("#ai-quiz-form button").click();
  await page.locator("#ai-adopt-form button").first().click();
  await expect(page.locator("#ai-adopt-form")).toBeVisible();
  await page.locator('#ai-adopt-form [name="reviewed"]').check();
  await page.locator("#ai-adopt-form button").first().click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await page.locator("[data-edit-draft]").click();
  await expect(page.locator("[data-prompt-en]")).toHaveValue(
    "Where should protected-course access be checked?",
  );
  await page.locator('#course-form button[type="submit"]').click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await check("bedrock-adopted-editable-draft");
  await page.locator("#language").click();
  await page.locator("[data-ai-quiz]").click();
  await check("bedrock-simulation-ar");
  await page.locator("#close-dialog").click();
  await page.locator("#language").click();

  await page.locator("[data-preview-draft]").click();
  await expect(page.locator("#dialog-content")).toContainText(
    "A private lesson belongs",
  );
  await check("instructor-preview");
  await page.locator("#close-dialog").click();
  await page.locator("[data-edit-draft]").click();
  await expect(page.locator('[name="titleEn"]')).toHaveValue(
    "Security by design",
  );
  await page.locator('[name="titleEn"]').fill("Security by design, revised");
  await page.locator('#course-form button[type="submit"]').click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await page.locator("[data-publish]").click();
  await expect(page.locator(".status-badge")).toHaveText(
    "Awaiting owner review",
  );
  await expect(page.locator("[data-edit-draft]")).toHaveCount(0);
  await check("publication-pending");
  await page.locator("[data-withdraw]").click();
  await expect(page.locator(".status-badge")).toHaveText("Draft");
  await page.locator("[data-publish]").click();
  await role("admin");
  await page.locator("#publication-queue").click();
  await check("publication-queue");
  await page.locator("[data-review-course]").click();
  await expect(page.locator("#dialog-content")).toContainText(
    "A private lesson belongs",
  );
  await check("publication-content");
  await page.locator("#course-review-form").scrollIntoViewIfNeeded();
  await check("publication-content-bottom", true, true);
  await page
    .locator("#course-review-form textarea")
    .fill("Clarify the API access example before publication.");
  await page.locator('#course-review-form [value="rejected"]').click();
  await expect(page.locator("[data-review-course]")).toHaveCount(0);
  await page.locator("#close-dialog").click();
  await role("instructor");
  await expect(page.locator("main")).toContainText(
    "Clarify the API access example",
  );
  await expect(page.locator(".status-badge")).toHaveText("Draft");
  await check("publication-returned");
  await page.locator("[data-publish]").click();
  await role("admin");
  await page.locator("#publication-queue").click();
  await page.locator("[data-review-course]").click();
  await page
    .locator("#course-review-form textarea")
    .fill("Content reviewed for this local test.");
  await page.locator('#course-review-form [value="approved"]').click();
  await expect(page.locator("#course-review-form")).toBeVisible();
  await page.locator('#course-review-form [name="checked"]').check();
  await page.locator('#course-review-form [value="approved"]').click();
  await expect(page.locator("[data-review-course]")).toHaveCount(0);
  await page.locator("#close-dialog").click();
  await role("instructor");
  await expect(page.locator(".status-badge")).toHaveText("Published");
  await check("publication-approved");
  await page.locator("[data-edit-details]").click();
  await check("published-details");
  await page.locator('#details-form [name="price"]').fill("249.75");
  await page.locator("#details-form button").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await expect(page.locator("main .request-row")).toContainText("249.75");
  await page.locator("#explore-nav").click();
  await expect(page.locator(".course-card")).toHaveCount(7);
  await page.locator("#language").click();
  await check("signedin-ar");
  await page.locator("#language").click();
  await role("student");
  await page.locator('[data-course="aws-foundations"]').click();
  await page.locator("#save-course").click();
  await expect(page.locator("#save-course")).toContainText("Saved");
  await page.locator("#write-review").click();
  await page.locator('[name="displayName"]').fill("Test learner");
  await page
    .locator("#review-course-form textarea")
    .fill("Clear lessons and a practical introduction to cloud boundaries.");
  await check("review-submit");
  await page.locator("#review-course-form button").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await page.locator("#learning-nav").click();
  await page.locator("#view-saved").click();
  await expect(page.locator(".course-card")).toHaveCount(1);
  await check("saved-courses");
  await page.locator('[data-course="aws-foundations"]').click();
  await page.locator("#enroll").click();
  await expect(page.locator("#take-quiz")).toBeDisabled();
  await page.locator('[data-lesson="1"]').click();
  await page.locator("#complete-lesson").click();
  await page.locator("#complete-lesson").click();
  await expect(page.locator("#take-quiz")).toBeEnabled();
  await expect(page.locator("#get-certificate")).toBeDisabled();
  await page.locator("#take-quiz").click();
  await check("quiz-learner");
  await page.locator('[name="q0"][value="1"]').check();
  await page.locator('[name="q1"][value="0"]').check();
  await page.locator('[name="q2"][value="0"]').check();
  await page.locator("#quiz-form button").click();
  await expect(page.locator("#dialog-title")).toHaveText("0%");
  await check("quiz-retry");
  await page.locator("#quiz-next").click();
  await page.locator('[name="q0"][value="0"]').check();
  await page.locator('[name="q1"][value="1"]').check();
  await page.locator('[name="q2"][value="1"]').check();
  await page.locator("#quiz-form button").click();
  await expect(page.locator("#dialog-title")).toHaveText("100%");
  await check("quiz-pass");
  await page.locator("#quiz-next").click();
  await page
    .locator('[name="learnerName"]')
    .fill("Demo Learner / متعلم تجريبي");
  await page.locator("#certificate-form button").click();
  await expect(page.locator(".completion-certificate")).toContainText(
    "Demo Learner",
  );
  await check("completion-record");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#download-certificate").click();
  const download = await downloadPromise;
  await download.saveAs("artifacts/completion-record.html");
  const certificatePage = await browser.newPage({
    viewport: { width: 1000, height: 900 },
  });
  await certificatePage.goto(
    "file://" + process.cwd() + "/artifacts/completion-record.html",
  );
  await expect(certificatePage.locator("body")).toContainText("LOCAL DEMO");
  await certificatePage.screenshot({
    path: "artifacts/screenshots/downloaded-record.png",
    fullPage: true,
  });
  await certificatePage.close();
  await page.locator("#close-dialog").click();
  await role("admin");
  await page.locator("#moderate-reviews").click();
  await check("review-moderation");
  await page.locator('[data-decision="approved"]').click();
  await expect(page.locator("#dialog-content")).toContainText(
    "No reviews awaiting",
  );
  await page.locator("#close-dialog").click();
  await role("student");
  await page.locator('[data-course="aws-foundations"]').click();
  await page.locator("#course-reviews").click();
  await expect(page.locator(".review-average")).toContainText("5.0");
  await expect(page.locator("#dialog-content")).toContainText("Test learner");
  await check("approved-reviews");
  await page.locator("#close-dialog").click();
  await page.locator("#language").click();
  await page.locator('[data-course="aws-foundations"]').click();
  await page.locator("#enroll").click();
  await check("player-milestone-ar");
  await page.locator("#language").click();
  await page.locator("#lesson-note").click();
  await page
    .locator("#note-form textarea")
    .fill("My private note: protect the API boundary, not only the button.");
  await page.locator("#note-form button").click();
  await check("private-note");
  await page.locator("#close-dialog").click();
  await page.locator("#lesson-note").click();
  await expect(page.locator("#note-form textarea")).toHaveValue(
    "My private note: protect the API boundary, not only the button.",
  );
  await page.locator("#close-dialog").click();
  await role("instructor");
  await page.locator("#instructor-insights").click();
  await expect(page.locator("#dialog-content")).toContainText(
    "not verified revenue",
  );
  await check("instructor-insights");
  await page.locator("#close-dialog").click();
  await page.locator("[data-edit-details]").click();
  await page.locator('#details-form [name="price"]').fill("0");
  await page.locator("#details-form button").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await role("student");
  await page.locator("#explore-nav").click();
  await page
    .locator(".course-card")
    .filter({ hasText: "Security by design, revised" })
    .locator("button")
    .click();
  await page.locator("#enroll").click();
  await page.locator("#course-questions").click();
  await check("questions-empty");
  await page.locator("#ask-question").click();
  await page
    .locator('#question-form [name="displayName"]')
    .fill("Question learner");
  await page
    .locator('#question-form [name="title"]')
    .fill("Where do I check course access?");
  await page
    .locator("#question-form textarea")
    .fill(
      "I can hide the button, but how should the API check the learner enrollment?",
    );
  await check("question-compose");
  await page.locator("#question-form button").click();
  await expect(page.locator(".question-thread")).toContainText(
    "Where do I check course access?",
  );
  await check("question-posted");
  await page.locator("#close-dialog").click();
  await role("instructor");
  await page.locator("[data-instructor-questions]").click();
  await page.locator("[data-reply-question]").click();
  await page
    .locator("#reply-form textarea")
    .fill(
      "Verify the token and enrollment on the backend before returning protected content.",
    );
  await check("instructor-reply");
  await page.locator("#reply-form button").click();
  await expect(page.locator(".instructor-answer")).toContainText(
    "Verify the token",
  );
  await check("question-answered");
  await page.locator("#close-dialog").click();
  await role("admin");
  await page.locator("#moderate-questions").click();
  await check("discussion-moderation");
  await page.locator("[data-moderate-question]").click();
  await expect(page.locator("[data-moderate-question]")).toHaveText(
    "Restore discussion",
  );
  await page.locator("[data-moderate-question]").click();
  await expect(page.locator("[data-moderate-question]")).toHaveText(
    "Hide discussion",
  );
  await page.locator("#close-dialog").click();
  await role("student");
  await page
    .locator(".course-card")
    .filter({ hasText: "Security by design, revised" })
    .locator("button")
    .click();
  await page.locator("#enroll").click();
  await page.locator("#language").click();
  await page.locator("#course-questions").click();
  await check("discussion-ar");
  await page.locator("#close-dialog").click();
  await page.locator("#language").click();
  await page.locator("#report-course").click();
  await page
    .locator("#report-form textarea")
    .fill("Please review the access explanation. <img src=x onerror=alert(1)>");
  await check("report-concern");
  await page.locator("#report-form button").click();
  await expect(page.locator("#dialog-content")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(page.locator("#dialog-content img")).toHaveCount(0);
  await check("my-report-open");
  await page.locator("#close-dialog").click();
  await page.locator("#course-questions").click();
  await page.locator("[data-report-question]").click();
  await page.locator('#report-form [name="reason"]').selectOption("harassment");
  await page
    .locator("#report-form textarea")
    .fill("Please review the wording of this discussion.");
  await page.locator("#report-form button").click();
  await page.locator("#close-dialog").click();
  await role("admin");
  await page.locator("#learner-reports").click();
  await expect(page.locator("[data-resolve-report]")).toHaveCount(2);
  await check("owner-report-review");
  await check("owner-report-review-bottom", true, true);
  for (let i = 0; i < 2; i++) {
    await page
      .locator("[data-resolve-report]")
      .first()
      .locator("textarea")
      .fill(
        "Concern reviewed in this local demonstration. No money or access changed.",
      );
    await page
      .locator("[data-resolve-report]")
      .first()
      .locator("button")
      .click();
    await expect(page.locator("[data-resolve-report]")).toHaveCount(1 - i);
  }
  await check("owner-report-resolved");
  await page.locator("#close-dialog").click();
  await role("student");
  await page.locator("#workspace-nav").click();
  await page.locator("#my-reports").click();
  await expect(page.locator("#dialog-content")).toContainText(
    "Concern reviewed",
  );
  await page.locator("#close-dialog").click();
  await page.locator("#language").click();
  await page.locator("#my-reports").click();
  await check("my-reports-ar");
  await page.locator("#close-dialog").click();
  assert.deepEqual(errors, []);
  results.push("no-browser-page-errors");
  console.log(
    JSON.stringify(
      { passed: results.length, checks: results, errors },
      null,
      2,
    ),
  );
  await writeFile(
    "docs/browser-test-results.json",
    JSON.stringify(
      {
        passed: results.length,
        checks: results,
        viewports: [320, 390, 1280],
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  if (browser) await browser.close();
  server.kill();
}
