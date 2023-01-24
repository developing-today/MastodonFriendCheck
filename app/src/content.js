let cache = { counter: 0 };

async function sendMessage(message, timestamp) {

  if (Array.isArray(message)) {
    return Promise.allSettled(message.map((message) => sendMessage(message, timestamp)));
  }

  let messageObject = { content: message };

  if (timestamp) {

    if (timestamp.group) {
      Object.assign(messageObject, { group: timestamp.group, timestamp: timestamp.timestamp });

    } else {
      Object.assign(messageObject, { timestamp: timestamp.timestamp });
    }
  } else {
    Object.assign(messageObject, { timestamp: Date.now() });
  }

  if (message.type) {
    Object.assign(messageObject, { type: message.type });
  }

  if (!messageObject.type) {
    console.log("content.js", "no message type", messageObject);

    if (typeof message === "string") {
      console.log("content.js", "message is string. setting message type to message", { messageObject, message });
      messageObject.type = message;
    } else {
      console.log("content.js", "message is not string. leaving message type unset.", { messageObject, message });
    }
  }
  console.log("content.js", "sending message", messageObject);

  return chrome.runtime.sendMessage(messageObject);
}

function getCallbackTimestamp(group, callback) {
  let timestamp = Date.now();
  let object = cache;
  if (group) {
    if (cache[group] === undefined ||
      cache[group] === null ||
      typeof cache[group] !== "object" ||
      Array.isArray(cache[group])) {
      cache[group] = { counter: 0 };
    }
    object = cache[group];
  }
  console.log("content.js", "getCallbackTimestamp", "got callback timestamp", { group, timestamp, callback });

  if (
      object[timestamp] === undefined ||
      object[timestamp] === null ||
      typeof object[timestamp] !== "object" ||
      Array.isArray(object[timestamp])
  ) {
    object[timestamp] = {};
  }

  object[timestamp].callback = callback ? callback : function(result) {
    console.log("content.js", "defaultCallback_getCallbackTimestamp", "got result", { result });
  }
  console.log("content.js", "getCallbackTimestamp", "got callback timestamp", { group, timestamp, callback });

  if (group) {
    console.log("content.js", "getCallbackTimestamp", "returning with group", { group, timestamp, callback });
    Object.assign(cache[group], object);
    // cache[group].counter++;
    // cache.counter++;
    return {group, timestamp};
  } else {
    console.log("content.js", "getCallbackTimestamp", "returning without group", { group, timestamp, callback });
    Object.assign(cache, object);
    // cache.counter++;
    return {timestamp};
  }
}

async function onMessage(message) {
  console.log("content.js", "onMessage", "got message", message);
  if (Array.isArray(message)) {
    return Promise.allSettled(message.map(onMessage));
  }

  if (message.type) {
    if (message.type === "echoRequest") {
      sendMessage({ type: "echoResponse", content: message.content });
    } else {
      console.log("content.js", "onMessage", "no message type found", message);
    }
  }

  if (message.timestamp) {
    if (
      message.group &&
      cache[message.group] &&
      cache[message.group][message.timestamp] &&
      cache[message.group][message.timestamp].callback &&
      typeof cache[message.group][message.timestamp].callback === "function"
    ) {
      await cache[message.group][message.timestamp].callback(message);
    } else if (
      cache[message.timestamp] &&
      cache[message.timestamp].callback &&
      typeof cache[message.timestamp].callback === "function"
    ) {
      await cache[message.timestamp].callback(message);
    } else {
      console.log("content.js", "onMessage", "no callback for message", message);
    }
  }

  return Promise.resolve();
}

function fixFollowButton(button, url) {
  console.log("content.js", "fixFollowButton", "fixing follow button", button, url);
  let buttonA = document.createElement("a");
  buttonA.href = url;

  buttonA.innerHTML = "Following";

  button.classList.forEach((className) => {
    buttonA.classList.add(className);
  })
  button.innerHTML = buttonA.outerHTML;

  button.addEventListener("click", function(event) {
    console.log("content.js", "fixFollowButton", "follow button clicked", event);
    window.open(url, "_self");
  });
}

async function handleOnLoadResult(result) {
  let type = result.type;
  let url = result.content.url;

  if (type && url) {
    if (type === "jump") {
      console.log("content.js", "handleOnLoadResult", "jump", url);
      window.open(url, "_self");

    } else if (type === "following") {
      console.log("content.js", "handleOnLoadResult", "following", url);

      let timeNow = Date.now();
      let buttonCheckInterval = setInterval(function() {
        button = document.querySelector('.logo-button');

        if (button) {
          console.log("content.js", "handleOnLoadResult", "found follow button", button);
          clearInterval(buttonCheckInterval);
          fixFollowButton(button, url);
        }

        if (Date.now() - timeNow > (15 * 1000)) {
          console.log("content.js", "handleOnLoadResult", "follow button not found");
          clearInterval(buttonCheckInterval);
        }
      }, 50);
    } else {
      console.log("content.js", "handleOnLoadResult", "no url type found", { type, url, result });
    }
  } else if (type) {
    console.log("content.js", "handleOnLoadResult", "no url", { type, url, result });
  } else {
    console.log("content.js", "handleOnLoadResult", "no type", { type, url, result });
  }
};

async function onLoadResult(result) {
  console.log("content.js", "onLoadResult", "got onLoad result", result);

  if (Array.isArray(result)) {
    await Promise.allSettled(result.content.map(handleOnLoadResult));
  } else {
    await handleOnLoadResult(result);
  }
}

async function onLoad() {
  console.log("content.js", "onLoad", window.location.href);
  await sendMessage({ type: "onLoad" }, getCallbackTimestamp("onLoad", onLoadResult));
  // TODO autojump .copypaste prompt
}

chrome.runtime.onMessage.addListener(onMessage);

onLoad();

let url = window.location.href;
let timeNow = Date.now();
let urlCheckInterval = setInterval(function() {
  console.log("content.js", "checking url",  { url, href: window.location.href });
  if (window.location.href !== url) {
    console.log("content.js", "url changed", { url, href: window.location.href });
    onLoad();
    url = window.location.href;
    timeNow = Date.now();
  }
  if (Date.now() - timeNow > (5 * 60 * 1000)) {
    clearInterval(urlCheckInterval);
  }
}, 2000);
