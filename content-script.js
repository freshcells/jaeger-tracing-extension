const wakeup = function () {
  setTimeout(function () {
    chrome.runtime.sendMessage('ping', function (response) {
      return;
    });
    wakeup();
  }, 1000);
};
wakeup();
