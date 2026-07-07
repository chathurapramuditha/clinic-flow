import { test, expect } from "@playwright/test";

test("verify login with provided credentials", async ({ page }) => {
  await page.goto("http://localhost:8080/auth");

  // Wait for the form to be ready
  await page.waitForSelector('input[placeholder="00000"]');

  // Fill in the employee number
  await page.fill('input[placeholder="00000"]', "26754");

  // Fill in the password
  await page.fill('input[type="password"]', "Hemas@123");

  // Click the sign-in button
  await page.click('button:has-text("Sign in")');

  // Wait for some time to see the result
  await page.waitForTimeout(5000);

  // Take a screenshot of the result
  await page.screenshot({
    path: "/home/jules/verification/screenshots/login_provided_credentials.png",
  });

  // Check if we are redirected or if there's an error
  const currentUrl = page.url();
  console.log("Current URL after login attempt:", currentUrl);

  if (currentUrl.includes("/auth")) {
    const errorMessage = await page.locator("p.text-destructive").innerText();
    console.log("Login failed with error:", errorMessage);
  } else {
    console.log("Login successful, redirected to:", currentUrl);
  }
});
