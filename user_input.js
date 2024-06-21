const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const actions = [];

  // Helper function to record actions
  const recordAction = (type, details) => {
    actions.push({ type, details, timestamp: new Date().toISOString() });
  };

  // Event listener for clicks
  page.on('domcontentloaded', () => {
    page.evaluate(() => {
      document.addEventListener('click', (event) => {
        const { clientX: x, clientY: y, button, target } = event;
        const elementDetails = {
          tagName: target.tagName,
          id: target.id,
          classes: target.className,
          attributes: Array.from(target.attributes).reduce((acc, attr) => {
            acc[attr.name] = attr.value;
            return acc;
          }, {}),
          outerHTML: target.outerHTML,
          inlineStyles: target.style.cssText,
          css: getComputedStyle(target).cssText
        };
        window.recordAction('click', { x, y, button, elementDetails });
      });

      function getAllCSS() {
        let css = "";
        for (let stylesheet of document.styleSheets) {
          try {
            for (let rule of stylesheet.cssRules) {
              css += rule.cssText + "\n";
            }
          } catch (e) {
            console.error("Error reading stylesheet:", e);
          }
        }
        return css;
      }

      function getScripts() {
        return Array.from(document.scripts).map(script => ({
          src: script.src,
          content: script.textContent
        }));
      }

      window.recordHTMLCSSJS = (target) => {
        const elementDetails = {
          tagName: target.tagName,
          id: target.id,
          classes: target.className,
          attributes: Array.from(target.attributes).reduce((acc, attr) => {
            acc[attr.name] = attr.value;
            return acc;
          }, {}),
          outerHTML: target.outerHTML,
          inlineStyles: target.style.cssText,
          css: getComputedStyle(target).cssText,
          allCSS: getAllCSS(),
          scripts: getScripts()
        };
        return elementDetails;
      };
    });
  });

  // Event listener for key presses
  page.on('domcontentloaded', () => {
    page.evaluate(() => {
      document.addEventListener('keydown', (event) => {
        const { key, code } = event;
        window.recordAction('keydown', { key, code });
      });
    });
  });

  // Expose the recordAction function to the page context
  await page.exposeFunction('recordAction', recordAction);

  // Expose a function to get the HTML, CSS, and JS
  await page.exposeFunction('recordHTMLCSSJS', async (target) => {
    const details = await page.evaluate((target) => {
      return window.recordHTMLCSSJS(target);
    }, target);
    return details;
  });

  // Open the desired URL
  await page.goto('https://example.com');

  // Allow time for user interaction
  console.log('Interact with the browser. Press Enter to stop recording...');
  await new Promise((resolve) => process.stdin.once('data', resolve));

  // Save the recorded actions to a file
  fs.writeFileSync('user_actions.json', JSON.stringify(actions, null, 2));

  // Close the browser
  await browser.close();
})();

