export function permissionRequiredInnerHTML() {
  return "Permission required.<br>Please try again.";
}

export function getAppPermissions() {
  return "write:follows"; //"read:search read:follows";
}

export function getRedirectUri() {
  return "urn:ietf:wg:oauth:2.0:oob"
}

export function keyPress(e) {
  var x = e || window.event;
  var key = x.keyCode || x.which;
  if (key == 13 || key == 3) {
    document.getElementById("submitButton").click();
  }
}

export function removeUriHandler(url) {
  return url
    .replace("https://", "")
    .replace("http://", "");
}

export function cleanDomain(domain) {
  if (!domain) return;
  let cleanDomain = removeUriHandler(domain);
  if (cleanDomain.toString().includes("/")) {
    return cleanDomain.split("/")[0];
  } else {
    return cleanDomain;
  }
}

export function makeHttps(url) {
  return "https://" + cleanDomain(url) + "/";
}

export function extensionPermissionsToRequest(instance, query = ["*"]) {
  return {
    origins: [makeHttps(instance) + query],
  };
}

export async function extensionPermissionsToRequestForInstanceApp(instance) {
  return extensionPermissionsToRequest(instance, ["api/v*/*", "oauth/*"]);
}

export async function requestPermissions(permissions) {
  return chrome.permissions.request(permissions);
}

export async function setStorage(object) {
  return chrome.storage.sync.set(object);
}

export function newTab(url) {
  return chrome.tabs.create({ url: url.toString() });
}

export async function getStorage(keys) {
  return chrome.storage.sync.get(keys);
}

export function getCurrentVersion() {
  return chrome.runtime.getManifest().version;
}

export async function setStorageWithProperty(name, value) {
  var object = {};
  object[name] = value;
  return await setStorage(object);
}

export function setCurrentVersion() {
  return setStorageWithProperty("version", getCurrentVersion());
}

export async function getClientId() {
  return await getStorage(["client_id"]);
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

export async function authorizeUser() {
  const url = new URL(await getInstance() + "oauth/authorize");
  url.searchParams.append("response_type", "code");
  url.searchParams.append("client_id", await getClientId().then(result => result.client_id));
  url.searchParams.append("redirect_uri", getRedirectUri());
  url.searchParams.append("scope", getAppPermissions());
  newTab(url);
}

export async function makeApp() {
  /*
    We make an app for each user
    Because a user could be on any mastodon instance
    one could use a single app per instance
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
      UPDATE: checked it does not. something else then.
              probably a cloudflare worker.

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
  formData.append("scopes", getAppPermissions()); // read:search read:follows
  formData.append(
    "website",
    "https://src.developing.today/MastodonFriendCheck"
  );
  return fetch(url, {
    method: "POST",
    body: formData,
  }).then(result => result.json()
  ).then(setStorage);
}

export async function onResult() {
  let result = getStorage(["FollowingList", "Instance"])
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
  await setStorageWithProperty("PermissionDeniedInstance", true);
  document.getElementById("instanceLabel").innerHTML = permissionRequiredInnerHTML();
}

export async function permissionGrantedInstance(input) {
  setStorage({
    Instance: input,
    PermissionDeniedInstance: false,
    Version: getCurrentVersion(),
  }).then(() => onResult);
}

export async function initializeMastodonExtension() {
  return makeApp()
      .then(() => authorizeUser()
      ).then(() => setCurrentVersion());
}

export async function onClick() {
  var input = document.getElementById("instanceTextBox").value.trim();
  if (input && input != "Thanks!") {
    await requestPermissions(await extensionPermissionsToRequestForInstanceApp(input)
    ).then(() => permissionGrantedInstance(input)
    ).catch(() => permissionDeniedInstance());
    await initializeMastodonExtension();
  }
}

export async function onLoad() {
  await getStorage([
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
    submitButtonElement.addEventListener("click", onClick);
  }
  document.onkeypress = keyPress;
}

document.addEventListener("DOMContentLoaded", onLoad);

// TODO: if app is setup toggle current url
