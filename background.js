chrome.action.onClicked.addListener(function () {
  chrome.windows.create({
    url: chrome.runtime.getURL("popup.html"),
    type: "popup",
    width: 400,
    height: 600,
  });
});
