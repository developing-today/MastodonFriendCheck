let cache = { counter: 0 };
let versionWhichSignifiesFirstRunIsNeeded = "0.1.0";

export function get(object, property, settings) {
  let defaultValue = settings ? get(settings, "default") : null;
  return object && object.hasOwnProperty(property) ? object[property] : defaultValue;
}

export function getAppPermissions() {
  return "write:follows"; //"read:search read:follows";
}

export function getRedirectUri() {
  return "urn:ietf:wg:oauth:2.0:oob"
}

export async function getCurrentTab() {
  let queryOptions = {
    active: true,
    lastFocusedWindow: true,
    url: chrome.permissions.getAll().origins
  };
  let [tab] = await chrome.tabs.query(queryOptions);
  console.log("tab", tab);
  return tab;
}

export function syncCacheWithStorage(keys) {
  chrome.storage.sync.get()
  .then(storage => {
	  Object.assign(cache, storage);
    cache["lastSyncFull"] = new Date();
    cache.counter++;

    if (cache.lastUrls) {
      cache.lastUrls = cache.lastUrls.slice(-3);
    }
    return cache;
  });
}

export async function getStorage(keys) {
  let keysArray = Array.isArray(keys) ? keys : [keys];
  if (keysArray.every(value => Object.keys(cache).includes(value))) {
    return cache; // should i stop returning the whole cache?
  } else {
    return syncCacheWithStorage(); // TODO: perf testing?
  }
}

export async function getStorageProperty(name) {
  if (Array.isArray(name) && name.length > 0) {
    name = name[0];
  }
  let result = await getStorage(name);
  console.log("getStorageProperty", name, result);
  return result[name];
}


export function createTab(url) {
  console.log("createTab: " + url);
  chrome.tabs.create({ url: url });
}

export function updateTab(url) {
  console.log("updateTab: " + url);
  chrome.tabs.update({ url: url });
}

export async function sendUrlToTab(url) {
  if (url) {
    if (await getStorageProperty("OpenInNewTab")) {
      createTab(url);
    } else {
      updateTab(url);
    }
  }
}

export function getChromeUrl(path) {
  return chrome.runtime.getURL(path);
}

export function getCurrentVersion() {
  return chrome.runtime.getManifest().version;
}

export async function getStorageVersion() {
  return getStorageProperty("version") || versionWhichSignifiesFirstRunIsNeeded;
}

export async function setStorage(object) {
  return chrome.storage.sync.set(object);
}

export async function setStorageWithProperty(name, value) {
  let object = {};
  object[name] = value;
  return setStorage(object);
}

export function setCurrentVersion() {
  return setStorageWithProperty("Version", getCurrentVersion());
}

export function removeUriHandler(url) {
  if (url.indexOf("://") > -1) {
    return url.split("://")[1];
  } else {
    return url;
  }
}

export function cleanDomain(domain) {
  if (!domain) return;
  let cleanDomain = removeUriHandler(domain.toString());
  if (cleanDomain.includes("/")) {
    return cleanDomain.split("/")[0];
  } else {
    return cleanDomain;
  }
}

export function makeHttps(url) {
  return "https://" + cleanDomain(url) + "/";
}

export async function getInstance(isNotForceHttps) {
  if (isNotForceHttps) {
    return getStorage(["Instance"]).then(result => get(result,"Instance"));
  } else {
    return getStorage(["InstanceHttps"]).then(result => get(result, "InstanceHttps"));
  }
}

export async function status(id, settings) {
  let instance = get(settings, instance) || getInstance();
  if (!instance || !id) { return; }
  let url = new URL(instance + "api/v1/statuses/" + id);
  return fetch(url).then(result => result.json());
}

export async function search(query, settings) {
  let limit = get(settings, "limit", { default: 10 });
  let instance = await getInstance();
  if (!instance || !query) { return; }
  let url = new URL(instance + "api/v2/search");
  url.searchParams.append("q", query);
  url.searchParams.append("resolve", true);
  url.searchParams.append("limit", limit);
  return fetch(url).then(result => result.json());
}

export function getCodeRedirectPath() {
  return "oauth/authorize/native";
}

export async function setCode(url) { // TODO:
  // https://hachyderm.io/oauth/authorize?response_type=code&client_id=-cx14PEOeRBwp4CC6rHzcy3QTGC63Z5zY3G33CHEqtk&redirect_uri=urn%3Aietf%3Awg%3Aoauth%3A2.0%3Aoob&scope=write%3Afollows
  // https://hachyderm.io/oauth/authorize/native?code=Ev5GQx8SdH0iMvgqZkKf-4PQG3CkrqSv1uROLwl4wIE
  let codeSplit = url.split("?");
  if (await getInstance() +  getCodeRedirectPath() == codeSplit[0]) {
      createTab(await getInstance());
      let code = codeSplit.split("=")[1];
      return setStorageWithProperty("code", code);
  }
}

export async function getCode() {
  return getStorage(["code"]).then(result => {
    if (result && result.code) {
      return result.code;
    }
  });
}

export function makeMastodonUrl(local, username, remote, status, subpath) {
  let url = [makeHttps(local).slice(0, -1), "@" + username];
  if (remote) {
    url[url.length - 1] += "@" + remote;
  }
  url.push(status);
  url.push(subpath); // TODO: test this
  url = url.filter(element => element);
  return url.join("/");
}

export function changeMastodonUriToUrl(url) {
  if (url.indexOf("/users/") > -1) {
    url = url.replace("/users/", "/@");
  }
  if (url.indexOf("/statuses/") > -1) {
    url = url.replace("/statuses/", "/");
  }
  return url;
}

export function explodeUrlNoHandler(url) {
  return removeUriHandler(url.toString()).split("/");
}

export async function toggleMastodonUrl(url) {
  // remote: https://mastodon.social/@elonjet
  // local:  https://hachyderm.io/@elonjet@mastodon.social

  // remote: https://mastodon.social/@elonjet/109594389151566367
  // local:  https://hachyderm.io/@elonjet@mastodon.social/109594389340087988

  // remote: https://mastodon.social/@elonjet/109594389151566367/reblogs
  // local:  https://hachyderm.io/@elonjet@mastodon.social/109594389340087988/reblogs

  // assume local == hachyderm.io,
  // - if user url, string manipulate url
  // - else if status url:
  // - cases:
  //   1 local to remote hachyderm.io to mastodon.social
  //     - "show original", essentially search local for url, then redirect to provided url.
  //   2 remote to local mastodon.social to hachyderm.io
  //     - primary case, must gain chrome permission to local, search local api for status id, then build url & redirect to local.
  //   3 local to local hachyderm.io to hachyderm.io
  //     - shouldn't occur, but if it does, follow 2. hopefully impossible.
  //   4 remote to remote mastodon.social to infosec.exchange
  //     - shouldn't occur, "show original" on remote, follow 2 if possible
  let urlExploded = explodeUrlNoHandler(changeMastodonUriToUrl(url.toString()));
  let [hostDomain, handle, status] = urlExploded;
  let subpath = urlExploded.slice(3).join("/");

  if (handle && handle[0] == "@") {
    let [username, remoteDomain] = handle.split("@").slice(1);
    let instance = await getInstance();
    let hostDomainUrl = makeHttps(hostDomain);

    if (hostDomainUrl == instance) {
      if (remoteDomain && remoteDomain != instance) {
        // local to remote
        console.log("local to remote");

        if (status) {
          console.log("local to remote, status, subpath");
          console.log("subpath not yet supported, redirecting to profile");
          let results = await status(status);
          console.log(results);
          return await get(results, "url");
        } else {
          return makeMastodonUrl(remoteDomain, username);
        }
      }
    } else if (remoteDomain && remoteDomain == instance) {
      // remote to local
      console.log("remote to local");
      if (!localStatus) {
        console.log("remote to local, no local status");
        return makeMastodonUrl(hostDomain, username);
      } else {
        let results = await search(url);
        let result;
        if (status && results.statuses && Array.isArray(results.statuses) && results.statuses.length > 0) {
          result = results.statuses[0];

        } else if (!status && results.accounts && Array.isArray(results.accounts) && results.accounts.length > 0) {
          result = results.accounts[0];

        } else if (results.accounts && Array.isArray(results.accounts) && results.accounts.length > 0) {
          result = results.accounts[0];

        } else if (results.statuses && Array.isArray(results.statuses) && results.statuses.length > 0) {
          result = results.statuses[0];
          // prefer indirect account over indirect status because nuance is hard and easier to get the right account by accident
        }

        if (result) {
          let id = status ? result.id : null;
          let domain = remoteDomain ||  hostDomain;
          let localUrl = makeMastodonUrl(instance, username, domain, id, subpath); // remote to local
          console.log("toggleMastodonUrl: use local", localUrl);

          if (makeHttps(hostDomain) == instance) {
            console.log("toggleMastodonUrl: pre-empting local to local", localUrl);
            return;
          }
          return localUrl;
        } else {
          console.log("toggleMastodonUrl: no results");
        }
      }
    }
  }
}

export async function toggleCurrentTab() {
  await getCurrentTab().then(toggleMastodonTab);
}

export async function getToken() {
  return getStorage("access_token");
}

export async function setToken(code) {
  const url = new URL(await getInstance() + "oauth/token");
  const formData = new FormData();
  formData.append("grant_type", "authorization_code");
  formData.append("code", code);
  console.log(JSON.stringify([cache, url, formData, code]));
  console.log(cache);
  formData.append("client_id", cache.client_id);
  formData.append("client_secret", cache.client_secret);
  formData.append("redirect_uri", getRedirectUri());
  formData.append("scope", getAppPermissions());
  return fetch(url, { method: "POST", body: formData }
  ).then(result => result.json()
  ).then(result => { console.log("setToken", result); return result; }
  ).then(setStorage).then(result => result.access_token);
}

export async function follow(id) {
  let url = new URL(
    await getInstance() + "api/v1/accounts/" + id + "/follow"
  );
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + await getToken(),
    }
  }).then(response => response.json());
}

export async function toggleMastodonTab(tab, settings) {
  // if (url && url.indexOf(getCodeRedirectPath() > -1)) {
  //   console.log("toggleMastodonTab: code redirect");
  //   return setCode(url).then(setToken);
  // } else {
    if (tab && tab.url) {
      return toggleMastodonUrl(tab.url).then(async result => {
        if (!result) {
          return;
        }
        let url = get(result, "url") || result;
        console.log("toggleMastodon", url);
        if (get(settings, "onClicked") || await getStorageProperty("AutoRedirectOnLoad")) {
          return sendUrlToTab(result);
        } else {
          console.log("toggleMastodonTab: no redirect", result);
          retur
        }
      });
    } else {
      console.log("toggleMastodonTab: no tab");
      let current_tab = await getCurrentTab();
      console.log(current_tab);
      if (current_tab && current_tab.url) {
        console.log(toggleMastodonUrl(current_tab.url));
      }
    }
  // }
}

// TODO: for content script follow->following?
// export async function onMessage(message, sender, sendResponse) {
//   if (message.type === "getStorage") {
//     await getStorage(message.keys).then(result => {
//       sendResponse(result);
//     });
//     return true;
//   } else if (message.type === "setStorage") {
//     await setStorage(message.data).then(result => {
//       sendResponse(result);
//     });
//     return true;
//   } else if (message.type === "toggleCurrentTab") {
//     await toggleCurrentTab();
//   } else if (message.type === "setOauthCode") {
//     await setOauthCode();
//   }
// } // TODO sendResponse

export function onAlarm(alarm) {
  if (alarm.name === "syncCacheWithStorage") {
    syncCacheWithStorage();
  }
}

export async function onInstalled(reason) {
  if ([chrome.runtime.OnInstalledReason.INSTALL, "onClicked"].includes(reason)) {
    await syncCacheWithStorage();
    if (await getCurrentVersion() !== await getStorageVersion()) {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        createTab(getChromeUrl("options.html"))
      }
    }
  }
}

export function onChanged(changes, namespace) {
  for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
    cache[key] = newValue;
  }
  cache["lastSyncPartial"] = new Date();
};

export async function onClicked(tab) {
  console.log("onClicked", tab);
  if (await getStorageVersion() === versionWhichSignifiesFirstRunIsNeeded) {
    return await onInstalled("onClicked");
  }
  if (await getStorageProperty("OnClickedToggle")) {
    console.log("onClicked", "OnClickedToggle enabled");
    return await onUpdated(tab.id, { status: "onClicked", onClicked: true }, tab);
  } else {
    console.log("onClicked", "OnClickedToggle disabled");
  }
}

export async function onUpdated(tabId, changeInfo, tab) {
  console.log("onUpdated", tabId, changeInfo, tab);
  if (["loading", "onClicked"].includes(changeInfo.status) && tab && tab.url && tab.status) {

    if (tab.url.indexOf(getCodeRedirectPath()) > -1) {
      console.log("onUpdated", "code redirect", tab.url);
    }
    let timeBetweenUpdates = 1000 * 1;
    let timestamp = new Date();

    if (!cache) { cache = {}; }

    if (get(cache, "lastTabUpdated") > timestamp - timeBetweenUpdates) {
      console.log("onUpdated", "lastUpdated too new", { cache: cache.lastTabUpdated, timestamp, timeBetweenUpdates });
      return;
    }

    if (get(cache, "InstanceHttps") && cache.InstanceHttps.length > 0) {

      if (tab.url.indexOf(cache.InstanceHttps) > -1) {
        console.log("onUpdated", "url is local", tab.url);
        if (changeInfo.status === "onClicked") {
          console.log("onUpdated", "onClicked on local url", tab.url);
        } else {
          return;
        }
      } else {
        console.log("onUpdated", "url is not local", tab.url);
      }
    } else {
      console.log("onUpdated", "no instance", tab.url, cache);
    }

    if (!get(cache, "lastUrls") || !Array.isArray(cache.lastUrls)) {
      console.log("onUpdated", "lastUrls was not an array", cache.lastUrls);
      cache.lastUrls = [];
    }

    if (cache.lastUrls.length > 0) {
      let lastUrlData = cache.lastUrls[cache.lastUrls.length - 1];

      if (lastUrlData.url === tab.url) {
        console.log("onUpdated", "lastUrl was the same", { lastUrlData });
        let timeBetweenUpdatesForSameUrlAndIsLastUrl = 1000 * 5;

        if (lastUrlData.timestamp > timestamp - timeBetweenUpdatesForSameUrlAndIsLastUrl) {
          console.log("onUpdated", "lastUrl was too new", { lastUrlData, timestamp, timeBetweenUpdatesForSameUrlAndIsLastUrl });
          return;
        }
      }

      let timeBetweenUpdatesForSameUrl = 1000 * 5;

      if (cache.lastUrls.some(lastUrl => lastUrl.url === tab.url && lastUrl.timestamp > timestamp - timeBetweenUpdatesForSameUrl)) {
        console.log("onUpdated", "url was too new", { lastUrl });
        return;
      }
    }

    cache.lastUrls = cache.lastUrls.slice(-9);
    cache.lastUrls.push({ url: tab.url, timestamp });
    cache.lastTabId = tabId;
    cache.lastTabUpdated = timestamp;

    let settings = changeInfo
    await toggleMastodonTab(tab, settings);

  }
}

chrome.action.onClicked.addListener(onClicked);

chrome.alarms.create("syncCacheWithStorage", {periodInMinutes: 5});
chrome.alarms.onAlarm.addListener(onAlarm);

chrome.runtime.onInstalled.addListener(onInstalled);

chrome.storage.onChanged.addListener(onChanged);

chrome.tabs.onUpdated.addListener(onUpdated);

syncCacheWithStorage();

/*
// todo:

----

code redirects based on url

but it can overwhelm api limits

oauth is setup
but access token is untested
and 'follow' and 'list following' logic is not implemented

popup moved to options
but action button is unused sofar

need to add options
jump
  - autojump
  - jump on copypaste
  - manual jump
follow
  - following when following
  - follow button works
- new tab or update current_tab
  - must fix update current tab

improve caching
  cache all url translations ? both ways?
  cache timing / max search calls per minute ___


improve and guarantee tab updates happen in correct window or otherwise always in a new tab.
maybe close current activetab, then open new tab
but that might scare a user and be unreliable


does following list need private access?

create tab vs new tab


----


follow
following
follower
blocked
muted
mutuals

[[2023-01-02 Monday]][[z/2023/01/02]]
<enable extended access for all tabs>
  - you give chaos goblin power? <confirm>
  - fix original page following button as above
    - needs * host permission for content script
    - may need or be easier with oauth for original instance for api
    - may need oauth scope read:follows, read:blocks, read:mutes
  - if you click a link from local mastodon, the numbers are updated to = original page
    - needs * host permission for cors
    - needs fetch to query original instance
  - allow follow button to be clicked and work
    - needs * host permission for content script
    - needs fetch to query original instance
    - needs oauth for original instance for api
    - needs oauth scope write:follows


-----


move oauth app config into settings page separte from initial app

phases
0 no config
1 config mastodon instance, gaet chrome host for instance
  - user must grant permissions
2 config oauth app for instance, get oauth client id and secret,
  - user must grant permissions for oauth app
3 get token
  - user will see redirect url before extension redirects

is there a change scope path without full oauth rebuild?
will dev today actually have to host oauth app?


-----

TODO: if handle, add to app name, add isodate
*/
