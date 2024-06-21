const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const actions = [];

  // Helper function to record actions
  const recordAction = (type, details) => {
    actions.push({ type, details, timestamp: new Date().toISOString() });
  };

  // Function to log executed JavaScript code
  const logJavaScriptExecution = async (page) => {
    await page.evaluate(() => {
      const originalAddEventListener = EventTarget.prototype.addEventListener;

      EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (type === 'click') {
          const wrappedListener = function(event) {
            const code = listener.toString();
            fetch('/log-js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code })
            });
            return listener.apply(this, arguments);
          };
          return originalAddEventListener.call(this, type, wrappedListener, options);
        }
        return originalAddEventListener.call(this, type, listener, options);
      };
    });

    await page.route('/log-js', (route, request) => {
      const postData = JSON.parse(request.postData());
      recordAction('js-execution', { code: postData.code });
      route.fulfill({ status: 200, body: 'Logged' });
    });
  };

  // Open the desired URL
  await page.goto('https://example.com');

  // Enable logging of JavaScript execution
  await logJavaScriptExecution(page);

  // Allow time for user interaction
  console.log('Interact with the browser. Press Enter to stop recording...');
  await new Promise((resolve) => process.stdin.once('data', resolve));

  // Print the recorded actions to the terminal
  console.log(JSON.stringify(actions, null, 2));

  // Close the browser
  await browser.close();
})();

