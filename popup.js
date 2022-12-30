export function permissionRequiredInnerHTML() {
  return "Permission required.<br>Please try again.";
}

export function keyPress(e) {
  var x = e || window.event;
  var key = x.keyCode || x.which;
  if (key == 13 || key == 3) {
    document.getElementById("submitButton").click();
  }
}

export async function getChromeStorage(keys) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.sync.get(keys, result => {
        resolve(result);
      });
    } catch (error) {
      reject(error);
    }
  });
}

export function stripHandle(handle) {
  if (handle.toString().includes("@")) {
    const handleSplit = handle.split("@");
    return handleSplit[handleSplit.length - 1];
  } else {
    return handle;
  }
}

export function cleanDomain(domain) {
  let cleanDomain = stripHandle(domain)
    .replace("https://", "")
    .replace("http://", "");
  if (cleanDomain.toString().includes("/")) {
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
    await getChromeStorage(["Instance"]).then(result => {
      if (result && result.Instance) {
        return result.Instance;
      }
    })
  );
}

export function chromePermissionsToRequest(instance, query = "*") {
  return {
    origins: [makeHttps(instance) + query],
  };
}

export async function chromePermissionsToRequestForInstanceApp(instance) {
  return chromePermissionsToRequest(instance, "api/v*/*");
}

export async function requestPermissions(permissions) {
  return new Promise((resolve, reject) => {
    try {
      chrome.permissions.request(permissions, result => {
        if (result) {
          resolve(permissions);
        } else {
          reject();
        }
      });
    } catch (error) {
      reject();
    }
  });
}

export async function setChromeStorage(object) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.sync.set(object, () => {
        resolve(object);
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function setChromeStorageWithProperty(name, value) {
  var object = {};
  object[name] = value;
  return setChromeStorage(object);
}

export function getAppPermissions() {
  return "write:follows"; //"read:search read:follows";
}

export async function getRedirectUri() {
  return "urn:ietf:wg:oauth:2.0:oob"
}

export async function authorizeUser() {
  const storage = await getChromeStorage(["client_id"]);
  const url = new URL(await getInstance() + "oauth/authorize");
  url.searchParams.append("response_type", "code");
  url.searchParams.append("client_id", storage.client_id);
  url.searchParams.append("redirect_uri", getRedirectUri());
  chrome.tabs.create({
    url: url.toString(),
  });
}

export async function makeApp() {
  /*
    We make an app for each user
    Because a user could be on any mastodon instance
    once could use a single app per instance
    but that could require a lot of work to keep track of.
    We attempt to ensure the app is reused as much as possible,
    store the app id in sync and reuse.

    Mastodon Instance Owners:
      If you are here because my extension has caused you difficulties,
      My apologies.
      I will be happy to work with you in the case this occurs.

      Please contact me at: https://src.developing.today/MastodonFriendCheck
      Or my email: issues@developing-today.com
      Or my email: drewrypope@gmail.com
      Or call or text: +17152550552

      Currently, a thought would be to store
      an object for each common instance here.
      Then, if the user is on that instance,
      use the app for that instance.
      The client_secret should not be needed?
      One should use something like pkce if masto supports.
      Haven't checked yet.

      Alternatively I can host something for this
      or a cloudflare worker or something.

      anyways, I'm open to suggestions just not dealing with
      this until I have to.

      example object
      // {
      //   "client_id": "9xf8mdtqjJhlSgF2sEXAMPLEygPjmMfqrUILE49V3zQwQ",
      //   "id": "8675309",
      //   "name": "Mastodon Friend Checker",
      //   "redirect_uri": "urn:ietf:wg:oauth:2.0:oob",
      //   "vapid_key": "PODTeC4QbxR2XyKrqeLxOBkMSZf32CJaEfcvnF1QwKow0o1qu4hoA4XYEXAMPLEh33MmEd0xbYkPzdsn4mm4cRY=",
      //   "website": "https://src.developing.today/MastodonFriendCheck"
      // }

  */
  const url = new URL((await getInstance()) + "api/v1/apps");
  const formData = new FormData();
  formData.append("client_name", "Mastodon Friend Checker");
  formData.append("redirect_uris", getRedirectUri());
  formData.append("scopes", getAppPermissions(); // read:search read:follows
  formData.append(
    "website",
    "https://src.developing.today/MastodonFriendCheck"
  );

  return fetch(url, {
    method: "POST",
    body: formData,
  })
  .then(result => result.json())
  .then(result => {
    console.log("Success:", result);
    return result;
  })
  .then(result => {
    result["Version"] = chrome.runtime.getManifest().version;
    return result;
  })
  .then(setChromeStorage)
  .then(() => authorizeUser())
  .catch((error) => {
    console.error("Error:", error);
  });
}

export async function getAccessToken(code) {
  const storage = await getChromeStorage(["client_id", "client_secret"]);
  const url = new URL(await getInstance() + "oauth/token");
  const formData = new FormData();
  formData.append("grant_type", "authorization_code");
  formData.append("code", code);
  formData.append("client_id", storage.client_id);
  formData.append("client_secret", storage.client_secret);
  formData.append("redirect_uri", getRedirectUri());
  formData.append("scope", getAppPermissions());

  return fetch(url, { method: "POST", body: formData })
    .then(result => result.json())
    .then(result => {
      console.log("Success:", result);
      return result;
    })
    .then(setChromeStorage)
    .then(result => result.access_token)
    .catch(error => console.error("Error:", error));
}

export async function search(query, limit = 1) {
  console.log("QUERY:" + query); // probably a url
  let instance = await getInstance();
  let url = new URL(instance + "api/v2/search");
  url.searchParams.append("q", query);
  url.searchParams.append("resolve", true);
  url.searchParams.append("limit", limit);
  console.log(JSON.stringify(url));
  return fetch(url)
    .then(result => result.json())
    .then(result => {
      console.log(result);
      return result;
    });
}

export async function getStatusId(query) {
  return search(query).then(result => {
    console.log(JSON.stringify(result));
    if (result.statuses) {
      return result.statuses[0];
    }
  });
}

export async function getAccountId(query) {
  return search(query).then(result => {
    console.log(JSON.stringify(result));
    if (result.accounts) {
      return result.accounts[0];
    }
  });
}

export async function getAccountIdByHandle(handle) {
  let trimHandle = handle;
  while (trimHandle.charAt(0) === "@") {
    trimHandle = trimHandle.substring(1);
  }
  let vals = trimHandle.split("@");
  return getAccountId("https://" + vals[vals.length - 1] + "/" + "@" + vals[0]);
}

export async function activeToken() {
}

export async function follow(id) {
  let url = new URL(
    await getInstance() + "api/v1/accounts/" + id + "/follow"
  );
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + await activeToken(),
    }
  }).then(response => response.json());
}

export async function onResult(result) {
  if (result.Instance) {
    var instanceLabel = result.Instance;
    if (result.FollowingList) {
      if (result.FollowingList.length > 0) {
        instanceLabel =
          instanceLabel + "\n(" + result.FollowingList.length + ")";
      }
    }
    document.getElementById("instanceLabel").innerHTML = instanceLabel;
    document.getElementById("instanceTextBox").value = "Thanks!";
  }
}

export async function permissionDeniedInstance() {
  await setChromeStorageWithProperty("PermissionDeniedInstance", true);
  document.getElementById("instanceLabel").innerHTML =
    permissionRequiredInnerHTML();
}

export async function permissionGrantedInstance(input) {
  setChromeStorage({
    Instance: input,
    PermissionDeniedInstance: false,
    Version: chrome.runtime.getManifest().version,
  })
  .then(() => {
    return getChromeStorage(["FollowingList", "Instance"]);
  })
  .then(onResult);
}

export async function onClick() {
  var input = document.getElementById("instanceTextBox").value.trim();
  if (input && input != "Thanks!") {
    requestPermissions(await chromePermissionsToRequestForInstanceApp(input))
      .then(async () => {
        await permissionGrantedInstance(input).then(async () => {
          await makeApp();
        });
      })
      .catch(permissionDeniedInstance);
  }
}

export async function onClickFollow() {
  var input = document.getElementById("instanceTextBox").value.trim();
  if (input && input != "Thanks!") {
    let id = await getAccountIdByHandle(input);
    let result = await follow(id.id);
    console.log();
  }
  console.log("Done");
}

export async function onLoad() {
  await getChromeStorage([
    "FollowingList",
    "Instance",
    "PermissionDeniedInstance",
  ]).then(result => {
    var instanceLabel = result.Instance;
    if (result.Instance) {
      document.getElementById("instanceTextBox").value = instanceLabel;
    }
    if (result.PermissionDeniedInstance) {
      document.getElementById("instanceLabel").innerHTML =
        permissionRequiredInnerHTML();
    } else if (instanceLabel) {
      if (result.FollowingList) {
        if (
          Array.isArray(result.FollowingList) &&
          result.FollowingList.length > 0
        ) {
          instanceLabel =
            instanceLabel + "\n(" + result.FollowingList.length + ")";
        }
      }
      if (!result.PermissionDeniedInstance) {
        document.getElementById("instanceLabel").innerHTML = instanceLabel;
      }
    }
  });
  var submitButtonElement = document.getElementById("submitButton");
  if (submitButtonElement) {
    submitButtonElement.addEventListener("click", onClickFollow);
  }
  document.onkeypress = keyPress;
}

document.addEventListener("DOMContentLoaded", onLoad);
