import { test, expect, type Page } from "@playwright/test";
import { scenarios } from "../src/scenarios";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Simulator } from "../src/engine";
import { catalog, fields, type Kind } from "../src/model";
import { key, type Project } from "../src/projects";

function monitor(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning")
      errors.push(message.text());
  });
  return errors;
}
const projectAction = async (page: Page, name: string) => {
  await page.getByRole("button", { name: "Project actions" }).click();
  await page.getByRole("button", { name, exact: true }).click();
};
test("landing preview, navigation, themes and learning center", async ({
  page,
}) => {
  const errors = monitor(page);
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: /visualize the invisible/i }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Load balancer", exact: true })
    .click();
  await expect(
    page.getByText(/distributes work using round robin/i),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause preview" }).click();
  await expect(
    page.getByRole("button", { name: "Play preview" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Play preview" }).click();
  await page.getByRole("link", { name: "Features", exact: true }).click();
  await expect(page).toHaveURL(/#capabilities/);
  for (const name of [
    "Watch systems behave",
    "Experiment with failure",
    "Design architectures",
  ]) {
    const control = page.getByRole("button", { name, exact: true });
    await control.click();
    await expect(control).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.locator(".feature-preview svg.topology-art"),
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: "Open Load-balanced application" })
    .click();
  await expect(page.getByLabel("Project name")).toHaveValue(
    "Load-balanced application",
  );
  await page
    .getByRole("banner")
    .getByRole("link", { name: /SystemLab/ })
    .click();
  await page.getByRole("link", { name: "Explore scenarios" }).click();
  await expect(page).toHaveURL(/#scenarios/);
  await page.getByRole("link", { name: "Read the learning center" }).click();
  await expect(page).toHaveURL(/#docs/);
  await page
    .getByRole("banner")
    .getByRole("link", { name: /SystemLab/ })
    .click();
  await page.getByRole("link", { name: "Documentation", exact: true }).click();
  await expect(page).toHaveURL(/#docs/);
  await page.getByRole("link", { name: "Docs", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Metrics", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("link", { name: "Browse scenarios" }).click();
  await page.getByRole("button", { name: /Cache-enabled application/ }).click();
  await expect(page.getByLabel("Project name")).toHaveValue(
    "Cache-enabled application",
  );
  expect(errors).toEqual([]);
});
test("run, pause, step, resume, speed, stop and reset on desktop", async ({
  page,
}) => {
  const errors = monitor(page);
  await page.goto("./#studio");
  const speed = page.getByLabel("Simulation speed");
  for (const value of ["0.25", "0.5", "1", "2", "4", "8"]) {
    await speed.selectOption(value);
    await expect(speed).toHaveValue(value);
  }
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByText("running", { exact: true })).toBeVisible();
  await expect
    .poll(async () =>
      Number(await page.locator(".metrics-grid strong").nth(1).textContent()),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const paused = await page.locator(".sim-time").textContent();
  await page.getByRole("button", { name: "Step simulation" }).click();
  await expect(page.locator(".sim-time")).not.toHaveText(paused ?? "");
  const trend = page.getByLabel("Trend metric");
  for (const value of ["p95", "depth", "rps"]) {
    await trend.selectOption(value);
    await expect(trend).toHaveValue(value);
  }
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "Stop simulation" }).click();
  await expect(page.getByText("stopped", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Event timeline" }).click();
  await expect(
    page.getByRole("region", { name: "Simulation analytics" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Components", exact: true }).click();
  await expect(
    page.getByRole("columnheader", { name: "Utilization" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Live metrics" }).click();
  await expect(trend).toBeVisible();
  await page.getByRole("button", { name: "Reset simulation" }).click();
  await expect(page.locator(".sim-time")).toHaveText("0.00 s");
  expect(errors).toEqual([]);
});
test("edit architecture and persist project operations and exports", async ({
  page,
}) => {
  const errors = monitor(page);
  await page.goto("./#studio");
  await projectAction(page, "New project");
  await expect(page.getByText("Build your architecture")).toBeVisible();
  await expect(
    page.getByText("Add a traffic generator.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Traffic generator", exact: true })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page.getByLabel("Requests per second").fill("30");
  await page.getByLabel("Requests per second").press("Enter");
  await page.getByRole("button", { name: "Duplicate selection" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await page.getByRole("button", { name: "Delete selection" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await projectAction(page, "Rename project");
  await expect(page.getByLabel("Project name")).toBeFocused();
  await page.getByLabel("Project name").fill("Browser project");
  await page.getByLabel("Project name").press("Enter");
  await page.reload();
  await expect(page.getByLabel("Project name")).toHaveValue("Browser project");
  const jsonEvent = page.waitForEvent("download");
  await projectAction(page, "Export JSON");
  const json = await jsonEvent;
  expect(
    JSON.parse(await readFile((await json.path())!, "utf8")).nodes[0].config
      .rate,
  ).toBe(30);
  const svgEvent = page.waitForEvent("download");
  await projectAction(page, "Export image");
  expect(await readFile((await (await svgEvent).path())!, "utf8")).toContain(
    "<svg xmlns=",
  );
  await projectAction(page, "Duplicate project");
  await expect(page.getByLabel("Project name")).toHaveValue(
    "Browser project copy",
  );
  page.once("dialog", (dialog) => dialog.dismiss());
  await projectAction(page, "Delete project");
  await expect(page.getByLabel("Project name")).toHaveValue(
    "Browser project copy",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await projectAction(page, "Clear workspace");
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  page.once("dialog", (dialog) => dialog.accept());
  await projectAction(page, "Delete project");
  await expect(page.getByLabel("Project").locator("option")).toHaveCount(2);
  const picker = page.waitForEvent("filechooser");
  await projectAction(page, "Import JSON");
  await (
    await picker
  ).setFiles({
    name: "imported.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(scenarios[0].graph)),
  });
  await expect(page.getByLabel("Project name")).toHaveValue("imported");
  expect(errors).toEqual([]);
});
test("mobile navigation and editing stay within the viewport", async ({
  page,
}) => {
  const errors = monitor(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  await expect(page.locator(".blueprint")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(375);
  await page.getByRole("link", { name: "Launch Studio" }).first().click();
  await expect(
    page.getByRole("region", { name: "Architecture editor" }),
  ).toBeVisible();
  await page.getByLabel("Load scenario").selectOption("3");
  await expect(page.getByLabel("Project name")).toHaveValue(
    "Database replication",
  );
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(375);
  for (const width of [320, 480, 720, 1024, 1440]) {
    await page.setViewportSize({ width, height: 812 });
    for (const [route, section] of [
      ["home", ".hero"],
      ["studio", ".canvas"],
      ["docs", ".docs"],
    ]) {
      await page.goto("./#" + route);
      await expect(page.locator(section)).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width);
    }
  }
  expect(errors).toEqual([]);
});
test("drag components, connect handles, move a node, pan, zoom and fit", async ({
  page,
}) => {
  const errors = monitor(page);
  await page.goto("./#studio");
  await projectAction(page, "New project");
  const canvas = page.getByRole("region", { name: "Architecture editor" });
  const bounds = (await canvas.boundingBox())!;
  const canvasPane = canvas.locator(".react-flow__pane");
  for (const [name, offset] of [
    ["Traffic generator", 100],
    ["App server", 385],
  ] as const) {
    const button = page.getByRole("button", { name, exact: true });
    await button.dragTo(canvasPane, { targetPosition: { x: offset, y: 155 } });
  }
  await expect(canvas.locator(".react-flow__node")).toHaveCount(2);
  const source = (await canvas
    .locator(".react-flow__handle.source")
    .first()
    .boundingBox())!;
  const target = (await canvas
    .locator(".react-flow__handle.target")
    .first()
    .boundingBox())!;
  await page.mouse.move(
    source.x + source.width / 2,
    source.y + source.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect(canvas.locator(".react-flow__edge")).toHaveCount(1);
  const app = canvas.locator(".react-flow__node").last();
  const initial = await app.getAttribute("style");
  const node = (await app.boundingBox())!;
  await page.mouse.move(node.x + 45, node.y + 20);
  await page.mouse.down();
  await page.mouse.move(node.x + 45, node.y + 90, { steps: 9 });
  await page.mouse.up();
  await expect(app).not.toHaveAttribute("style", initial ?? "");
  const matrix = canvas.locator(".react-flow__viewport");
  const before = await matrix.getAttribute("style");
  await page.mouse.move(bounds.x + 50, bounds.y + 355);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 110, bounds.y + 369, { steps: 10 });
  await page.mouse.up();
  await expect(matrix).not.toHaveAttribute("style", before ?? "");
  const panned = await matrix.getAttribute("style");
  await page.getByRole("button", { name: "Zoom In", exact: true }).click();
  await expect(matrix).not.toHaveAttribute("style", panned ?? "");
  await page.getByRole("button", { name: "Zoom Out", exact: true }).click();
  const zoomed = await matrix.getAttribute("style");
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  await expect(matrix).not.toHaveAttribute("style", zoomed ?? "");
  await page.reload();
  await expect(canvas.locator(".react-flow__edge")).toHaveCount(1);
  const moved = await app.getAttribute("style");
  expect(moved).not.toBe(initial);
  expect(errors).toEqual([]);
});
test("rejects malformed imports and builds connections with the inspector", async ({
  page,
}) => {
  const errors = monitor(page);
  await page.goto("./#studio");
  await projectAction(page, "New project");
  const picker = page.waitForEvent("filechooser");
  await projectAction(page, "Import JSON");
  await (
    await picker
  ).setFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"nodes":[]}'),
  });
  await expect(page.getByLabel("Project name")).toHaveValue("Untitled project");
  await expect(page.locator(".validation")).toContainText(
    "Invalid architecture",
  );
  await page
    .getByRole("button", { name: "Traffic generator", exact: true })
    .click();
  await page.getByRole("button", { name: "App server", exact: true }).click();
  await page.locator(".react-flow__node").first().press("Enter");
  await page.getByLabel("Connect to").selectOption({ label: "App server 2" });
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByText("running", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

const capture = process.env.SYSTEMLAB_SCREENSHOTS;
if (capture) {
  test("capture the full homepage", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto("./");
    await expect(page.locator(".scenario-card .topology-art")).toHaveCount(8);
    await page.screenshot({
      path: join(capture, "homepage.png"),
      fullPage: true,
    });
  });
}

const shotTimes = [2, 2, 3.6, 4.6, 2, 3.8, 3.6, 6.3];
for (const [index, scenario] of scenarios.entries()) {
  test(`renders and animates ${scenario.name} with engine-backed metrics`, async ({
    page,
  }) => {
    const errors = monitor(page);
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto("./#scenarios");
    await page.locator(".scenario-card").nth(index).click();
    await expect(page.getByLabel("Project name")).toHaveValue(scenario.name);

    async function checkArchitecture() {
      const canvas = page.locator(".canvas");
      await expect(canvas.locator(".react-flow__node")).toHaveCount(
        scenario.graph.nodes.length,
      );
      await expect(canvas.locator(".react-flow__edge-path")).toHaveCount(
        scenario.graph.edges.length,
      );
      await expect
        .poll(() =>
          canvas.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return [...element.querySelectorAll(".react-flow__node")].every(
              (node) => {
                const box = node.getBoundingClientRect();
                return (
                  getComputedStyle(node).visibility === "visible" &&
                  box.width > 0 &&
                  box.left >= bounds.left &&
                  box.right <= bounds.right &&
                  box.top >= bounds.top &&
                  box.bottom <= bounds.bottom
                );
              },
            );
          }),
        )
        .toBe(true);
    }

    await checkArchitecture();
    if (index % 2 === 1) {
      await page.getByRole("button", { name: "Toggle theme" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    }
    await page.getByLabel("Simulation speed").selectOption("2");
    await page.getByRole("button", { name: "Start", exact: true }).click();
    const clock = async () =>
      Math.round(
        parseFloat((await page.locator(".sim-time").textContent())!) * 1000,
      );
    await expect
      .poll(() => page.locator(".edge-packet").count())
      .toBe(scenario.graph.edges.length);
    await expect
      .poll(() =>
        page.locator(".edge-packet").evaluateAll((packets) => {
          const onPath = packets.map((packet) => {
            const marker = packet as SVGGraphicsElement;
            const edge = marker
              .closest(".react-flow__edge")!
              .querySelector("path.react-flow__edge-path") as SVGPathElement;
            const position = new DOMPoint().matrixTransform(
              marker.getScreenCTM()!,
            );
            const matrix = edge.getScreenCTM()!;
            const length = edge.getTotalLength();
            return Array.from({ length: 65 }, (_, i) => {
              const point = edge
                .getPointAtLength((length * i) / 64)
                .matrixTransform(matrix);
              return Math.hypot(position.x - point.x, position.y - point.y);
            }).some((distance, i) => distance < 4 && i > 0 && i < 64);
          });
          return onPath.length > 0 && onPath.every(Boolean);
        }),
      )
      .toBe(true);
    await expect
      .poll(clock)
      .toBeGreaterThanOrEqual(shotTimes[index] * 1000 - 1);
    await expect(page.getByText("running", { exact: true })).toBeVisible();
    await checkArchitecture();
    await expect(page.locator(".edge-packet").first()).toBeVisible();
    if (capture) {
      const slug = scenario.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      await page.screenshot({
        path: join(capture, `0${index + 1}-${slug}.png`),
        fullPage: true,
      });
    }
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    const time = await clock();
    await checkArchitecture();
    await expect
      .poll(() =>
        page
          .locator(".edge-packet")
          .first()
          .evaluate((packet) =>
            (packet as SVGGraphicsElement).ownerSVGElement!.animationsPaused(),
          ),
      )
      .toBe(true);
    const sim = new Simulator(scenario.graph);
    sim.start();
    for (let elapsed = 0; elapsed < time; elapsed += 100) sim.advance(100);
    const m = sim.metrics();
    await expect(page.locator(".metrics-grid strong")).toHaveText([
      String(m.rps),
      String(m.success),
      String(m.failed),
      m.average.toFixed(1) + " ms",
      [m.p50, m.p95, m.p99].join(" / ") + " ms",
      m.availability.toFixed(1) + "%",
      m.errorRate.toFixed(1) + "%",
      m.cacheRate.toFixed(1) + "%",
      String(m.depth),
    ]);
    expect(errors).toEqual([]);
  });
}

test("every component setting and the seed persist after editing", async ({
  page,
}) => {
  const errors = monitor(page);
  await page.goto("./#studio");
  await projectAction(page, "New project");
  const expected: Record<string, number>[] = [];
  for (const [kind, [name]] of Object.entries(catalog)) {
    await page.getByRole("button", { name, exact: true }).click();
    const inspector = page.locator(".inspector");
    await expect(
      inspector.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    const config: Record<string, number> = {};
    for (const [field, [label, min, max, initial]] of Object.entries(
      fields[kind as Kind],
    )) {
      const input = inspector.getByLabel(label, { exact: true });
      const value =
        field === "capacity"
          ? initial - 1
          : initial === max
            ? initial - 1
            : initial + 1;
      expect(value).toBeGreaterThanOrEqual(min);
      if (field === "algorithm") await input.selectOption(String(value));
      else {
        await input.fill(String(value));
        await input.press("Enter");
      }
      await expect(input).toHaveValue(String(value));
      config[field] = value;
    }
    expected.push(config);
  }
  const seed = page.getByLabel("Simulation seed");
  await seed.fill("63");
  await seed.press("Enter");
  const saved = () =>
    page.evaluate(
      (storageKey) =>
        JSON.parse(localStorage.getItem(storageKey)!) as Project[],
      key,
    );
  await expect
    .poll(async () => (await saved()).at(-1)?.graph)
    .toMatchObject({
      seed: 63,
      nodes: expected.map((config) => ({ config })),
    });
  await seed.fill("-1");
  await seed.press("Enter");
  await expect(seed).toHaveValue("63");
  await page.reload();
  await expect(seed).toHaveValue("63");
  await expect(page.locator(".react-flow__node")).toHaveCount(11);
  const initial = (await saved())[0];
  await page.getByLabel("Project", { exact: true }).selectOption(initial.id);
  await expect(page.getByLabel("Project name")).toHaveValue(initial.name);
  expect(errors).toEqual([]);
});
