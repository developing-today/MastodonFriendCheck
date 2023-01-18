let cache = {};

async function sendMessageToBackground(message, timestamp) {

  if (Array.isArray(message)) {
    return Promise.all(message.map((message) => sendMessageToBackground(message, timestamp)));
  }

  let messageObject = { message };

  if (timestamp) {

    if (timestamp.group) {
      Object.assign(messageObject, { group: timestamp.group, timestamp: timestamp.timestamp });

    } else {
      Object.assign(messageObject, { timestamp: timestamp.timestamp });
    }
  }

  if (message.messageType) {
    Object.assign(messageObject, { messageType: message.messageType });
  }

  return chrome.runtime.sendMessage(messageObject);
}

async function updateCache(message) {
  Object.assign(cache, message.message);
  // console.log("content.js", "cache updated", message, cache);
  return Promise.resolve();
}

function getCallbackTimestamp(group, callback) {
  let timestamp = Date.now();
  let object = cache;
  if (group) {
    if (cache[group] === undefined || cache[group] === null || typeof cache[group] !== "object" || Array.isArray(cache[group])) {
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

async function onMessageFromBackground(message) {
  // console.log("content.js", "got message", message);
  if (Array.isArray(message)) {
    return Promise.all(message.map(onMessageFromBackground));
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

  if (message.messageType === "updateCache") {
    return updateCache(message);
  } else {
    // console.log("content.js", "unknown message type", message, cache);
    return Promise.resolve();
  }
}

chrome.runtime.onMessage.addListener(onMessageFromBackground);

sendMessageToBackground({
  messageType: "getStorage",
  keys: ["Instance"]
}, getCallbackTimestamp("getInstance", (result) => {
    console.log("content.js", "getInstance", result.message.Instance, result);
}));

// console.log("content.js", "cache", cache);
// console.log("content.js", "loaded");

/*
following
  this is done using messages between here and the service worker background.js

  on-page load:
    service worker sees page is loaded, it:
  1. Get the current URL
  2. Determine if the URL is a mastodon page, else return
  3. Determine if it's a profile page, else return
  4. Determine if it's a remote profile page, else return
     4.1 must be remote, because local profiles would already have follow status
  5. Get the profile handle from the url

  option 1
  6. Search for the profile handle in the local database
  8. if found, update follow->following on-page
  8. if following, make 'following' button a link to local version of profile page

  option 2
  6. [ already have a cache of all following handles ]
  6.1. a cache may need account access to get the following list
  7. check if handle is in cache
  8. if found, update follow->following on-page
  10. if following, make 'following' button a link to local version of profile page

  option 3
  6. Search for the profile handle in the local database
  7. if found, take the id from the account returned
  8. check following status
  9. if found, update follow->following on-page
  10. if following, make 'following' button a link to local version of profile page


  on-click of the follow button, send a message to the service worker
  1. Get the current URL
  2. Determine if the URL is a mastodon page, else return
  3. Determine if it's a profile page, else return
  4. Determine if it's a remote profile page, else return
  4.1 must be remote, because local profiles would already have follow status
  5. Get the profile handle from the url
  6. Search for the profile handle in the local database
  7. if found, take the id from the account returned
  9.1. update follow->following on-page
  10.1. if following, make 'following' button a link to local version of profile page


*/


/*
stats
  this is done using messages between here and the service worker background.js

  1. Get the current URL
  2. Determine if the URL is a mastodon page, else return
    2.1. Determine if it's a status, it must be a status.
         2.1.1 running these searchs on every post in the feed is infeasiable.
  3. If URL is local,
    3.1. If post is local to local, nothing to do, return.
    3.2. If post is local to remote,
      3.2.1. Get the post ID
      3.2.2. Search for the post ID in the local database
      3.2.3. Take url from returned status
      3.2.4. get post id from url
      3.2.5. search for post id in remote url
      3.2.6. If found, return stats
      3.2.7. update page
  4. If URL is remote,
    If post is local to the given remote, nothing to do, return.
    If post is remote to remote,
      4.1. Get the post ID
      4.2 search for the post ID in the local database
      4.3 Take url from returned status
      4.4 get post id from url
      4.5 search for post id in remote url
      4.6 If found, return stats
      4.7 update page
*/

/*
links
  TODO:
  - make setting for each below
  - when link like "@jack@twitter.com"
     - make it into a hyperlink to https://twitter.com/jack
  - make profile links click to original page
  - make profile handle a link to profile page
    - if local, link to original
    - if remote, link to local
*/
