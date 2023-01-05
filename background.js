let cache = { counter: 0 };

export function versionWhichSignifiesFirstRunIsNeeded() {
  return "0.1.0";
}

export function get(object, property, settings) {
  let defaultValue = settings ? get(settings, "default") : null;
  return object && property && object.hasOwnProperty(property)
          && object[property] !== undefined && object[property] !== null
          ? object[property] : defaultValue;
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

export function sendResultsToCache(results, settings) {
  let namespace = get(settings, "namespace");
  Object.assign(cache, results);
  if (namespace) {
    let storage = get(cache, namespace, { default: {} });
    Object.assign(storage, results);
    cache[namespace] = storage;
    cache[namespace]["lastSyncFull"] = new Date();
  }
  if (cache.lastUrls) {
    cache.lastUrls = cache.lastUrls.slice(-3);
  }
  cache["lastSyncPartial"] = new Date();
  return cache;
}

export function syncCacheWithStorage(keys) {
  chrome.storage.sync.get().then(results=> sendResultsToCache(results, { namespace: "sync" }));
  chrome.storage.local.get().then(results=> sendResultsToCache(results, { namespace: "local" }));
  cache["lastSyncFull"] = new Date();
  cache.counter++;
  console.log("syncCacheWithStorage", cache);
  return cache;
}

export async function getStorage(keys) {
  // TODO: something about local storage?
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
  return await getStorageProperty("Version") || versionWhichSignifiesFirstRunIsNeeded();
}

export async function setStorage(object, settings) {
  // TODO:   if(chrome.runtime.lastError) {
  if (get(settings, "local")) {
    return chrome.storage.local.set(object);
  } else {
    return chrome.storage.sync.set(object);
  }
}

export async function setStorageWithProperty(name, value, settings) {
  let object = {};
  object[name] = value;
  return setStorage(object, settings);
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
  if (await getInstance() + getCodeRedirectPath() == codeSplit[0]) {
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

export async function statuses(id, settings) {
  let instance = get(settings, "instance") || await getInstance();
  if (!instance || !id) { return; }
  let url = new URL(instance + "api/v1/statuses/" + id);
  return fetch(url).then(result => result.json());
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
  console.log("toggleMastodonUrl", url);
  let urlExploded = explodeUrlNoHandler(changeMastodonUriToUrl(url.toString()));
  let [hostDomain, handle, status] = urlExploded;
  let subpath = urlExploded.slice(3).join("/");
  console.log({ hostDomain, handle, status, subpath });

  if (handle && handle[0] == "@") {
    let [username, remoteDomain] = handle.split("@").slice(1);
    let instance = await getInstance();
    let hostDomainUrl = makeHttps(hostDomain);
    console.log({ username, remoteDomain, instance, hostDomainUrl });

    if (hostDomainUrl == instance) {
      if (remoteDomain && remoteDomain != instance) {

        if (status) {
          console.log("local to remote, status");
          let results = await statuses(status);
          console.log(results);
          return get(results, "url");

        } else {
          console.log("local to remote, profile");
          return makeMastodonUrl(remoteDomain, username);
        }

      } else {
        console.log("local to local"); // ???
        return makeMastodonUrl(instance, username, null, status, subpath);
      }

    } else {
      if (status) {
        console.log("remote to local, status");

        let results = await search(url);
        let result;

        if (results && results.statuses && Array.isArray(results.statuses) && results.statuses.length > 0) {
          result = results.statuses[0];
          if (result) {
            let domain = remoteDomain ||  hostDomain;
            let localUrl = makeMastodonUrl(instance, username, domain, result.id, subpath); // remote to local
            console.log("toggleMastodonUrl: use local", localUrl);

            return localUrl;
          } else {
            console.log("toggleMastodonUrl: no result");
          }
        } else {
          console.log("toggleMastodonUrl: no results");
        }
      } else {
        console.log("remote to local, profile");
        return makeMastodonUrl(instance, username, hostDomain);
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
  // console.log("toggleMastodonTab", tab, settings);
    if (tab && tab.url) {
      return toggleMastodonUrl(tab.url).then(async result => {
        if (!result) {
          return;
        }
        let url = get(result, "url", { default: result });
        console.log("toggleMastodon", url);
        if (get(settings, "onClicked") || await getStorageProperty("AutoRedirectOnLoad")) {
          return sendUrlToTab(result);
        } else {
          console.log("toggleMastodonTab: no redirect", result);
          return result;
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

// TODO: for content script follow->following? stats?
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
  } else if (alarm.name === "syncLocalWithFollowsCsv") {
    syncLocalWithFollowsCsv();
  }
}

export async function onInstalled(reason) {
  console.log("onInstalled", reason);
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
  Object.assign(cache, changes);
  let namespaceCache = get(cache, namespace, { default: {} });
  Object.assign(namespaceCache, changes);
  namespaceCache["lastSyncPartial"] = new Date();
  cache[namespace] = namespaceCache;
  cache["lastSyncPartial"] = new Date();
};

export async function syncLocalWithFollowsCsv() {
  let instance = await getInstance();
  if (instance) {
    return fetch(instance + "settings/exports/follows.csv").then(response => response.text()).then(text => {
      let data = {};
      let lines = text.split("\n");
      lines.slice(1).map(line => {
        let account = line.split(",")[lines[0].split(",").indexOf("Account address")];
        if (account) {
          data[account] = true;
        }
      });
      console.log("syncLocalWithFollowsCsv", data);
      return setStorage({ follows: data }, { local: true });
    });
  }
}

export async function onClicked(tab) {
  let version = await getStorageVersion();
  if (version === versionWhichSignifiesFirstRunIsNeeded()) {
    return onInstalled("onClicked");
  }
  if (await getStorageProperty("OnClickedToggle")) {
    return onUpdated(tab.id, { status: "onClicked", onClicked: true }, tab);
  } else {
    console.log("onClicked", "OnClickedToggle disabled");
  }
}

export async function onUpdated(tabId, changeInfo, tab) {
  // console.log("onUpdated", tabId, changeInfo, tab);
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

    if (await getInstance()) {

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
        let timeBetweenUpdatesForSameUrlAndIsLastUrl = 1000 * 5;

        if (lastUrlData.timestamp > timestamp - timeBetweenUpdatesForSameUrlAndIsLastUrl) {
          console.log("onUpdated", "lastUrl was too new", { lastUrlData, timestamp, timeBetweenUpdatesForSameUrlAndIsLastUrl });
          return;
        }
      }
      let timeBetweenUpdatesForSameUrl = 1000 * 5;

      if (cache.lastUrls.some(lastUrl => lastUrl.url === tab.url && lastUrl.timestamp > timestamp - timeBetweenUpdatesForSameUrl)) {
        console.log("onUpdated", "url was too new", { tab, timestamp, timeBetweenUpdatesForSameUrl, lastUrls: cache.lastUrls });
        return;
      }
    }
    console.log("onUpdated", "passed conditions")

    cache.lastUrls = cache.lastUrls.slice(-9);
    cache.lastUrls.push({ url: tab.url, timestamp });
    cache.lastTabId = tabId;
    cache.lastTabUpdated = timestamp;

    let settings = changeInfo
    console.log("onUpdated", "settings", settings);
    await toggleMastodonTab(tab, settings);

  }
}

chrome.action.onClicked.addListener(onClicked);

chrome.alarms.create("syncCacheWithStorage", {periodInMinutes: 5});
chrome.alarms.create("syncLocalWithFollowsCsv", {periodInMinutes: 5});
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
