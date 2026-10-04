(() => {
  const friendlyError = (error) => {
    const message = String(error?.message || error || '');
    if (
      /receiving end does not exist|extension context invalidated|message port closed/i.test(
        message,
      )
    ) {
      return new Error(
        'The reporting update is not fully loaded. Reload Amex Offers in opera://extensions, refresh this Amex tab, then click the extension again.',
      );
    }
    return error instanceof Error ? error : new Error(message);
  };
  const request = async (message) => {
    let timer;
    try {
      return await Promise.race([
        chrome.runtime.sendMessage(message),
        new Promise((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(
                  'The extension did not respond. Reload it in opera://extensions and refresh this Amex tab.',
                ),
              ),
            12000,
          );
        }),
      ]);
    } catch (error) {
      throw friendlyError(error);
    } finally {
      clearTimeout(timer);
    }
  };
  globalThis.AmexBridge = { request };
})();
