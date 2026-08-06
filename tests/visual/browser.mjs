import { chromium } from "playwright";
import { Builder, By } from "selenium-webdriver";
import * as firefox from "selenium-webdriver/firefox.js";
import { download as downloadGeckodriver } from "geckodriver";

const ZEN_BINARY = "/Applications/Zen.app/Contents/MacOS/zen";

export class ChromiumViewport {
  static async create(viewport) {
    const browser = await chromium.launch({
      headless: process.env.CI === "true" || process.env.SUPERNEO_HEADLESS === "1",
    });
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12_000);
    return new ChromiumViewport(browser, context, page);
  }

  constructor(browser, context, page) {
    this.browser = browser;
    this.context = context;
    this.page = page;
  }

  async goto(url) {
    await this.page.goto(url, { waitUntil: "domcontentloaded" });
  }

  async reload() {
    await this.page.reload({ waitUntil: "domcontentloaded" });
  }

  async execute(script, ...args) {
    return this.page.evaluate(
      ({ source, values }) => {
        const fn = new Function(
          "args",
          `return (function () {${source}}).apply(window, args)`,
        );
        return fn(values);
      },
      { source: script, values: args },
    );
  }

  async screenshot() {
    return this.page.screenshot({ type: "png" });
  }

  async elementScreenshot(selector) {
    return this.page.locator(selector).first().screenshot({ type: "png" });
  }

  async click(selector) {
    await this.page.locator(selector).first().click();
  }

  async emulateReducedMotion(reduced) {
    await this.page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
    return true;
  }

  async close() {
    await this.context.close();
    await this.browser.close();
  }
}

export class WebDriverViewport {
  static async create(browserName, viewport) {
    let builder = new Builder();
    if (browserName === "zen") {
      const driverPath = await downloadGeckodriver();
      const service = new firefox.ServiceBuilder(driverPath);
      const options = new firefox.Options()
        .setBinary(ZEN_BINARY)
        .addArguments("-headless")
        .setPreference("media.autoplay.default", 0)
        .setPreference("media.autoplay.blocking_policy", 0)
        .setPreference("ui.prefersReducedMotion", 0);
      builder = builder
        .forBrowser("firefox")
        .setFirefoxOptions(options)
        .setFirefoxService(service);
    } else {
      builder = builder.forBrowser("safari");
    }

    const driver = await builder.build();
    await driver.manage().setTimeouts({
      implicit: 0,
      pageLoad: 15_000,
      script: 15_000,
    });
    const session = new WebDriverViewport(browserName, driver);
    await session.calibrateViewport(viewport);
    return session;
  }

  constructor(browserName, driver) {
    this.browserName = browserName;
    this.driver = driver;
  }

  async calibrateViewport(target) {
    await this.driver.manage().window().setRect({
      x: 0,
      y: 0,
      width: target.width,
      height: target.height,
    });
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const inner = await this.driver.executeScript(
        "return { width: window.innerWidth, height: window.innerHeight };",
      );
      if (inner.width === target.width && inner.height === target.height) return;
      const rect = await this.driver.manage().window().getRect();
      await this.driver.manage().window().setRect({
        x: 0,
        y: 0,
        width: Math.max(200, rect.width + target.width - inner.width),
        height: Math.max(200, rect.height + target.height - inner.height),
      });
    }
    const inner = await this.driver.executeScript(
      "return { width: window.innerWidth, height: window.innerHeight };",
    );
    if (inner.width !== target.width || inner.height !== target.height) {
      throw new Error(
        `${this.browserName} inner viewport is ${inner.width}x${inner.height}; ` +
        `expected ${target.width}x${target.height}`,
      );
    }
  }

  async goto(url) {
    await this.driver.get(url);
  }

  async reload() {
    await this.driver.navigate().refresh();
  }

  async execute(script, ...args) {
    return this.driver.executeScript(script, ...args);
  }

  async screenshot() {
    return Buffer.from(await this.driver.takeScreenshot(), "base64");
  }

  async elementScreenshot(selector) {
    const element = await this.driver.findElement(By.css(selector));
    return Buffer.from(await element.takeScreenshot(true), "base64");
  }

  async click(selector) {
    await this.driver.findElement(By.css(selector)).click();
  }

  async emulateReducedMotion() {
    return false;
  }

  async close() {
    await this.driver.quit();
  }
}

export async function createViewport(browserName, viewport) {
  if (browserName === "chromium") return ChromiumViewport.create(viewport);
  if (browserName === "safari" || browserName === "zen") {
    return WebDriverViewport.create(browserName, viewport);
  }
  throw new Error(`Unsupported browser: ${browserName}`);
}
