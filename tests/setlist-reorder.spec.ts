import { test, expect, type Page } from "@playwright/test";
import { reorderEntries } from "../src/features/setlists/setlist-reorder";
import type { Setlist } from "../src/domain/models";

async function seed(page: Page, count = 3) {
  await page.goto("/setlists");
  await expect(page.getByRole("link", { name: "Add setlist" })).toBeVisible();
  await page.evaluate(async (count) => {
    const request = indexedDB.open("cue-list-db");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(["songs", "setlists", "performanceTypes"], "readwrite");
    const common = { createdAt: "2026-01-01", updatedAt: "2026-01-01", syncMetadata: { syncStatus: "pending_push" } };
    transaction.objectStore("performanceTypes").put({ ...common, id: "acoustic", name: "Acoustic" });
    for (let i = 0; i < count; i++) {
      transaction.objectStore("songs").put({
        ...common, id: `song-${i}`, title: i === 1 ? "A longer song title that wraps onto multiple lines on a phone" : `Song ${i + 1}`,
        artist: "Test artist", sourceType: "original", tags: [], performanceProfiles: [],
      });
    }
    transaction.objectStore("setlists").put({
      ...common, id: "test-setlist", title: "Reorder rehearsal", notes: "",
      songEntries: Array.from({ length: count }, (_, i) => ({
        id: `entry-${i}`, songId: `song-${i === 2 ? 0 : i}`, order: i + 1,
        performanceNoteOverride: `Note ${i + 1}`, performanceTypeId: "acoustic",
      })),
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, count);
  await page.goto("/setlists/test-setlist");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.locator("[data-entry-id]")).toHaveCount(count);
}

async function stored(page: Page): Promise<Setlist> {
  return page.evaluate(async () => {
    const request = indexedDB.open("cue-list-db");
    const database = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
    const read = database.transaction("setlists").objectStore("setlists").get("test-setlist");
    const result = await new Promise<Setlist>((resolve) => { read.onsuccess = () => resolve(read.result); });
    database.close();
    return result;
  });
}

const row = (page: Page, id: number) => page.locator(`[data-entry-id="entry-${id}"]`);
const order = (page: Page) => page.locator("[data-entry-id]").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-entry-id")));

async function keyboardMove(page: Page, id: number, direction: "ArrowDown" | "ArrowUp", cancel = false) {
  const handle = row(page, id).getByRole("button", { name: /^Reorder/ });
  await handle.scrollIntoViewIfNeeded();
  await handle.focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".cu-setlist-drag-overlay")).toBeVisible();
  await page.keyboard.press(direction);
  // Let the sortable animation settle before completing the gesture.
  await page.waitForTimeout(300);
  await page.keyboard.press(cancel ? "Escape" : "Space");
  await expect(page.locator(".cu-setlist-drag-overlay .cu-setlist-entry-preview")).toHaveCount(0);
}

test("reorder preserves duplicate song entries and their overrides", () => {
  const entries = [0, 1, 2].map((i) => ({ id: `${i}`, songId: "same-song", order: i + 1, performanceNoteOverride: `Note ${i}` }));
  const result = reorderEntries(entries, "0", 2);
  expect(result.map((entry) => entry.id)).toEqual(["1", "2", "0"]);
  expect(result.map((entry) => entry.order)).toEqual([1, 2, 3]);
  expect(result[2].performanceNoteOverride).toBe("Note 0");
  expect(entries[0].order).toBe(1);
  expect(reorderEntries(entries, "missing", 0)).toBe(entries);
  expect(reorderEntries([], "missing", 0)).toEqual([]);
});

test("compact cards expand one at a time and block reorder without losing drafts", async ({ page }) => {
  await seed(page);
  await expect(page.getByLabel("Entry note override")).toHaveCount(0);
  await row(page, 0).getByRole("button", { name: "Edit slot 1" }).click();
  await expect(page.locator(".cu-setlist-drag-handle:disabled")).toHaveCount(3);
  await page.getByLabel("Entry note override").fill("Remember the intro");
  await row(page, 1).getByRole("button", { name: "Edit slot 2" }).click();
  await expect(page.getByLabel("Entry note override")).toHaveCount(1);
  await row(page, 1).getByRole("button", { name: "Done editing slot 2" }).click();
  await expect(page.locator(".cu-setlist-drag-handle:disabled")).toHaveCount(0);
  await row(page, 0).getByRole("button", { name: "Edit slot 1" }).click();
  await expect(page.getByLabel("Entry note override")).toHaveValue("Remember the intro");
  expect((await stored(page)).songEntries[0].performanceNoteOverride).toBe("Note 1");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  expect((await stored(page)).songEntries[0].performanceNoteOverride).toBe("Remember the intro");
});

test("keyboard drop updates draft only, Escape restores order, Save persists", async ({ page }, testInfo) => {
  await seed(page);
  await keyboardMove(page, 0, "ArrowDown");
  await expect.poll(() => order(page)).toEqual(["entry-1", "entry-0", "entry-2"]);
  expect((await stored(page)).songEntries.map((entry) => entry.id)).toEqual(["entry-0", "entry-1", "entry-2"]);
  if (testInfo.project.name === "chromium") {
    await expect(row(page, 0).getByRole("button", { name: /^Reorder/ })).toBeFocused();
  }
  await keyboardMove(page, 0, "ArrowDown", true);
  await expect.poll(() => order(page)).toEqual(["entry-1", "entry-0", "entry-2"]);
  await keyboardMove(page, 0, "ArrowDown");
  await expect.poll(() => order(page)).toEqual(["entry-1", "entry-2", "entry-0"]);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  await page.reload();
  const entries = (await stored(page)).songEntries;
  expect(entries.map((entry) => entry.id)).toEqual(["entry-1", "entry-2", "entry-0"]);
  expect(entries.map((entry) => entry.order)).toEqual([1, 2, 3]);
  expect(entries[2]).toMatchObject({ songId: "song-0", performanceNoteOverride: "Note 1", performanceTypeId: "acoustic" });
});

test("editor Cancel discards reorders and entry removal restores dragging", async ({ page }) => {
  await seed(page);
  await keyboardMove(page, 0, "ArrowDown");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect.poll(() => order(page)).toEqual(["entry-0", "entry-1", "entry-2"]);
  await row(page, 0).getByRole("button", { name: "Edit slot 1" }).click();
  await page.getByRole("button", { name: "Remove song", exact: true }).click();
  await expect(page.locator("[data-entry-id]")).toHaveCount(2);
  await expect(page.locator(".cu-setlist-drag-handle:disabled")).toHaveCount(0);
});

test("pointer drag keeps geometry stable and supports repeated moves", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "This scenario uses a mouse pointer, not a real touch-event driver.");
  await seed(page);
  await row(page, 0).scrollIntoViewIfNeeded();
  const first = await row(page, 0).boundingBox();
  const handle = await row(page, 0).getByRole("button", { name: /^Reorder/ }).boundingBox();
  expect(first).not.toBeNull();
  expect(handle).not.toBeNull();
  if (!first || !handle) return;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 + 8, { steps: 2 });
  await expect(page.locator(".cu-setlist-drag-overlay")).toBeVisible();
  const after = await row(page, 0).boundingBox();
  expect(after?.height).toBe(first.height);
  const second = await row(page, 1).boundingBox();
  if (!second) throw new Error("Missing second row");
  await page.mouse.move(handle.x + handle.width / 2, second.y + second.height * 0.8, { steps: 15 });
  await page.waitForTimeout(350);
  await page.mouse.up();
  await expect.poll(() => order(page)).toEqual(["entry-1", "entry-0", "entry-2"]);
  await keyboardMove(page, 0, "ArrowUp");
  await expect.poll(() => order(page)).toEqual(["entry-0", "entry-1", "entry-2"]);
});

test("long lists auto-scroll and viewport changes cancel the drag", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "This scenario uses a mouse pointer, not a real touch-event driver.");
  await seed(page, 30);
  await row(page, 0).scrollIntoViewIfNeeded();
  const handle = await row(page, 0).getByRole("button", { name: /^Reorder/ }).boundingBox();
  if (!handle) throw new Error("Missing handle");
  await page.mouse.move(handle.x + 20, handle.y + 20);
  await page.mouse.down();
  await page.mouse.move(handle.x + 20, handle.y + 30);
  await expect(page.locator(".cu-setlist-drag-overlay")).toBeVisible();
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.move(handle.x + 20, page.viewportSize()!.height - 10, { steps: 15 });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 150);
  await page.setViewportSize({ width: 900, height: 700 });
  await expect(page.locator(".cu-setlist-drag-overlay .cu-setlist-entry-preview")).toHaveCount(0);
  await page.mouse.up();
  await expect.poll(() => order(page)).toEqual(Array.from({ length: 30 }, (_, i) => `entry-${i}`));
});
