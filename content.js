let cache = {};

async function sendMessage(message, timestamp) {

  if (Array.isArray(message)) {
    return Promise.all(message.map((message) => sendMessage(message, timestamp)));
  }

  let messageObject = { content: message };

  if (timestamp) {

    if (timestamp.group) {
      Object.assign(messageObject, { group: timestamp.group, timestamp: timestamp.timestamp });

    } else {
      Object.assign(messageObject, { timestamp: timestamp.timestamp });
    }
  }

  if (message.type) {
    Object.assign(messageObject, { type: message.type });
  }

  return chrome.runtime.sendMessage(messageObject);
}

async function updateCache(message) {
  Object.assign(cache, message.content);
  // console.log("content.js", "cache updated", message, cache);
  return Promise.resolve();
}

function getCallbackTimestamp(group, callback) {
  let timestamp = Date.now();
  let object = cache;
  if (group) {
    if (cache[group] === undefined ||
      cache[group] === null ||
      typeof cache[group] !== "object" ||
      Array.isArray(cache[group])) {
      cache[group] = {};
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
    // console.log("content.js", "got result", result);
  }

  if (group) {
    Object.assign(cache[group], object);
    return {group, timestamp};
  } else {
    Object.assign(cache, object);
    return {timestamp};
  }

}

async function onMessageCallback(message) {
  if (Array.isArray(message)) {
    return Promise.all(message.map(onMessageCallback));
  }

  // console.log("content.js", "calling callback for message", message);

  if (message.group) {
    await cache[message.group][message.timestamp].callback(message);
  } else {
    await cache[message.timestamp].callback(message);
  }

  return Promise.resolve();
}

async function onMessage(message) {
  // console.log("content.js", "got message", message);
  if (Array.isArray(message)) {
    return Promise.all(message.map(onMessage));
  }

  if (message.timestamp) {
    if (message.group) {
      cache[message.group][message.timestamp].message = message;
      if (cache[message.group][message.timestamp].callback) {
        return await onMessageCallback(message);
      } else {
        // console.log("content.js", "no callback for message", message);
      }
    } else {
      cache[message.timestamp].message = message;
      if (cache[message.timestamp].callback) {
        return await onMessageCallback(message);
      } else {
        // console.log("content.js", "no callback for message", message);
      }
    }
  }

  if (message.type === "updateCache") {
    return updateCache(message);
  } else {
    // console.log("content.js", "unknown message type", message, cache);
    return Promise.resolve();
  }
}

chrome.runtime.onMessage.addListener(onMessage);

function fixFollowButton(followButton, href) {
  let followButtonLink = document.createElement("a");
  followButtonLink.href = href;

  followButtonLink.innerHTML = "Following";

  followButton.classList.forEach((className) => {
    followButtonLink.classList.add(className);
  })
  followButton.innerHTML = followButtonLink.outerHTML;

  followButton.addEventListener("click", function(event) {
    // console.log("content.js", "follow button clicked", event);
    window.location.href = href;
  });
}

function onLoad() {
  // console.log("content.js", "onLoad", window.location.href);
  sendMessage({
    type: "getStorage",
    keys: ["InstanceHttps", "InstanceClean", "follows"]
  }, getCallbackTimestamp("getStorage", (result) => {
      // console.log("content.js", "getStorage", result.content.InstanceHttps, result);
      if (result.parent.sender.url) {
        let url = new URL(result.parent.sender.url);
        if (url.hostname == result.content.InstanceClean) {
          // console.log("content.js", "on instance page");

        } else {
          // console.log("content.js", "not on instance page");

          let instance = url.hostname.replace(url.protocol + "//", "");
          let path = url.pathname.split("/").filter((item) => item !== "");
          // console.log("content.js", "url", url, instance, path);
          let handle = path[0];

          if (handle.startsWith("@")) {
            handle = handle.substring(1);
          }
          let handleSplit = handle.split("@");

          if (handleSplit.length > 1) {
            handle = handleSplit[0];
            instance = handleSplit[1];
          }
          let account = handle + "@" + instance;
          // console.log("content.js", "handle", handle, instance);

          if (account in result.content.follows) {
            // console.log("content.js", "following", account);

            let buttonCheckInterval = setInterval(function() {
              followButton = document.querySelector('.logo-button');

              if (followButton) {
                // console.log("content.js", "found follow button", followButton);

                clearInterval(buttonCheckInterval);

                let localProfile = result.content.InstanceHttps + "@" + account;
                fixFollowButton(followButton, localProfile);
              }
            }, 50);
          } else {
            // console.log("content.js", "not following", account);
          }
          // # todo move all to worker then send message back? only js for changes in content.js?
        }
      }
  }));
}

onLoad();
