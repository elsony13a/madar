import { chromium, expect } from "@playwright/test";
import { mkdtemp, copyFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const isolated = await mkdtemp(join(tmpdir(), "madar-offline-"));
await copyFile("Madar-Preview.html", join(isolated, "preview.html"));
await mkdir("artifacts/screenshots", { recursive: true });
const browser = await chromium.launch(),
  page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
  errors = [],
  external = [];
try {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) external.push(r.url());
  });
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(join(isolated, "preview.html")).href);
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(247, 245, 237)",
  );
  await expect(page.locator(".course-card")).toHaveCount(6);
  await page.locator("#login").click();
  await page.locator("#auth-go").click();
  await page.locator('[data-course="aws-foundations"]').click();
  await page.locator("#save-course").click();
  await page.locator("#enroll").click();
  await page.locator("#lesson-note").click();
  await page
    .locator("#note-form textarea")
    .fill("Offline note saved across reload.");
  await page.locator("#note-form button").click();
  await page.locator("#close-dialog").click();
  await page.locator("#course-questions").click();
  await page.locator("#ask-question").click();
  await page
    .locator('#question-form [name="displayName"]')
    .fill("Offline learner");
  await page
    .locator('#question-form [name="title"]')
    .fill("How do I protect the API?");
  await page
    .locator("#question-form textarea")
    .fill("What should be checked on every protected course request?");
  await page.locator("#question-form button").click();
  await page.locator("#close-dialog").click();
  await page.reload();
  await page.locator('[data-course="aws-foundations"]').click();
  await page.locator("#enroll").click();
  await page.locator("#lesson-note").click();
  await expect(page.locator("#note-form textarea")).toHaveValue(
    "Offline note saved across reload.",
  );
  await page.locator("#note-form textarea").fill("");
  await page.locator("#note-form button").click();
  await page.locator("#close-dialog").click();
  await page.locator("#lesson-note").click();
  await expect(page.locator("#note-form textarea")).toHaveValue("");
  await page.locator("#close-dialog").click();
  await page.locator("#course-questions").click();
  await expect(page.locator(".question-thread")).toContainText(
    "How do I protect the API?",
  );
  await page.screenshot({
    path: "artifacts/screenshots/v5-offline-question-390.png",
    fullPage: true,
  });
  await page.locator("#close-dialog").click();
  await page.locator("#report-course").click();
  await page
    .locator("#report-form textarea")
    .fill("Please check this course explanation in the offline demo.");
  await page.locator("#report-form button").click();
  await expect(page.locator("#dialog-content")).toContainText(
    "Please check this course explanation",
  );
  await page.locator("#close-dialog").click();
  await page.reload();
  await page.locator("#workspace-nav").click();
  await page.locator("#my-reports").click();
  await expect(page.locator("#dialog-content")).toContainText(
    "Please check this course explanation",
  );
  await page.locator("#close-dialog").click();
  await page.locator("#explore-nav").click();
  await page.locator('[data-course="aws-foundations"]').click();
  await page.locator("#enroll").click();
  for (let i = 0; i < 3; i++) await page.locator("#complete-lesson").click();
  await expect(page.locator("#get-certificate")).toBeDisabled();
  await page.locator("#take-quiz").click();
  for (const [i, a] of [0, 1, 1].entries())
    await page.locator(`[name="q${i}"][value="${a}"]`).check();
  await page.locator("#quiz-form button").click();
  await expect(page.locator("#dialog-title")).toHaveText("100%");
  await page.locator("#quiz-next").click();
  await page.locator('[name="learnerName"]').fill("Offline Demo Learner");
  await page.locator("#certificate-form button").click();
  await expect(page.locator(".completion-certificate")).toContainText(
    "Not accredited",
  );
  const pending = page.waitForEvent("download");
  await page.locator("#download-certificate").click();
  const download = await pending;
  await download.saveAs("artifacts/offline-record.html");
  await page.locator("#close-dialog").click();
  await page.locator("#language").click();
  await page.evaluate(() =>
    document.querySelector("#toast").classList.remove("show"),
  );
  await page.screenshot({
    path: "artifacts/screenshots/v5-offline-player-ar.png",
    fullPage: true,
  });
  const record = await browser.newPage({
    viewport: { width: 320, height: 900 },
  });
  await record.context().setOffline(true);
  await record.goto(
    pathToFileURL(resolve("artifacts/offline-record.html")).href,
  );
  await expect(record.locator("body")).toContainText("LOCAL DEMO");
  if (
    await record.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    )
  )
    throw Error("Downloaded record overflows at 320px");
  await record.screenshot({
    path: "artifacts/screenshots/v5-offline-record-320.png",
    fullPage: true,
  });
  await record.setViewportSize({ width: 1000, height: 900 });
  await record.screenshot({
    path: "artifacts/screenshots/v5-offline-record-desktop.png",
    fullPage: true,
  });
  await record.pdf({
    path: "artifacts/offline-record-print.pdf",
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
  });
  await record.close();
  await page.locator("#demo-tools").click();
  await page.locator('[data-demo-role="instructor"]').click();
  await page.locator("#new-course").click();
  for (const [name, value] of Object.entries({
    titleEn: "Offline AI draft review",
    titleAr: "مراجعة اختبار محلي",
    descriptionEn: "A local review demonstration",
    descriptionAr: "تجربة مراجعة محلية",
    author: "Demo instructor",
    lessonEn: "Access boundary",
    lessonAr: "حدود الوصول",
    bodyEn: "The backend checks enrollment.",
    bodyAr: "السيرفر يتحقق من الاشتراك.",
  }))
    await page.locator(`[name="${name}"]`).fill(value);
  await page.locator('#course-form button[type="submit"]').click();
  await page.locator("[data-ai-quiz]").click();
  await page.locator('#ai-quiz-form [name="consent"]').check();
  await page.locator("#ai-quiz-form button").click();
  await expect(page.locator("#dialog-content")).toContainText(
    "NOT A BEDROCK RESPONSE",
  );
  await page.locator('#ai-adopt-form [name="reviewed"]').check();
  await page.locator("#ai-adopt-form button").first().click();
  await page.locator("[data-edit-draft]").click();
  await expect(page.locator("[data-prompt-en]")).toHaveValue(
    "Where should protected-course access be checked?",
  );
  await page.locator("#close-dialog").click();

  if (errors.length || external.length)
    throw Error(JSON.stringify({ errors, external }));
  const result = {
    offline: true,
    isolatedSingleFile: true,
    fontsAndStyles: true,
    externalRequests: external,
    errors,
    savedCourse: true,
    privateNoteSaveReloadClear: true,
    questionPostReload: true,
    learnerReportPostReload: true,
    fixedSampleReviewAndAdoptionNoBedrock: true,
    quizPass: 100,
    completionRecordDownload: true,
    recordViewport320: true,
  };
  await writeFile(
    "docs/offline-test-results.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
