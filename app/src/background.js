let cache = { counter: 0 };

export function versionWhichSignifiesFirstRunIsNeeded() {
  return "0.1.0";
}

export function get(object, property, settings) {
  // console.log("get", { object, property, settings });
  let defaultValue = settings ? get(settings, "default") : null;

  let resultCondition = object &&
      property &&
      typeof object === "object" &&
      property in object &&
      object[property] !== undefined &&
      object[property] !== null
  let result = resultCondition ? object[property] : defaultValue;

  // console.log("get", { resultCondition, defaultValue, result });
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
  // import getcallbacktimestamp from checkFollows
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
    // cache[namespace].counter++;
  }

  if (cache.lastUrls) {
    cache.lastUrls = cache.lastUrls.slice(-9);
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
  // cache.counter++;
  // console.log("syncCacheWithStorage", cache);

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

export function newTab(url, settings) {
  console.log("newTab:", { url });
  chrome.tabs.create({ url: url });
}

export function updateTab(url, settings) {
  console.log("updateTab: ", {url, settings});
  let tabId = get(settings, "tabId");
  //  || (get(settings, "tab").id || null;
  if (!tabId) {
    let tab = get(settings, "tab");
    if (tab) {
      tabId = tab.id;
    }
  }
  if (!tabId) {
    tabId = null;
  }
  chrome.tabs.update(tabId, { url });
  console.log("updateTab: ", {tabId, url});
}

export async function sendUrlToTab(url, settings) {
  console.log("sendUrlToTab", {url, settings});
  if (url) {
    if (
      get(
        settings,
        "OpenInNewTab",
        { default: await getStorageProperty("OpenInNewTab") }
      )
    ) {
      newTab(url, settings);
    } else {
      updateTab(url, settings);
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
  // cache.counter++;
  console.log("setStorage", cache);

  if (get(settings, "local")) {
    console.log("setStorage local", object);
    let result = await chrome.storage.local.set(object);
    console.log("setStorage local result", result);
    return object;
  } else {
    console.log("setStorage sync", object);
    let result = await chrome.storage.sync.set(object);
    console.log("setStorage sync result", result);
    return object;
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
  let instance = get(settings, "instance") ||
                  await getInstance();
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

export async function setCode(url, settings) { // TODO:
  // https://hachyderm.io/oauth/authorize/native?code=6Z4BHNsk-ltNXBoMzlL_D28xYNE35ElYeXKTncATnbw
  let codeSplit = url.split("?");
  let instance = await getInstance();

  console.log("setCode", {url, codeSplit, instance, settings});
  if (
    instance + getCodeRedirectPath() ==
    codeSplit[0]
  ) {
    console.log("setCode", "match", {url, codeSplit, instance, settings});
    updateTab(instance, settings);
    let code = codeSplit[1].split("=")[1];
    console.log("setCode", "match", {code});
    await setStorageWithProperty("code", code);
    return code;
  } else {
    console.log("setCode", "no match", {url, codeSplit, instance, settings});
    return;
  }
}

export async function getCode() {
  return getStorageProperty("code").then(result => {
    if (result) {
      return result;
    }
  });
}

export function mastodonUrlResult(url, settings) {
  let result = { url, settings: {} };
  if
   (settings) {
    Object.assign(result.settings, settings);
    delete settings.url;
    Object.assign(result, settings);
  }

  if (!result.pageType) {
    result.pageType = "account";
  }
  return result;
}

export function makeMastodonUrl(
  local, username, remote, status, subpath, settings
) {
  // TODO: clean local url, determine difference between built and url-host
  // "@paeneultima@thedreaming.city"
  // {instance: 'thedreaming.city', id: '109660728945403082', type: 'built'}
  // {instance: 'thedreaming.city', id: '109660728919305576', type: 'url-host'}
  // {instance: 'https://hachyderm.io/', id: '109660728945403082', type: 'local'
  // determine why this one cant be found what do then https://thedreaming.city/@paeneultima/109733736814167269
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
  console.log("makeMastodonUrl", {url , local, username, remote, status , subpath, settings});

  let result = {
    accounts: [ { instance: (remote || local), username, type: "built", type: "built" } ],
    statuses: !status ? [] : [ { instance: (remote || local), id: status, type: "built" } ],
  };
  console.log("makeMastodonUrl", "result", { result, settings, url });

  if (settings) {
    console.log("makeMastodonUrl", "settings", { result, settings, url });

    if (settings.accounts) {
      console.log("makeMastodonUrl", "settings.accounts", { result, settings, url });

      if (Array.isArray(settings.accounts)) {
        // console.log("makeMastodonUrl", "settings.accounts.isArray", { result, settings, url });
        settings.accounts.forEach(account => {
          // console.log("makeMastodonUrl", "settings.accounts.forEach", { result, settings, url });
          result.accounts.push(account);
          // console.log("makeMastodonUrl", "settings.accounts.forEach result", { result, settings, url });
        });

      } else {
        // console.log("makeMastodonUrl", "settings.accounts.push", { result, settings, url });
        result.accounts.push(settings.accounts);
        console.log("makeMastodonUrl", "settings.accounts.push result", { result, settings, url });
      }
      delete settings.accounts;
    }

    if (settings.statuses) {
      console.log("makeMastodonUrl", "settings.statuses", { result, settings, url });

      if (Array.isArray(settings.statuses)) {
        settings.statuses.forEach(status => {
          result.statuses.push(status);
        });
        console.log("makeMastodonUrl", "settings.statuses isArray result", { result, settings, url });
      } else {
        result.statuses.push(settings.statuses);
      }
      console.log("makeMastodonUrl", "settings.statuses result", { result, settings, url });
      delete settings.statuses;
    }
    console.log("makeMastodonUrl", "settings result", { result, settings, url });

    Object.assign(result, settings);
    console.log("makeMastodonUrl", "settings Object.assign result", { result, settings, url });
  }
  console.log("makeMastodonUrl", "result", { result, settings, url });

  return mastodonUrlResult(url.join("/"), result);
}

export function changeMastodonUriToUrl(url) {
  // todo something something webfinger
  // todo something something pleroma '/notices/<id>'
  //      will need to be able to handle id without handle, probably okay with search
  // # TODO classifyMastodonUrl
  //         // "*://*/@*",
  //         // "*://*/users/*",
  //         // "*://*/notices/*",
  //         // "*://*/notes/*",
  //         // "*://*/i/web/post/*",
  //         // "*://*/i/web/profile/*",
  //         // "*://*/web/statuses/*"

  // explode url into parts
  // compare parts to known instance types

  // mastodon where status is a number
  //   /@<user> or /@<user>/<status>
  //   /users/<user> or /users/<user>/statuses/<status>
  //   /web/accounts/<user> or /web/accounts/<user>/statuses/<status>

  // pleroma where status is a string
  //   /@<user> or /notices/<status>

  // misskey where status is a string
  //   /notes/<status>

  // don't actually define 'this is from here' or whatever,
  // that specific stuff probably can't be known just from url

  // just define 'if it has /users/' get <user> from the next part
  // if /i/web/profile/ get <user> from the next part
  // if /i/web/post/ get <status> from the next part

  // then return what was found and done
  // and let the caller decide what to do with it

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

export async function getLocality(url, settings) {
  let explodedUrl = explodeUrlNoHandler(url);
  console.log("getLocality", explodedUrl);
  let handle = explodedUrl[1];
  // TODO: handle double remote in the options and autoRedirect.
  // can either go to local or remote when double remote.
  // right now, onClicked goes to local on first click,
  // then remote on second click. which aligns with the usual pattern.
  let doubleRemote = false;

  if (handle) {
    let { username, remoteDomain } = handle.split("@").slice(1);
    if (remoteDomain) {
      doubleRemote = true;
    } // bugged?
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
export async function getWebfinger(instance, username) {
  // "https://" + server + "/.well-known/webfinger?resource=acct:" + user + "@" + server
  // {
  //   "subject": "acct:UserName@developing.today",
  //   "aliases": [
  //     "https://example.developing.today/@UserName",
  //     "https://example.developing.today/users/UserName"
  //   ],
  //   "links": [
  //     {
  //       "rel": "http://webfinger.net/rel/profile-page",
  //       "type": "text/html",
  //       "href": "https://example.developing.today/@UserName"
  //     },
  //     {
  //       "rel": "self",
  //       "type": "application/activity+json",
  //       "href": "https://example.developing.today/users/UserName"
  //     },
  //     {
  //       "rel": "http://ostatus.org/schema/1.0/subscribe",
  //       "template": "https://example.developing.today/authorize_interaction?uri={uri}"
  //     }
  //   ]
  // }

  let webfingerUrl = new URL(
    "https://" + instance + "/.well-known/webfinger");
  webfingerUrl.searchParams.set("resource", "acct:" + username + "@" + instance);

  let webfinger = await fetch(webfingerUrl).then(result => {
    console.log("getWebfinger", { webfingerUrl, result });
    return result.json();
  });
  console.log("getWebfinger", { webfingerUrl, webfinger });
  return webfinger;
}

export function getProfileFromWebfinger(webfinger) {
  console.log("getWebfingerProfile", { webfinger });

  let profileUrls = get(webfinger, "links");
  console.log("getWebfingerProfile", { webfinger, profileUrls });

  if (!profileUrls) {
    return null;
  }

  profileUrls = profileUrls.filter(link =>
      link.rel  == "http://webfinger.net/rel/profile-page" &&
      link.type == "text/html"
    ).map(link => link.href);
  console.log("getWebfingerProfile", { webfinger, profileUrls });
  let profileUrl = profileUrls.length > 0 ? profileUrls[0] : null;
  console.log("getWebfingerProfile", { webfinger, profileUrls, profileUrl });

  return profileUrl;
}

export async function getWebfingerProfile(instance, username) {
  let webfinger = await getWebfinger(instance, username);
  console.log("getWebfingerProfile", { webfinger });
  return getProfileFromWebfinger(webfinger);
}

export function getAccountFromWebfinger(webfinger) {
  let subject = get(webfinger, "subject");

  if (!subject) {
    return null;

  } else {
    return subject.split(":")[1];
  }
}

export async function getWebfingerAccount(instance, username) {
  let webfinger = await getWebfinger(instance, username);
  console.log("getWebfingerAccount", { webfinger });

  let account = getAccountFromWebfinger(webfinger).split("@");

  if (account.length == 1) {
    account = [account[0], instance];
  }

  return account.join("@");
}

export async function toggleMastodonUrl(url, settings) {
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
  let urlExploded = explodeUrlNoHandler(changeMastodonUriToUrl(url.toString()));
  let [hostDomain, handle, id] = urlExploded;
  let subpath = urlExploded.slice(3).join("/");
  if (!settings) {
    settings = { accounts: [], statuses: [] };
  }
  if (!settings.accounts) {
    settings.accounts = [];
  }
  if (!settings.statuses) {
    settings.statuses = [];
  }

  console.log("toggleMastodonUrl", "explodeUrl", { hostDomain, handle, id, subpath, settings });

  if (handle && handle[0] == "@") {
    let [username, remoteDomain] = handle.split("@").slice(1);
    let instance = await getInstance();
    let hostDomainUrl = makeHttps(hostDomain);
    console.log("toggleMastodonUrl", "domain comparison", { username, remoteDomain, instance, hostDomainUrl });

    // if (get(settings, "locality") == "remote-remote") {
    //   console.log("toggleMastodonUrl", "remote-remote");
    //   let profileUrl = await getWebfingerProfile(remoteDomain, username);
    //   let [ profileUsername, profileDomain ] = profileUrl.split("/").slice(-1)[0].split("@");
    //   let accountsArray = [
    //     { instance: remoteDomain, username, type: "remote" },
    //     { instance: hostDomain, handle, type: "remote-remote" },
    //     { instance: profileDomain, username: profileUsername, type: "webfinger-profile" }
    //   ];

    //   if (settings.accounts && !Array.isArray(settings.accounts)) {
    //     settings.accounts = [settings.accounts];

    //   } else if (!settings.accounts) {
    //     settings.accounts = [];
    //   }

    //   settings.accounts = settings.accounts.concat(accountsArray);

    //   if (id) {
    //     let searchResults = await search(url);

    //     if (searchResults && searchResults.statuses && searchResults.statuses.length > 0) {
    //       console.log("toggleMastodonUrl", "remote-remote", "status", { url, searchResults });
    //       let searchResultId = searchResults.statuses[0].id;

    //       let statusResult = await statuses(searchResultId);
    //       console.log("toggleMastodonUrl", "remote-remote", "status", { url, statusResult, searchResults });

    //       let statusUrl = await get(statusResult, "url");
    //       console.log("toggleMastodonUrl", "remote-remote", "status", { url, statusUrl, statusResult, searchResults });

    //       if (statusUrl) {
    //         console.log("toggleMastodonUrl", "remote-remote", "status", "redirect", { url, statusUrl, statusResult, searchResults });

    //         return statusUrl;

    //       } else {
    //         console.log("toggleMastodonUrl", "remote-remote", "status", "no statusUrl", { url, statusUrl, statusResult, searchResults });
    //       }
    //     } else {
    //       console.log("toggleMastodonUrl", "remote-remote", "no status", { url });
    //     }
    //   }
    // }

    if (hostDomainUrl == instance) {

      if (remoteDomain && remoteDomain != instance) {

        let profileUrl = await getWebfingerProfile(remoteDomain, username);
        let [ profileUsername, profileDomain ] = profileUrl.split("/").slice(-1)[0].split("@");
        let accountsArray = [
          { instance: remoteDomain, username: username , type: "remote" },
          { instance: profileDomain, username: profileUsername, type: "webfinger-profile" }
        ];

        if (settings.accounts && !Array.isArray(settings.accounts)) {
          settings.accounts = [settings.accounts];

        } else if (!settings.accounts) {
          settings.accounts = [];
        }
        settings.accounts = settings.accounts.concat(accountsArray);

        if (id) {
          console.log("toggleMastodonUrl", "local to remote", "status");
          let results = await statuses(id);
          console.log("toggleMastodonUrl", "local to remote", "status", "results", { results });
          let statusUrl = get(results, "url");

          if (!statusUrl) {
            return;
          }
          let statusUrlObject = new URL(statusUrl);
          let statusesArray = [
            { instance, id, type: "local" },
            { instance: statusUrlObject.host, id: statusUrl.trim("/").split("/").slice(-1)[0], type: "local.rest.status" }
          ];
          settings.statuses = statusesArray;
          console.log("toggleMastodonUrl", "local to remote", "status", "result", { statusUrl, statusesArray, settings });

          if (subpath) {
            statusUrl += "/" + subpath;
          }
          console.log("toggleMastodonUrl", "local to remote", "status", "url", { statusUrl, settings });
          return mastodonUrlResult(statusUrl, settings);

        } else {
          console.log("toggleMastodonUrl", "local to remote", "account", { profileUrl, settings });
          return mastodonUrlResult(profileUrl, settings);
        }

      } else {
        console.log("toggleMastodonUrl", "local to local"); // ???
        // return makeMastodonUrl(
            // instance, username, null, status, subpath);
        return;
      }

    } else {
      console.log("toggleMastodonUrl", "remote to local");

      let domain = remoteDomain || hostDomain;
      let webfinger = await getWebfinger(domain, username);
      console.log("toggleMastodonUrl", { webfinger, domain, username, settings });

      let profileUrl = getProfileFromWebfinger(webfinger);
      let profileUsername = profileUrl.split("/").slice(-1)[0].split("@")[0];
      let profileDomain = new URL(profileUrl).host;
      console.log("toggleMastodonUrl", "profile", { profileUrl, profileUsername, profileDomain });

      let webAccount = getAccountFromWebfinger(webfinger).split("@");
      console.log("toggleMastodonUrl", "webAccount", { webAccount });

      if (webAccount.length == 1) {
        webAccount = [webAccount[0], domain];
      }

      let [webUsername, webDomain] = webAccount
      console.log("toggleMastodonUrl", { webAccount, webUsername, webDomain, settings });

      settings.accounts.push(
        { instance: domain, username, type: "url" },
        { instance: webDomain, username: webUsername, type: "webfinger-account" }
      );
      console.log("toggleMastodonUrl", "accounts", { profileUrl, profileUsername, profileDomain, webAccount, webUsername, webDomain, settings });

      if (id) {
        console.log("toggleMastodonUrl", "remote to local", "status", { id, subpath, settings });

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
            console.log("toggleMastodonUrl", "remote to local", "status", "result", { result, settings });
            settings.statuses.push(
              { instance: hostDomain, id, type: "url-host" },
              { instance: instance, id: result.id, type: "local" }
              );
              console.log("toggleMastodonUrl", "statuses", { result, settings });

            // todo: probably a bug related to
            // webfinger and activitypub here
            let localUrl = makeMastodonUrl(
              instance, username, domain, result.id, subpath, settings);
            console.log("toggleMastodonUrl", "use local", { localUrl, settings });
            return localUrl;
          } else {
            console.log("toggleMastodonUrl", "no result", { result, results });
            // TODO: if all-url, try to find status on remote
          }

        } else {
          console.log("toggleMastodonUrl", "no results", { results });
          // TODO: if all-url, try to find status on remote
        }
      } else {
        console.log("toggleMastodonUrl", "remote to local", "account");
        // TODO webfinger
        let localUrl = makeMastodonUrl(
          instance, webUsername || username, webDomain || domain, null, subpath, settings);
        console.log("toggleMastodonUrl", "use local", { localUrl, settings });

        return localUrl;
      }
    }
  }
}

export async function toggleCurrentTab() {
  return getCurrentTab().then(toggleMastodonTab);
}

export async function getToken() {
  let result = await getStorage("access_token");

  if (result && result.access_token) {
    return result.access_token;
  } else {
    return null;
  }
}

export async function setToken(settings) {
  let url = new URL(get(settings, "url", { default: await getInstance() + "oauth/token" }));
  let code = get(settings, "code", { default: await getCode() });
  let client_id = get(settings, "client_id", { default: await getStorageProperty("client_id") });
  let client_secret = get(settings, "client_secret", { default: await getStorageProperty("client_secret") });
  let redirect_uri = get(settings, "redirect_uri", { default: getRedirectUri() });
  let scope = get(settings, "scope", { default: getAppPermissions() });

  let formData = new FormData();
  formData.append("grant_type", "authorization_code");
  formData.append("code", code);
  formData.append("client_id", client_id);
  formData.append("client_secret", client_secret);
  formData.append("redirect_uri", redirect_uri);
  formData.append("scope", scope);

  console.log("setToken", { url, code, client_id, client_secret, redirect_uri, scope });

  let result = await fetch(url, { method: "POST", body: formData }
  ).then(result => result.json()
  ).then(result => {
    console.log("setToken", result);
    return result;
  }).then(setStorage
  ).then(result => result.access_token);

  console.log("setToken", "result", result);

  return result;
}

export async function verify(settings) {
  let url = new URL(get(settings, "url", { default: await getInstance() + "api/v1/apps/verify_credentials" }));
  let token = get(settings, "token", { default: await getToken() });

  console.log("verify", { url, token });

  let result = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: "Bearer " + token
    }
  }).then(response => response.json());

  console.log("verify", "result", result, { url, token });

  return result;
}

export async function follow(id) {
  let url = new URL(
    await getInstance() + "api/v1/accounts/" + id + "/follow"
  );

  let token = await getToken();
  console.log("follow", { id, url, token });

  let result = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token
    }
  }).then(response => response.json());
  console.log("follow", "result", result, { id, url, token });

  return result;
}

export async function toggleMastodonTab(tab, settings) {
  cache.lastUrls = cache.lastUrls || [];
  cache.lastUrls.push({urls:[tab.url], timestamp: Date.now()});
  cache.lastUrl = tab.url;

  return toggleMastodonUrl(tab.url, settings).then(async result => {
      if (!result) {
        console.log("toggleMastodonTab", "no result");
        return;
      }

      if (get(settings, "locality") == "remote-remote") {
        console.log("toggleMastodonTab", "double remote", { result, tab, settings });
        result = await toggleMastodonUrl(result.url, settings);
        console.log("toggleMastodonTab", "double remote result", { result, tab, settings });
      }

      if (!result) {
        console.log("toggleMastodonTab", "no result");
        return;
      }

      settings = settings || {};
      Object.assign(settings, { tabId: tab.id, tab });

      if (result.settings) {
        Object.assign(settings, result.settings);
      }

      let url = get(result, "url");
      let status = get(settings, "status");
      console.log("toggleMastodonUrl", "pending jump", url);

      if (
        url &&
        url != tab.url &&
        url != tab.pendingUrl &&
        (!cache.lastUrl || url != cache.lastUrl) &&
        (
          (status && status.startsWith("onClicked")) ||
          (
            cache.lastUrls.length < 2 ||
            cache.lastUrls.slice(-2,-1)[0].urls.filter(u => u.url == url).length == 0
          )
        )
      ) {
        console.log("toggleMastodonTab", "jump", { url, settings });

        if (
          !get(cache, "lastUrls") ||
          !Array.isArray(cache.lastUrls)
        ) {
          console.log("toggleMastodonTab", "lastUrls was not an array", cache.lastUrls);
          cache.lastUrls = [];
        }

        let accounts = get(result, "accounts") || [];
        let statuses = get(result, "statuses") || [];

        cache.lastUrls.push({urls:[url, tab.url], accounts, statuses, timestamp: Date.now()});
        cache.lastUrl = url;

        console.log("toggleMastodonTab", "jump", { url, settings, cache, accounts, statuses });

        return sendUrlToTab(url, settings);

      } else {
        console.log("toggleMastodonTab: no jump", { url, settings });
        console.log("toggleMastodonTab", "jump conditions", {
          url,
          tabUrl: tab.url,
          pendingUrl: tab.pendingUrl,
          lastUrl: cache.lastUrl,
          lastUrls: cache.lastUrls,
          status: status,
          statusStartsWith: status && status.startsWith("onClicked"),
          lastUrlsLength: cache.lastUrls.length,
          lastUrlsLast: cache.lastUrls.slice(-2,-1)[0],
          lastUrlsLastUrls: cache.lastUrls.slice(-2,-1)[0].urls,
          lastUrlsLastUrlsFilter: cache.lastUrls.slice(-2,-1)[0].urls.filter(u => u.url == url),
          lastUrlsLastUrlsFilterLength: cache.lastUrls.slice(-2,-1)[0].urls.filter(u => u.url == url).length,
        });
      }
    });
}

function isString(x) {
  return Object.prototype.toString.call(x) === "[object String]"
}

export async function onInstalled(installInfo) {
  if (isString(installInfo)) {
    console.log("onInstalled", "installInfo was a string", {installInfo});
    installInfo = { reason: installInfo };
  }
  console.log("onInstalled", { installInfo });

  if (![
    chrome.runtime.OnInstalledReason.BROWSER_UPDATE,
    chrome.runtime.OnInstalledReason.CHROME_UPDATE,
    "chrome_update",
    "browser_update"
  ].includes(installInfo.reason)) {
    console.log("onInstalled", "syncCacheWithStorage", { installInfo });
    await syncCacheWithStorage();

    let storageVersion = await getStorageVersion();

    if (!storageVersion) {
      console.log("onInstalled", "setStorageVersion", { installInfo });
      storageVersion = versionWhichSignifiesFirstRunIsNeeded();
    }
    let storageMajorVersion = storageVersion.split(".")[0];
    let currentMajorVersion = getCurrentVersion().split(".")[0];
    console.log("onInstalled", "storageVersion", { storageVersion, installInfo, currentMajorVersion, storageMajorVersion });

    if (
      !storageVersion ||
      parseInt(currentMajorVersion, 10) > parseInt(storageMajorVersion, 10) ||
      installInfo.reason == "onClicked,noInstance"
    ) {
      console.log("onInstalled", "openOptions", { installInfo, reason: installInfo.reason });

      if (chrome.runtime.openOptionsPage) {
        console.log("onInstalled", "openOptionsPage");
        chrome.runtime.openOptionsPage();

      } else {
        console.log("onInstalled", "newTab");
        newTab(getChromeUrl("options.html"))
      }

    } else {
      console.log("onInstalled", "no major version change");
    }

  } else {
    console.log("onInstalled", "no action", { installInfo, reason: installInfo.reason });
  }
}

function filterObject(obj, callback) {
  return Object.fromEntries(Object.entries(obj).
    filter(([key, val]) => callback(val, key)));
}

export async function syncLocalWithFollowsCsv() {
  console.log("syncLocalWithFollowsCsv");

  let instance = await getInstance();
  console.log("syncLocalWithFollowsCsv", instance);
  // console.log("syncLocalWithFollowsCsv", cache);
  // console.log("syncLocalWithFollowsCsv", await getStorage());

  if (instance) {
    // console.log("syncLocalWithFollowsCsv", instance);

    return fetch(instance + "settings/exports/follows.csv")
    .then(response => response.text()).then(text => {
      // console.log("syncLocalWithFollowsCsv text", text);
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
      // console.log("syncLocalWithFollowsCsv content", follows);
      cache.follows = follows;

      return setStorage({ follows }, { local: true });
    });
  } else {
    console.log("syncLocalWithFollowsCsv", "no instance");
  }
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

export async function onClicked(tab) {
  let version = await getStorageVersion();

  let instance = await getInstance({ noHttps: true });
  console.log("onClicked", { version, tab, versionWhichSignifiesFirstRunIsNeeded: versionWhichSignifiesFirstRunIsNeeded(), instance, cache, storage: await getStorage() });

  if (version === versionWhichSignifiesFirstRunIsNeeded()){
    console.log("onClicked", "versionWhichSignifiesFirstRunIsNeeded");
    return onInstalled({ reason: "onClicked" });
  }

  if (!instance) {
    console.log("onClicked", "no instance");
    return onInstalled({ reason: "onClicked,noInstance" });
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
            return onUpdated(tabId, changeInfo, result);

          } else {
            console.log("onUpdated", "currentTab has no url", { tabId, changeInfo, tab });
            return;
          }
        });
      }
    }

    if (!tab.url) {
      console.log("onUpdated", "no tab.url");
      return;
    }

    if (tab.url.indexOf("https://") !== 0 && tab.url.indexOf("http://") !== 0) {
      console.log("onUpdated", "not http(s)", tab.url);
      return;
    }

    if (tab.url.indexOf("chrome://") === 0) {
      console.log("onUpdated", "chrome://", tab.url);
      return;
    }

    if (tab.url.indexOf(getCodeRedirectPath()) > -1) {
      console.log("onUpdated", "code redirect", tab.url);
      let code = await setCode(tab.url, { tabId,changeInfo, tab });
      let token = await setToken({code, tabId,changeInfo, tab });
      let verifyResults = await verify({token, tabId,changeInfo, tab });
      console.log("onUpdated", "code redirect", { code, token, verify });
      return;
    }

    if (tab.url.indexOf("@") === -1) {
      console.log("onUpdated", "no @", tab.url);
      return;
    }

    console.log("onUpdated", "init", tab.url);

    let timeBetweenUpdates = 1200 * 1;
    let timestamp = new Date();

    if (!cache) { cache = {}; }

    if (get(cache, "lastTabUpdated") > timestamp - timeBetweenUpdates) {
      console.log("onUpdated", "lastUpdated too new", { cache: cache.lastTabUpdated, timestamp, timeBetweenUpdates });
      return;
    }
    let instance = await getInstance();
    let locality = null;
    let pageDetails = null;

    console.log("onUpdated", "instance", instance);

    if (instance) {

      if (tab.url.indexOf(instance) > -1) {
        console.log("onUpdated", "url is local", tab.url);

        if (tab.url.indexOf("@") > -1 && tab.url.split("@").length > 2) {
          console.log("onUpdated", "remote user", tab.url);

          locality = "local";

          let jumpStatus = await getStorageProperty("AutoJumpOnLoadStatus");
          let statusDropdown = await getStorageProperty("AutoJumpOnLoadStatusDropdown");
          let statusDropdownMatches = jumpStatus && statusDropdown &&
                    (statusDropdown == "first-opened" || locality.startsWith(statusDropdown));

          let jumpAccount = await getStorageProperty("AutoJumpOnLoadAccount");
          let accountDropdown = await getStorageProperty("AutoJumpOnLoadAccountDropdown");
          let accountDropdownMatches = jumpAccount && accountDropdown &&
                    (accountDropdown == "first-opened" || locality.startsWith(accountDropdown));

          let urlExplode = explodeUrlNoHandler(changeMastodonUriToUrl(tab.url));
          pageDetails = await getPageDetails(tab.url);

          console.log("onUpdated", { locality, statusDropdown, accountDropdown, pageDetails, statusDropdownMatches, accountDropdownMatches });

          if (
            pageDetails &&
            get(pageDetails, "pageType") &&
            (
              (
                pageDetails.pageType == "status" && statusDropdownMatches
              ) ||
              (
                pageDetails.pageType == "account" && accountDropdownMatches
              )
            )
          ) {
            console.log("onUpdated", "pageType matches", { pageDetails, statusDropdownMatches, accountDropdownMatches, locality });

          } else {
            console.log("onUpdated", "pageType does not match", { pageDetails, statusDropdownMatches, accountDropdownMatches, locality });
            return;
          }
        }

      } else {
        console.log("onUpdated", "url is not local", tab.url);

        locality = "remote";

        let urlSplit = tab.url.split("@");

        if (urlSplit.length > 2) {
          console.log("onUpdated", "double remote detected", tab.url);
          locality = "remote-remote";
        }

        let jumpStatus = await getStorageProperty("AutoJumpOnLoadStatus");
        let statusDropdown = await getStorageProperty("AutoJumpOnLoadStatusDropdown");
        let statusDropdownMatches = jumpStatus && statusDropdown &&
              (
                statusDropdown == "first-opened" ||
                locality == "remote-remote" ||
                locality.startsWith(statusDropdown)
              );

        let jumpAccount = await getStorageProperty("AutoJumpOnLoadAccount");
        let accountDropdown = await getStorageProperty("AutoJumpOnLoadAccountDropdown");
        let accountDropdownMatches = jumpAccount && accountDropdown &&
              (
                accountDropdown == "first-opened" ||
                locality == "remote-remote" ||
                locality.startsWith(accountDropdown)
              );

        let urlExplode = explodeUrlNoHandler(changeMastodonUriToUrl(tab.url));
        pageDetails = await getPageDetails(tab.url);

        console.log("onUpdated", "conditions", { locality, statusDropdown, accountDropdown, pageDetails, statusDropdownMatches, accountDropdownMatches });

        if (
          pageDetails &&
          get(pageDetails, "pageType") &&
          (
            (
              pageDetails.pageType == "status" && statusDropdownMatches
            ) ||
            (
              pageDetails.pageType == "account" && accountDropdownMatches
            )
          )
        ) {
          console.log("onUpdated", "pageType matches", { pageDetails, statusDropdownMatches, accountDropdownMatches, locality });

        } else {
          console.log("onUpdated", "pageType does not match", { pageDetails, statusDropdownMatches, accountDropdownMatches, locality });
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
          let timeBetweenUpdatesForSameUrlAndIsLastUrl = 1000 * 8;

          if (lastUrlData.timestamp > timestamp - timeBetweenUpdatesForSameUrlAndIsLastUrl) {
            console.log("onUpdated", "lastUrl was too new", { lastUrlData, timestamp, timeBetweenUpdatesForSameUrlAndIsLastUrl });

            return;
          }
        }

        let timeBetweenUpdatesForSameUrl = 1000 * 5;

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
      settings.tabId = tabId;
      settings.tab = tab;
      settings.timestamp = timestamp;
      settings.locality = locality;
      settings.pageDetails = pageDetails;
      if (pageDetails && pageDetails.pageType) {
        settings.pageType = pageDetails.pageType;
      }
      console.log("onUpdated", "settings", settings);

      return toggleMastodonTab(tab, settings);
    }
  }
}

async function syncContextMenus() {
  await chrome.contextMenus.removeAll();
  // todo use extension checkbox to determine if context menu should be created
  await chrome.contextMenus.create({
    "id": "context",
    "title": "Toggle Mastodon Page 🐘 🐘 🐘 Jump Now",
    "documentUrlPatterns": [
      "*://*/@*",
      "*://*/users/*",
      "*://*/web/statuses/*"
    ]
  });

  // todo toggle redirect menu for autojump status, account, copypaste
}

async function getPageDetails(url) {
  let pageDetails = { url };

  let urlExplode = explodeUrlNoHandler(changeMastodonUriToUrl(url));

  if (urlExplode) {
    if (urlExplode.length > 2) {
      pageDetails.pageType = "status";
      pageDetails.account = urlExplode[1];
    } else if (urlExplode.length == 2) {
      pageDetails.pageType = "account";
      pageDetails.account = urlExplode[1];
      pageDetails.status = urlExplode[2];
    }
  } else {
    console.log("getPageDetails", "urlExplode was falsey", urlExplode);
  }

  return pageDetails;
}

async function checkFollows(url, settings) {
  let keys = ["InstanceHttps", "InstanceClean", "follows"];
  let result = await getStorage(keys);
  console.log("checkFollows", result.InstanceHttps, result);

  if (url && result && keys.every((key) => key in result)) {
    url = new URL(url);

    if (url.hostname == result.InstanceClean) {
      console.log("checkFollows", "on instance page");

    } else {
      console.log("checkFollows", "not on instance page");

      let instance = url.hostname.replace(url.protocol + "//", "");
      let path = url.pathname.split("/").filter((item) => item !== "");
      console.log("checkFollows", "url", url, instance, path);

      if (path.length > 2) {
        console.log("checkFollows", "path too long, not a profile page");
        console.log("checkFollows", "path", path);

      } else {

        let handle = path[0];

        if (handle.startsWith("@")) {
          handle = handle.substring(1);
        }

        let handleSplit = handle.split("@");

        let username = handleSplit[0];

        if (handleSplit.length > 1) {
          instance = handleSplit[1];
        }

        let account = username + "@" + instance;

        console.log("checkFollows", "handleSplit", {username, instance, result, cache});

        if (account in result.follows.content) {
          console.log("checkFollows", "account in follows", account);
          return { url: result.InstanceHttps + "@" + account, following: true };

        } else {
          console.log("checkFollows", "account not in follows", account, result.follows);

          let webAccount = await getWebfingerAccount(instance, username);
          let [webAccountUsername, webAccountInstance] = webAccount.split("@");

          if (webAccount in result.follows.content) {
            console.log("checkFollows", "webAccount in follows", webAccount);
            return { url: result.InstanceHttps + "@" + webAccount, following: true };

          } else if (Date.now() - result.follows.timestamp > 1 * 60 * 1000) {
            console.log("checkFollows", "follows is too old", result.follows.timestamp);

            await syncLocalWithFollowsCsv();

            if (account in result.follows.content) {
              console.log("checkFollows", "account in follows now", account);
              return { url: result.InstanceHttps + "@" + account, following: true };

            } else {
              console.log("checkFollows", "account not in follows now", account);
            }

          } else {
            console.log("checkFollows", "follows is not too old", result.follows.timestamp);
          }
        }
      }
    }

  } else if (!get(settings, "noSync")) {
    console.log("checkFollows", "invalid", { result, keys, url });

    await syncLocalWithFollowsCsv();

    return checkFollows(url, { noSync: true });
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

  let senderUrl = new URL(sender.tab.url);
  let instance = new URL(await getInstance());

  if (message.type == "getStorage") {
    Object.assign(response.content, await getStorage(message.content.keys, { strict: true }));
    sendMessage(sender.tab.id, response);

  } else if (message.type == "setStorage") {
    await setStorage(message);

  } else if (message.type == "follow" && senderUrl && senderUrl.hostname !== instance.hostname) {

    let searchResult = await search(senderUrl.href);
    let accounts = get(searchResult, "accounts") || [];

    if (accounts.length > 0) {
      let account = accounts[0];
      let id = account.id;

      console.log("onMessage", "follow", "id", { id, account, accounts, searchResult, response, message, sender});

      if (id) {
        let verifyResult = await verify();
        console.log("onMessage", "follow", "verify", verifyResult);
        let result = await follow(id);
        sendMessage(sender.tab.id, response, { type: "following", content: result });
      } else {
        console.log("onMessage", "follow", "no id", account);
      }
    } else {
      console.log("onMessage", "follow", "no accounts", searchResult);
    }

  } else if (message.type == "onLoad" && senderUrl && senderUrl.hostname !== instance.hostname) {
    console.log("onMessage", "onLoad", message, sender, sendResponse, response);

    let followResult = await checkFollows(senderUrl.href);
    if (!followResult) {
      console.log("onMessage", "onLoad", "no followResult", { followResult, senderUrl });
      return;
    }
    let followUrl = new URL(followResult.url);

    if (followResult.following) {
      console.log("onMessage", "onLoad", "following", { followResult, followUrl, senderUrl });
      sendMessage(sender.tab.id, response, { type: "following", content: { url: followUrl.href } });

    } else {
      console.log("onMessage", "onLoad", "not following", "addFollowListener", { followResult, url, followUrl, senderUrl });
      sendMessage(sender.tab.id, response, { type: "addFollowListener", content: { url: followUrl.href } });
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
  // console.log("onAlarm", alarm);

  if (alarm.name === "syncCacheWithStorage") {
    syncCacheWithStorage();

  } else if (alarm.name === "syncLocalWithFollowsCsv") {
    syncLocalWithFollowsCsv();
  }
}

chrome.action.onClicked.addListener(onClicked);

chrome.alarms.create("syncCacheWithStorage", {periodInMinutes: 3});
chrome.alarms.create("syncLocalWithFollowsCsv", {periodInMinutes: 5});
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
    console.log("background.js", "syncing");

    await syncContextMenus();
    console.log("background.js", "synced context menus");

    await syncLocalWithFollowsCsv();
    console.log("background.js", "synced local with follows csv");

    await syncCacheWithStorage();
    console.log("background.js", "synced cache with storage");
  })())();

console.log("background.js", "done");
// todo: when follow is clicked set it to pending
// todo on follow click return
//      url of home instance profile
//      not same url clicked.
// TODO: be able to edit profile while extension is enabled
    //   don't add listener if not following and is instance

// todo: last url check not working for autoredirect well enough
          // issues with clicking on alt text for image
          // when local and autoredirect remote is on
          // separate 'manualy onclicked' list that disables
          // autoredirect for those urls, maybe last 10 or so


// todo: context menu for toggle autoredirect
