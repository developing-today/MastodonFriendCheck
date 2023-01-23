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

  if (
      object[timestamp] === undefined ||
      object[timestamp] === null ||
      typeof object[timestamp] !== "object" ||
      Array.isArray(object[timestamp])
  ) {
    object[timestamp] = {};
  }

  object[timestamp].callback = callback ? callback : function(result) {
    console.log("content.js", "got result", result);
  }

  if (group) {
    Object.assign(cache[group], object);
    // cache[group].counter++;
    // cache.counter++;
    return {group, timestamp};
  } else {
    Object.assign(cache, object);
    // cache.counter++;
    return {timestamp};
  }
}

async function onMessage(message) {
  console.log("content.js", "got message", message);
  if (Array.isArray(message)) {
    return Promise.allSettled(message.map(onMessage));
  }

  if (message.type) {
    if (message.type === "echoRequest") {
      sendMessage({ type: "echoResponse", content: message.content });
    } else {
      console.log("content.js", "no message type found", message);
    }
  }

  if (message.timestamp) {
    if (
      message.group &&
      cache[message.group] &&
      cache[message.group][message.timestamp] &&
      cache[message.group][message.timestamp].callback
    ) {
      await cache[message.group][message.timestamp].callback(message);
    } else if (
      cache[message.timestamp] &&
      cache[message.timestamp].callback
    ) {
      await cache[message.timestamp].callback(message);
    } else {
      console.log("content.js", "no callback for message", message);
    }
  }

  return Promise.resolve();
}

function fixFollowButton(button, url) {
  console.log("content.js", "fixing follow button", button, url);
  let buttonA = document.createElement("a");
  buttonA.href = url;
  buttonA.innerHTML = "Following";

  button.classList.forEach((className) => {
    buttonA.classList.add(className);
  })
  button.innerHTML = buttonA.outerHTML;

  button.addEventListener("click", function(event) {
    console.log("content.js", "follow button clicked", event);
    window.open(url, "_self");
  });
}

async function onLoad() {
  console.log("content.js", "onLoad", window.location.href);
  await sendMessage(
    { type: "onLoad" }, // if url issues, send location href as url property ?
    getCallbackTimestamp(
      "onLoad",
      async (result) => {
        console.log("content.js", "got onLoad result", result);

        let onLoadClosure = async (innerResult) => {
          let type = innerResult.type;
          let url = innerResult.content.url;

          if (type && url) {
            if (type === "jump") {
              console.log("content.js", "jump", url);
              window.open(url, "_self");
            } else if (type === "following") {
              console.log("content.js", "following", url);

              let timeNow = Date.now();
              let buttonCheckInterval = setInterval(function() {
                button = document.querySelector('.logo-button');

                if (button) {
                  console.log("content.js", "found follow button", button);
                  clearInterval(buttonCheckInterval);
                  fixFollowButton(button, url);
                }

                if (Date.now() - timeNow > (15 * 1000)) {
                  console.log("content.js", "follow button not found");
                  clearInterval(buttonCheckInterval);
                }
              }, 50);
              // same idea again except for the .copypaste prompt TODO
            } else {
              console.log("content.js", "no url type found", { type, url, result });
            }
          } else if (type) {
            console.log("content.js", "no url", { type, url, result });
          } else {
            console.log("content.js", "no type", { type, url, result });
          }
        };

        if (Array.isArray(result)) {
          await Promise.allSettled(result.content.map(onLoadClosure));
        } else {
          await onLoadClosure(result);
        }
      }
    )
  );
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
