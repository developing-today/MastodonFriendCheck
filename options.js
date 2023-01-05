export function get(object, property, settings) {
  let defaultValue = settings ? get(settings, "default") : null;
  return object && property && object.hasOwnProperty(property)
          && object[property] !== undefined && object[property] !== null
          ? object[property] : defaultValue;
}

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
  let x = e || window.event;
  let key = x.keyCode || x.which;

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

  if (!domain) { return };
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
  // TODO:   if(chrome.runtime.lastError) {
  return chrome.storage.sync.set(object);
}

export function newTab(url) {
  return chrome.tabs.create({ url: url.toString() });
}

export async function getStorage(keys) {
  return chrome.storage.sync.get(Array.isArray(keys) ? keys : [keys]);
}

export async function getStorageProperty(name) {
  if (Array.isArray(name) && name.length > 0) {
    name = name[0];
  }
  let result = await getStorage(name);
  return result[name];
}

export function getCurrentVersion() {
  return chrome.runtime.getManifest().version;
}

export async function getStorageVersion() {
  return getStorageProperty("Version") || "0.1.0";
}

export async function setStorageWithProperty(name, value) {
  let object = {};
  object[name] = value;
  return setStorage(object);
}

export function setCurrentVersion() {
  return setStorageWithProperty("Version", getCurrentVersion());
}

export async function getClientId() {
  return getStorage(["client_id"]);
}

export async function getInstance(isNotForceHttps) {

  if (isNotForceHttps) {
    return getStorage(["Instance"]).then(result => { return result.Instance; });
  } else {
    return getStorage(["InstanceHttps"]).then(result => { return result.InstanceHttps; });
  }
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
      UPDATE: checked it does not.
              https://github.com/mastodon/mastodon/issues/21913

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
    chrome.runtime.getManifest().homepage_url
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
    let instanceLabel = result.Instance;

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
  console.log("permissionGrantedInstance", input);
  await setStorage({
    Instance: input,
    InstanceHttps: makeHttps(input),
    PermissionDeniedInstance: false,
    Version: getCurrentVersion(),
  }).then(() => onResult);
}

export async function setOauthOption(value) {
  return setStorageWithProperty("OauthApp", value);
}

export async function initializeMastodonExtension() {
  return makeApp()
  .then(() => authorizeUser()
  ).then(() => setOauthOption(true)
  ).then(() => setCurrentVersion());
}

export async function ifTrueThenInitializeMastodonExtension(option, element, settings) {
  if (get(element, "checked")) {
    await initializeMastodonExtension(
    ).then(() => setOauthOption(true)
    ).catch(() => setOauthOption(false));
  }
}

export async function onClicked() {
  let input = document.getElementById("instanceTextBox").value.trim();

  if (input && input != "Thanks!") {
    await requestPermissions(await extensionPermissionsToRequestForInstanceApp(input)
    ).then(() => permissionGrantedInstance(input)
    ).catch(() => permissionDeniedInstance()
    ).then(() => setCurrentVersion());

    window.location.reload();
  }
}

export async function setupOptionsListenerById(option, settings) {
  let disabled = false;

  if (get(settings, "disabled")) {
    disabled = settings.disabled;
  }

  let element = document.getElementById(option);

  if (element) {
    let result = await getStorage([option]);

    if (option in result === false || result[option] === null || result[option] === undefined) {
      console.log("setting default for", option);
      result[option] = get(settings, "default", { default: false });
      console.log("result[option]", {option, result});
      await setStorageWithProperty(option, result[option]);
    }

    if (result[option]) {
      element.checked = true;

    } else {
      element.checked = false;
    }

    let defaultCallback = async () => {
      await setStorageWithProperty(option, element.checked);
    }

    let callback = defaultCallback;
    let callbackSetting = get(settings, "callback");

    if (callbackSetting) {
      callback = () => callbackSetting(option, element, settings);
    }

    element.addEventListener("click", callback);

    if (disabled) {
      element.classList.add("disabled");
      element.classList.remove("enabled");

    } else {
      element.classList.add("enabled");
      element.classList.remove("disabled");
    }
  }
}

export async function onLoad() {
  await getStorage([
    "FollowingList",
    "Instance",
    "PermissionDeniedInstance",
  ]).then(result => {
    let instanceLabel = result.Instance;

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

  let submitButtonElement = document.getElementById("submitButton");

  if (submitButtonElement) {
    submitButtonElement.addEventListener("click", onClicked);
  }

  await setupOptionsListenerById("OpenInNewTab", { disabled: false });
  await setupOptionsListenerById("AutoRedirectOnLoad", { disabled: false });
  await setupOptionsListenerById("AutoRedirectOnCopyPrompt", { disabled: true });
  await setupOptionsListenerById("ReadWriteAll", { disabled: true });
  await setupOptionsListenerById("OauthApp", { disabled: false, callback: ifTrueThenInitializeMastodonExtension });
  await setupOptionsListenerById("UpdateStats", { disabled: true });
  await setupOptionsListenerById("Following", { disabled: true });
  await setupOptionsListenerById("OnClickedToggle", { disabled: false, default: true });
  await setupOptionsListenerById("OnClickedReadWrite", { disabled: true });
  document.onkeypress = keyPress;
}

document.addEventListener("DOMContentLoaded", onLoad);
