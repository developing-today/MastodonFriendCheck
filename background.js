let cache = { counter: 0 };

export function versionWhichSignifiesFirstRunIsNeeded() {
  return "0.1.0";
}

export function get(object, property, settings) {
  // console.log("get", { object, property, settings });
  let defaultValue = settings ?
    get(settings, "default") : null;

  let resultCond = object &&
      property &&
      object.hasOwnProperty(property) &&
      object[property] !== undefined &&
      object[property] !== null
  let result = resultCond ? object[property] : defaultValue;

  // console.log("get", { resultCond, defaultValue, result });
  return result;
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
    lastFocusedWindow: true
  };
  let [tab] = await chrome.tabs.query(queryOptions);
  console.log("currentTab", tab);
  // if (!tab) {
  // request window location through content script
  // import getcallbacktimestamp from content.js
  // send echorequest, content script for echo response
  // }
  return tab;
}
export function sendResultsToCache(results, settings) {
  let namespace = get(settings, "namespace");
  Object.assign(cache, results);

  if (namespace) {
    let storage = get(cache, namespace, { default: { counter: 0 } });
    Object.assign(storage, results);
    cache[namespace] = storage;
    cache[namespace]["lastSyncFull"] = new Date();
    cache[namespace].counter++;
  }

  if (cache.lastUrls) {
    cache.lastUrls = cache.lastUrls.slice(-3);
  }

  cache["lastSyncPartial"] = new Date();

  return cache;
}

export function syncCacheWithStorage(keys) {

  chrome.storage.sync.get(
      ).then(results=>
        sendResultsToCache(
          results, { namespace: "sync" }));

  chrome.storage.local.get(
      ).then(results=>
        sendResultsToCache(
          results, { namespace: "local" }));


  cache["lastSyncFull"] = new Date();
  cache.counter++;
  console.log("syncCacheWithStorage", cache);

  return cache;
}

export async function getStorage(keys, settings) {
  let keysArray = Array.isArray(keys) ? keys : [keys];

  if (keysArray.every(value =>
        Object.keys(cache).includes(value))) {

    if (get(settings, "strict")) {
      let result = {};
      keysArray.forEach(key => result[key] = cache[key]);
      return result;
    } else {
      return cache;
    }

  } else {
    if (get(settings, "strict")) {
      await syncCacheWithStorage();
      let result = {};
      keysArray.forEach(key => result[key] = cache[key]);
      return result;
    } else {
      return syncCacheWithStorage(); // TODO: perf testing?
    }
  }
}

export async function getStorageProperty(name) {
  if (Array.isArray(name) && name.length > 0) {
    name = name[0];
  }
  let result = await getStorage(name);
  // console.log("getStorageProperty", {name, result});
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
  return getStorageProperty("Version") ||
        versionWhichSignifiesFirstRunIsNeeded();
}

export async function setStorage(object, settings) {
  // TODO:   if(chrome.runtime.lastError) {
  Object.assign(cache, object);
  cache.lastSyncPartial = new Date();
  cache.counter++;
  // console.log("setStorage", cache);

  if (get(settings, "local")) {
    // console.log("setStorage local", object);
    return chrome.storage.local.set(object);
  } else {
    // console.log("setStorage sync", object);
    return chrome.storage.sync.set(object);
  }
}

export async function setStorageWithProperty(
  name, value, settings) {
  let object = {};
  object[name] = value;
  return setStorage(object, settings);
}

export function setCurrentVersion() {
  return setStorageWithProperty(
                "Version",
                getCurrentVersion());
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

export async function getInstance(settings) {
  let storage = await getStorage(["Instance", "InstanceHttps", "InstanceClean"]);
  console.log("getInstance", { settings, storage});

  if (get(settings, "clean")) {
    return storage.InstanceClean;
  } else if (get(settings, "noHttps")) {
    return storage.Instance;
  } else {
    return storage.InstanceHttps;
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
  let instance = await getInstance();
  if (
    instance + getCodeRedirectPath() ==
    codeSplit[0]
  ) {
      createTab(instance);
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

export function makeMastodonUrl(
  local, username, remote, status, subpath
) {
  let url = [
    makeHttps(local).slice(0, -1),
    "@" + username
  ];

  if (remote) {
    url[url.length - 1] += "@" + remote;
  }

  url.push(status);
  url.push(subpath); // TODO: test this
  url = url.filter(element => element);
  console.log("makeMastodonUrl", {url , local, username, remote, status , subpath});

  return mastodonUrlResult(url.join("/"));
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
  let instance = get(settings, "instance") ||
                  await getInstance();

  if (!instance || !id) { return; }

  let url = new URL(instance + "api/v1/statuses/" + id);
  return fetch(url).then(result => result.json());
}

export function mastodonUrlResult(url, pageType, locality) {
  return {
    url: url,
    pageType: pageType ? pageType : "account",
    locality: locality ? locality : null
  };
}

export async function getLocality(url, settings) {
  let explodedUrl = explodeUrlNoHandler(url);
  console.log("getLocality", explodedUrl);
  let handle = explodedUrl[1];
  let doubleRemote = false;

  if (handle) {
    let { username, remoteDomain } = handle.split("@").slice(1);
    if (remoteDomain) {
      doubleRemote = true;
    }
  }
  let instanceClean = get(settings, "instanceClean",
      {default: await getInstance({ clean: true })});
  let urlClean = cleanDomain(url);
  console.log("getLocality", { url, settings, explodedUrl, handle, doubleRemote, instanceClean, urlClean});

  if (doubleRemote) {
    console.log("doubleRemote");
    return "remote-remote";

  } else if (urlClean == instanceClean) {
    console.log("local");
    return "local";

  } else {
    console.log("remote");
    return "remote";
  }
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
  //     - "show original" on remote, follow 2 if possible
  console.log("toggleMastodonUrl", url);
  let urlExploded = explodeUrlNoHandler(
    changeMastodonUriToUrl(url.toString()));
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
          console.log("toggleMastodonUrl", "local to remote", "status");
          let results = await statuses(status);
          console.log(results);
          let statusUrl = get(results, "url");
          return mastodonUrlResult(statusUrl);

        } else {
          console.log("toggleMastodonUrl",
              "local to remote", "account");
          return makeMastodonUrl(remoteDomain, username);
        }

      } else {
        console.log("toggleMastodonUrl", "local to local"); // ???
        // return makeMastodonUrl(
            // instance, username, null, status, subpath);
        return;
      }

    } else {

      if (status) {
        console.log("toggleMastodonUrl", "remote to local", "status");

        let results = await search(url);
        let result;

        if (
          results &&
          results.statuses &&
          Array.isArray(results.statuses) &&
          results.statuses.length > 0
        ) {
          result = results.statuses[0];

          if (result) {
            let domain = remoteDomain ||  hostDomain;
            let localUrl = makeMastodonUrl(
              instance, username, domain, result.id, subpath);
            console.log("toggleMastodonUrl", "use local", localUrl);

            return localUrl;
          } else {
            console.log("toggleMastodonUrl", "no result");
            // TODO: if all-url, try to find status on remote
          }

        } else {
          console.log("toggleMastodonUrl", "no results");
          // TODO: if all-url, try to find status on remote
        }

      } else {
        console.log("toggleMastodonUrl", "remote to local", "account");
        return makeMastodonUrl(instance, username, hostDomain);
      }
    }
  }
}

export async function toggleCurrentTab() {
  return getCurrentTab().then(toggleMastodonTab);
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
  ).then(result => {
    console.log("setToken", result);
    return result;
  }).then(setStorage).then(result => result.access_token);
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

export function getPageType(urlExploded) {
  return urlExploded[2] ? "status" : "account";
}

export async function toggleMastodonTab(tab, settings) {
  cache.lastUrls = cache.lastUrls || [];
  cache.lastUrls.push({urls:[tab.url], timestamp: Date.now()});
  cache.lastUrl = tab.url;

  return toggleMastodonUrl(tab.url).then(async result => {
      if (!result) {
        console.log("toggleMastodonTab: no result");
        return;
      }
      let url = get(result, "url");
      console.log("toggleMastodonUrl", "pending jump", url);

      if (
        url &&
        url != tab.url &&
        url != tab.pendingUrl &&
        (!cache.lastUrl || url != cache.lastUrl) &&
        (
          get(settings, "status") == "onClicked" ||
          cache.lastUrls.slice(-1).filter(u => u.url == url).length == 0
        )
      ) {
        if (
          !get(cache, "lastUrls") ||
          !Array.isArray(cache.lastUrls)
        ) {
          console.log("toggleMastodonTab", "lastUrls was not an array", cache.lastUrls);
          cache.lastUrls = [];
        }

        cache.lastUrls.push({urls:[url, tab.url], timestamp: Date.now()});
        cache.lastUrl = url;

        return sendUrlToTab(url);

      } else {
        console.log("toggleMastodonTab: no jump", { url });
      }
    });
}

export async function onInstalled(reason) {
  console.log("onInstalled", reason);
  if ([
    chrome.runtime.OnInstalledReason.INSTALL,
    "onClicked",
    "onClicked,noInstance"
  ].includes(reason)) {
    console.log("onInstalled", "syncCacheWithStorage");
    await syncCacheWithStorage();
    if (
      await getCurrentVersion() !==
      await getStorageVersion() ||
      reason == "onClicked,noInstance"
    ) {
      if (chrome.runtime.openOptionsPage) {
        console.log("onInstalled", "openOptionsPage");
        chrome.runtime.openOptionsPage();
      } else {
        console.log("onInstalled", "createTab");
        createTab(getChromeUrl("options.html"))
      }
    } else {
      console.log("onInstalled", "no version change");
    }
  }
}

function filterObject(obj, callback) {
  return Object.fromEntries(Object.entries(obj).
    filter(([key, val]) => callback(val, key)));
}

export async function onChanged(changes, namespace) {
  console.log("onChanged", { changes, namespace, cache, storage: await getStorage() });

  if (!cache.follows) {
    await syncLocalWithFollowsCsv();
  }
  await syncCacheWithStorage();
  // todo
  // for (let key in changes) {
  //   let storageChange = changes[key];
  //   cache[key] = storageChange.newValue;

  //   if (!cache[namespace]) {
  //     cache[namespace] = {};
  //   }
  //   cache[namespace][key] = storageChange.newValue;
  // }
  // cache[namespace]["lastSyncPartial"] = new Date();
  // cache["lastSyncPartial"] = new Date();
  console.log("onChanged", { cache });
};

export async function syncLocalWithFollowsCsv() {
  console.log("syncLocalWithFollowsCsv");
  let instance = await getInstance();
  console.log("syncLocalWithFollowsCsv", instance);
  console.log("syncLocalWithFollowsCsv", cache);
  console.log("syncLocalWithFollowsCsv", await getStorage());
  if (instance) {
    console.log("syncLocalWithFollowsCsv", instance);
    return fetch(instance + "settings/exports/follows.csv")
    .then(response => response.text()).then(text => {
      console.log("syncLocalWithFollowsCsv text", text);
      let content = {};
      let lines = text.split("\n");
      lines.slice(1).map(line => {
        let account = line.split(",")[
          lines[0].split(",").indexOf("Account address")];
        if (account) {
          content[account] = true;
        }
      });
      let timestamp = new Date();
      let follows = { timestamp, content };
      console.log("syncLocalWithFollowsCsv content", follows);
      cache.follows = follows;

      return setStorage({ follows }, { local: true });
    });
  } else {
    console.log("syncLocalWithFollowsCsv", "no instance");
  }
}

export async function onClicked(tab) {
  let version = await getStorageVersion();

  let instance = await getInstance({ noHttps: true });
  console.log("onClicked", { version, tab, versionWhichSignifiesFirstRunIsNeeded: versionWhichSignifiesFirstRunIsNeeded(), instance, cache, storage: await getStorage() });

  if (version === versionWhichSignifiesFirstRunIsNeeded()){
    console.log("onClicked", "versionWhichSignifiesFirstRunIsNeeded");
    return onInstalled("onClicked");
  }

  if (!instance) {
    console.log("onClicked", "no instance");
    return onInstalled("onClicked,noInstance");
  }

  if (await getStorageProperty("OnClickedToggle")) {
    return await toggleMastodonTab(tab, {status: "onClicked"});

  } else {
    console.log("onClicked", "OnClickedToggle disabled");
  }
}

export async function onUpdated(tabId, changeInfo, tab) {

  if (["loading", "onUpdated", "onMessage"].includes(changeInfo.status)) {
    console.log("onUpdated", tabId, changeInfo, tab);

    if (!tab) {
      console.log("onUpdated", "no tab");
      return;
    }

    if (!tab.url) {
      console.log("onUpdated", "no tab.url");

      if (tab.pendingUrl) {
        console.log("onUpdated", "tab has pendingUrl", { tabId, changeInfo, tab });
        tab.url = tab.pendingUrl;

      } else if (tab.currentTab) {
        console.log("onUpdated", "tab is currentTab", { tabId, changeInfo, tab });
        return;

      } else {
        console.log("onUpdated", "tab is not populated", { tabId, changeInfo, tab });

        return getCurrentTab().then(result => {
          console.log("onUpdated", "currentTab", { tabId, changeInfo, tab });

          if (result && (result.url || result.pendingUrl)) {
            Object.assign(result, { currentTab: true });
            tab = result;
          } else {
            console.log("onUpdated", "currentTab has no url", { tabId, changeInfo, tab });
            return;
          }
        });
      }
    }

    if (tab.url.indexOf("https://") !== 0 && tab.url.indexOf("http://") !== 0) {
      console.log("onUpdated", "not http(s)", tab.url);
      return;
    }
    console.log("onUpdated", "init", tab.url);

    if (tab.url.indexOf(getCodeRedirectPath()) > -1) {
      console.log("onUpdated", "code redirect", tab.url);
      // TODO: handle code redirect here.
    }

    let timeBetweenUpdates = 800 * 1;
    let timestamp = new Date();

    if (!cache) { cache = {}; }

    if (get(cache, "lastTabUpdated") > timestamp - timeBetweenUpdates) {
      console.log("onUpdated", "lastUpdated too new", { cache: cache.lastTabUpdated, timestamp, timeBetweenUpdates });
      return;
    }
    let instance = await getInstance();
    console.log("onUpdated", "instance", instance);

    if (instance) {

      if (tab.url.indexOf(cache.InstanceHttps) > -1) {
        console.log("onUpdated", "url is local", tab.url);

        if (tab.url.indexOf("@") > -1 && tab.url.split("@").length > 2) {
          console.log("onUpdated", "remote user", tab.url);

          let locality = "local";

          let jumpStatus = await getStorageProperty("AutoJumpOnLoadStatus");
          let statusDropdown = await getStorageProperty("AutoJumpOnLoadStatusDropdown");
          let statusDropdownMatches = jumpStatus && statusDropdown &&
                    (statusDropdown == "first-opened" || locality.startsWith(statusDropdown));

          let jumpAccount = await getStorageProperty("AutoJumpOnLoadAccount");
          let accountDropdown = await getStorageProperty("AutoJumpOnLoadAccountDropdown");
          let accountDropdownMatches = jumpAccount && accountDropdown &&
                    (accountDropdown == "first-opened" || locality.startsWith(accountDropdown));

          let urlExplode = explodeUrlNoHandler(changeMastodonUriToUrl(tab.url));
          let pageType = getPageType(urlExplode);

          console.log("onUpdated", { locality, statusDropdown, accountDropdown, pageType, statusDropdownMatches, accountDropdownMatches });

          if (
            pageType &&
            (
              (
                pageType == "status" && statusDropdownMatches
              ) ||
              (
                pageType == "account" && accountDropdownMatches
              )
            )
          ) {
            console.log("onUpdated", "pageType matches", { pageType, statusDropdownMatches, accountDropdownMatches });

          } else {
            console.log("onUpdated", "pageType does not match", { pageType, statusDropdownMatches, accountDropdownMatches });
            return;
          }
        }

      } else {
        console.log("onUpdated", "url is not local", tab.url);

        let locality = "remote";

        let jumpStatus = await getStorageProperty("AutoJumpOnLoadStatus");
        let statusDropdown = await getStorageProperty("AutoJumpOnLoadStatusDropdown");
        let statusDropdownMatches = jumpStatus && statusDropdown &&
                  (statusDropdown == "first-opened" || locality.startsWith(statusDropdown));

        let jumpAccount = await getStorageProperty("AutoJumpOnLoadAccount");
        let accountDropdown = await getStorageProperty("AutoJumpOnLoadAccountDropdown");
        let accountDropdownMatches = jumpAccount && accountDropdown &&
                  (accountDropdown == "first-opened" || locality.startsWith(accountDropdown));

        let urlExplode = explodeUrlNoHandler(changeMastodonUriToUrl(tab.url));
        let pageType = getPageType(urlExplode);

        console.log("onUpdated", { locality, statusDropdown, accountDropdown, pageType, statusDropdownMatches, accountDropdownMatches });

        if (
          pageType &&
          (
            (
              pageType == "status" && statusDropdownMatches
            ) ||
            (
              pageType == "account" && accountDropdownMatches
            )
          )
        ) {
          console.log("onUpdated", "pageType matches", { pageType, statusDropdownMatches, accountDropdownMatches });

        } else {
          console.log("onUpdated", "pageType does not match", { pageType, statusDropdownMatches, accountDropdownMatches });
          return;
        }
      }

      if (!get(cache, "lastUrls") || !Array.isArray(cache.lastUrls)) {
        console.log("onUpdated", "lastUrls was not an array", cache.lastUrls);
        cache.lastUrls = [];
      }

      if (cache.lastUrls.length > 0) {

        if (tab.url == cache.lastUrl) {
          console.log("onUpdated", "lastUrl was same", { lastUrl: cache.lastUrl, tabUrl: tab.url });
          return;
        }

        let lastUrlData = cache.lastUrls[cache.lastUrls.length - 1];

        if (lastUrlData.urls.some(url => url === tab.url)) {
          let timeBetweenUpdatesForSameUrlAndIsLastUrl = 1000 * 5;

          if (lastUrlData.timestamp > timestamp - timeBetweenUpdatesForSameUrlAndIsLastUrl) {
            console.log("onUpdated", "lastUrl was too new", { lastUrlData, timestamp, timeBetweenUpdatesForSameUrlAndIsLastUrl });
            return;
          }
        }
        let timeBetweenUpdatesForSameUrl = 1000 * 2;

        if (
            cache.lastUrls.some(lastUrl =>
              lastUrl.urls.some(url =>
                  url === tab.url &&
            url.timestamp > timestamp - timeBetweenUpdatesForSameUrl))
          ) {
          console.log("onUpdated", "url was too new", { tab, timestamp, timeBetweenUpdatesForSameUrl, lastUrls: cache.lastUrls });
          return;
        }
      }
      console.log("onUpdated", "passed conditions")

      cache.lastUrls = cache.lastUrls.slice(-9);
      cache.lastUrls.push({ urls: [tab.url], timestamp });
      cache.lastTabId = tabId;
      cache.lastTabUpdated = timestamp;

      let settings = changeInfo
      console.log("onUpdated", "settings", settings);

      return toggleMastodonTab(tab, settings);

    }
  }
}

async function syncContextMenus() {
  await chrome.contextMenus.removeAll();
  await chrome.contextMenus.create({
    "id": "context",
    "title": "Toggle Mastodon Page 🐘 Jump Now",
    "documentUrlPatterns": [
      "*://*/@*",
      "*://*/users/*",
      "*://*/web/statuses/*"
    ]
  });
}

async function checkFollows(url, settings) {
  let keys = ["InstanceHttps", "InstanceClean", "follows"];
  let result = await getStorage(keys);
  console.log("content.js", "checkFollows", result.InstanceHttps, result);

  if (url && result && keys.every((key) => key in result)) {
    url = new URL(url);

    if (url.hostname == result.InstanceClean) {
      console.log("content.js", "on instance page");

    } else {
      console.log("content.js", "not on instance page");
      let instance = url.hostname.replace(url.protocol + "//", "");
      let path = url.pathname.split("/").filter((item) => item !== "");
      console.log("content.js", "url", url, instance, path);

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
      console.log("content.js", "handle", {handle, instance, result, cache});

      if (account in result.follows.content) {
        console.log("content.js", "account in follows", account);
        return result.InstanceHttps + "@" + account;
      } else {
        console.log("content.js", "account not in follows", account, result.follows);

        if (Date.now() - result.follows.timestamp > 1000 * 60) {
          console.log("content.js", "follows is too old", result.follows.timestamp);
          await syncLocalWithFollowsCsv();
          if (account in result.follows.content) {
            console.log("content.js", "account in follows now", account);
            return result.InstanceHttps + "@" + account;
          }
        }
      }
    }
  } else if (!get(settings, "noSync")) {
    console.log("content.js", "invalid", { result, keys, url });
    await syncLocalWithFollowsCsv();
    checkFollows(url, { noSync: true });
  }
}

export async function sendMessage(tabId, response, settings) {

  if (get(settings, "type")) {
    console.log("sendMessage", "type", get(settings, "type"), response);
    Object.assign(response, { type: get(settings, "type") });
  }

  if (get(settings, "content")) {
    console.log("sendMessage", "content", get(settings, "content"), response);
    Object.assign(response, { content: get(settings, "content") });
  }

  if (!get(response, "timestamp")) {
    Object.assign(response, { timestamp: Date.now() });
  }

  if (!get(response, "content")) {
    let copy = {};
    Object.assign(copy, response);
    Object.assign(response, { content: copy });
  }

  console.log("sendMessage", { tabId, response, settings });
  return chrome.tabs.sendMessage(tabId, response);
}

export async function onMessage(message, sender, sendResponse) {
  if (Array.isArray(message)) {
    return Promise.allSettled(message.map(m => onMessage(m, sender, sendResponse)));
  }

  let response = {};

  if (message.timestamp) {

    if (message.group) {
      Object.assign(response, { group: message.group, timestamp: message.timestamp });

    } else {
      Object.assign(response, { timestamp: message.timestamp });
    }
  }

  if (message.type) {
    Object.assign(response, { type: message.type });
  }

  Object.assign(response, { content: {}, parent: { message: {}, sender: {}, sendResponse: {} } });
  Object.assign(response.content, message);
  Object.assign(response.parent.message, message);
  Object.assign(response.parent.sender, sender);
  Object.assign(response.parent.sendResponse, sendResponse);

  console.log("onMessage", message, sender, sendResponse, response);

  if (message.type == "getStorage") {
    Object.assign(response.content, await getStorage(message.content.keys, { strict: true }));
    sendMessage(sender.tab.id, response);

  } else if (message.type == "setStorage") {
    await setStorage(message);

  } else if (message.type == "onLoad") {
    console.log("onMessage", "onLoad", message, sender, sendResponse, response);

    let url = await checkFollows(sender.tab.url);

    if (url) {
      console.log("onMessage", "onLoad", "following", url);
      sendMessage(sender.tab.id, response, { type: "following", content: { url } });
    }

    onUpdated(sender.tab.id, { status: "onMessage", onMessage: true, response }, sender.tab);

  } else if (message.type == "echoRequest") {
    sendMessage(sender.tab.id, response, { type: "echoResponse" });
  } else if (message.type == "syncLocalWithFollowsCsv") {
    syncLocalWithFollowsCsv();
  } else {
    console.log("onMessage", "Unknown message type", message.type, message);
  }
  return Promise.resolve();
}

export function onAlarm(alarm) {
  console.log("onAlarm", alarm);
  if (alarm.name === "syncCacheWithStorage") {
    syncCacheWithStorage();
  } else if (alarm.name === "syncLocalWithFollowsCsv") {
    syncLocalWithFollowsCsv();
  }
}

chrome.action.onClicked.addListener(onClicked);

chrome.alarms.create("syncCacheWithStorage", {periodInMinutes: 5});
chrome.alarms.create("syncLocalWithFollowsCsv", {periodInMinutes: 1});
chrome.alarms.onAlarm.addListener(onAlarm);

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log("contextMenus.onClicked", info, tab);
  if (info.menuItemId == "context") {
    await onClicked(tab);
  }
});

chrome.runtime.onInstalled.addListener(onInstalled);
chrome.runtime.onMessage.addListener(onMessage);

chrome.storage.onChanged.addListener(onChanged);

chrome.tabs.onUpdated.addListener(onUpdated);

console.log("background.js", "loaded");

(() => (async () => {
    console.log("background.js", "syncing.");
    await syncContextMenus();
    console.log("background.js", "synced context menus");
    await syncLocalWithFollowsCsv();
    console.log("background.js", "synced local with follows csv");
    await syncCacheWithStorage();
    console.log("background.js", "synced cache with storage");
  })())();

console.log("background.js", "done");
