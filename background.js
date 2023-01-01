let cache = { counter: 0 };

export async function getCurrentTab() {
  let queryOptions = {
    active: true,
    lastFocusedWindow: true,
    url: [
    ]
  };
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

export function syncCacheWithStorage(keys) {
  chrome.storage.sync.get()
  .then(storage => {
	  Object.assign(cache, storage);
    cache["lastSyncFull"] = new Date();
    cache.counter++;
    return cache;
  });
}

export function updateTab(url) {
  if (url) {
    console.log("updateTab: " + url);
    // chrome.tabs.update({url: url});
  }
}

export function getChromeUrl(path) {
  return chrome.runtime.getURL(path);
}

export function getCurrentVersion() {
  return chrome.runtime.getManifest().version;
}

export function createTab(url) {
  console.log("createTab: " + url);
  chrome.tabs.create({ url: url });
}

export async function getStorage(keys) {
  if (!Array.isArray(keys)) {
    keys = [keys];
  }
  if (keys.every(value => Object.keys(cache).includes(value))) {
    return cache;
  } else {
    return await syncCacheWithStorage();
  }
}

export function getStorageVersion() {
  return getStorage(["version"]
  ).then(result => {
    if (result && result.version) {
      return result.version;
    } else {
      return "0.1.0";
    }
  });
}

export function setCurrentVersion() {
  return setStorageWithProperty("version", getCurrentVersion());
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

export async function getInstance() {
  return makeHttps(
    await getStorage(["Instance"]
    ).then(result => {
      if (result && result.Instance) {
        return result.Instance;
      }
    })
  );
}

export async function search(query, limit = 1) {
  console.log("query: " + query);
  let instance = await getInstance();
  if (!instance || !query) { return; }
  let url = new URL(instance + "api/v2/search");
  url.searchParams.append("q", query);
  url.searchParams.append("resolve", true);
  url.searchParams.append("limit", limit);
  console.log("search: " + url.toString());
  return await fetch(url
    ).then(result => result.json()
    ).then(result => {
      console.log("result: " + JSON.stringify(result));
      return result;
    });
}

export async function setCode() { // TODO:
  // https://hachyderm.io/oauth/authorize?response_type=code&client_id=-cx14PEOeRBwp4CC6rHzcy3QTGC63Z5zY3G33CHEqtk&redirect_uri=urn%3Aietf%3Awg%3Aoauth%3A2.0%3Aoob&scope=write%3Afollows
  // https://hachyderm.io/oauth/authorize/native?code=Ev5GQx8SdH0iMvgqZkKf-4PQG3CkrqSv1uROLwl4wIE
  let code = currentTab.url.split("?");
  if (await getInstance() + "oauth/authorize/native" == codeSplit[0]) {
      let code = codeSplit.split("=")[1];
      setStorageWithProperty("code", code);
  }
}

export async function activeCode() {
  return await getStorage(["code"]).then(result => {
    if (result && result.code) {
      return result.code;
    }
  });
}

export async function follow(id) {
  let url = new URL(
    await getInstance() + "api/v1/accounts/" + id + "/follow"
  );
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + await activeCode(),
    }
  }).then(response => response.json());
}

export function makeMastodonUrl(local, username, remote, status, subpath) {
  let url = [makeHttps(local).slice(0, -1), "@" + username];
  if (remote) {
    url[url.length - 1] += "@" + remote;
  }
  url.push(status);
  url.push(subpath);
  url = url.filter(element => element);
  console.log("makeMastodonUrl: " , JSON.stringify( url));
  return url.join("/");
}

export function changeMastodonUriToUrl(url) {
  if (url.indexOf("/users/") > -1) {
    url = url.replace("/users/", "/@")
  }
  if (url.indexOf("/statuses/") > -1) {
    url = url.replace("/statuses/", "/");
  }
  return url;
}

export function explodeUrlNoHandler(url) {
  return removeUriHandler(url).split("/");
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
    let domainUrl = makeHttps(hostDomain);
    console.log("toggleMastodonUrl", "before:", JSON.stringify({hostDomain, handle, status, subpath, username, remoteDomain, instance, domainUrl, url}));

    let results = await search(url);
    console.log("toggleMastodonUrl", "results: " + JSON.stringify(results));

    let result;
    if (status && results.statuses && Array.isArray(results.statuses) && results.statuses.length > 0) {
      console.log("toggleMastodonUrl", "direct status results.");
      result = results.statuses[0];

    } else if (!status && results.accounts && Array.isArray(results.accounts) && results.accounts.length > 0) {
      console.log("toggleMastodonUrl", "direct account results.");
      result = results.accounts[0];

    } else if (results.accounts && Array.isArray(results.accounts) && results.accounts.length > 0) {
      console.log("toggleMastodonUrl", "indirect account results.");
      result = results.accounts[0];

    } else if (results.statuses && Array.isArray(results.statuses) && results.statuses.length > 0) {
      console.log("toggleMastodonUrl", "indirect status results.");
      result = results.statuses[0];
      // prefer indirect account over indirect status because nuance is hard and easier to get the right account by accident
    }

    if (result) {
      console.log("toggleMastodonUrl", "search result", JSON.stringify(result));
      if (instance == domainUrl) { // local to remote, local to local, remote to remote
        console.log("toggleMastodonUrl: use origin", JSON.stringify(result));
        if (url == result.url) {
          console.log("toggleMastodonUrl: pre-empting local to local", result.url);
        } else {
          return result.url;
        }
      } else {
        let id = status ? result.id : null;
        let domain = remoteDomain ? remoteDomain :  hostDomain;
        let localUrl = makeMastodonUrl(instance, username, domain, id, subpath); // remote to local
        console.log("toggleMastodonUrl: use local", localUrl);

        if (makeHttps(hostDomain) == instance) {
          console.log("toggleMastodonUrl: pre-empting local to local", localUrl);
        }
        return localUrl;
      }
    } else {
      console.log("toggleMastodonUrl: no results");
    }
  }
}

export async function toggleMastodonTab(url) {
  await toggleMastodonUrl(url).then(updateTab)
}

export async function toggleCurrentTab() {
  await getCurrentTab()
  .then(toggleMastodonTab);
}

export async function getAccessToken(code) {
  const storage = await getStorage(["code", "client_id", "client_secret"]);
  const url = new URL(await getInstance() + "oauth/token");
  const formData = new FormData();
  formData.append("grant_type", "authorization_code");
  formData.append("code", code);
  formData.append("client_id", storage.client_id);
  formData.append("client_secret", storage.client_secret);
  formData.append("redirect_uri", getRedirectUri());
  formData.append("scope", getAppPermissions());
  return fetch(url, { method: "POST", body: formData }
  ).then(result => result.json()
  ).then(setStorage).then(result => result.access_token);
}

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
// }

export function onAlarm(alarm) {
  if (alarm.name === "syncCacheWithStorage") {
    syncCacheWithStorage();
  }
}

export async function onClicked(tab) {
  await toggleMastodonTab(tab.url);
}
export async function onInstalled(reason) {
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
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

export function onStorageChanged(changes, namespace) {
  for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
    cache[key] = newValue;
  }
  cache["lastSyncPartial"] = new Date();
};

export function onActivity(tabId, changeInfo, tab) {
  if (tab && tab.url) {
    cache.lastUrl = tab.url;
    cache.lastTabId = tabId;
    cache.lastTabUpdated = new Date();
    toggleMastodonTab(tab.url);
  }
}

chrome.action.setBadgeBackgroundColor({color: 'green'});
chrome.action.setBadgeText({
    text: getTabBadge(tabId),
    tabId: getTabId(),
  });
chrome.action.onClicked.addListener(onActivity);

chrome.alarms.create("syncCacheWithStorage", {periodInMinutes: 15});
chrome.alarms.onAlarm.addListener(onAlarm);
chrome.runtime.onInstalled.addListener(onInstalled);
chrome.storage.onChanged.addListener(onStorageChanged);
chrome.tabs.onUpdated.addListener(onActivity);
chrome.tabs.onUpdated.addListener(on);
syncCacheWithStorage();
