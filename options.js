export function get(object, property, settings) {
  let defaultValue = settings ? get(settings, "default") : null;
  return object && property && property in object
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
    origins: query.map(query => makeHttps(instance) + query)
  };
}

export async function extensionPermissionsToRequestForInstanceApp(instance) {
  return extensionPermissionsToRequest(instance, ["api/v*/*", "oauth/*", "@*"]);
}

export async function extensionPermissionsToRequestForReadWriteAllOrigin() {
  return extensionPermissionsToRequest("*", ["*"]);
}

export async function requestPermissions(permissions) {
  console.log("requesting permissions", permissions);
  return chrome.permissions.request(permissions);
}

export async function setStorage(object) {
  // TODO:   if(chrome.runtime.lastError) {
  console.log("setStorage", object);
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
  console.log("Making App");
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
  console.log("onResult");
  let result = getStorage(["FollowingList", "Instance"])
  console.log("onResult", { result });

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
  let result = await setStorage({
    Instance: input,
    InstanceHttps: makeHttps(input),
    InstanceClean: cleanDomain(input),
    PermissionDeniedInstance: false,
    Version: getCurrentVersion(),
  }).then(async (result) => {
    console.log("permissionGrantedInstance", {result});
    await onResult();
  });
  console.log(result);
}

export async function setOauthOption(value) {
  return setStorageWithProperty("OauthApp", value);
}

export async function setChromeReadWriteAllOption(value) {
  return setStorageWithProperty("ReadWriteAll", value);
}

export async function initializeChromeReadWriteAllOrigin() {
  console.log("initializeChromeReadWriteAllOrigin");
  let permissions = await extensionPermissionsToRequestForReadWriteAllOrigin();
  console.log("initializeChromeReadWriteAllOrigin", {permissions});

  return await requestPermissions(
    permissions
  ).then(() => setChromeReadWriteAllOption(true)
  ).then(() => setCurrentVersion());
}

export async function initializeMastodonExtension() {
  console.log("initializeMastodonExtension");
  return makeApp()
  .then(() => authorizeUser()
  ).then(() => setOauthOption(true)
  ).then(() => setCurrentVersion());
}

export async function ifTrueThenInitializeChromeReadWriteAllOrigin(option, element, settings) {
  console.log("ifTrueThenInitializeChromeReadWriteAllOrigin", {option, element, settings});
  let checked = get(element, "checked");
  console.log("ifTrueThenInitializeChromeReadWriteAllOrigin", {checked});

  if (checked) {
    console.log("ifTrueThenInitializeChromeReadWriteAllOrigin", "checked");
    await initializeChromeReadWriteAllOrigin(
    ).then(() => setOauthOption(true)
    ).catch(() => setOauthOption(false));
  } else {
    console.log("ifTrueThenInitializeChromeReadWriteAllOrigin", "unchecked");
    await setOauthOption(false);
  }
  window.location.reload(); // comment out during development
}

export async function ifTrueThenInitializeMastodonExtension(option, element, settings) {
  console.log("ifTrueThenInitializeMastodonExtension", {option, element, settings});
  if (get(element, "checked")) {
    console.log("ifTrueThenInitializeMastodonExtension", "checked");
    await initializeMastodonExtension(
    ).then(() => setOauthOption(true)
    ).catch(() => setOauthOption(false));
  } else {
    console.log("ifTrueThenInitializeMastodonExtension", "unchecked");
    await setOauthOption(false);
  }
  window.location.reload(); // comment out during development
}
// # todo setup oauth to contain url in settings and reuse indefinitely whnever getinstance matches
// # todo setup urls for toggle to include more information, where it was called, tally of times called, tally of times toggle
export async function onClicked() {
  let input = document.getElementById("instanceTextBox").value.trim();

  if (input && input != "Thanks!") {
    await requestPermissions(await extensionPermissionsToRequestForInstanceApp(input)
    ).then(() => permissionGrantedInstance(input)
    ).catch(() => permissionDeniedInstance()
    ).then(() => setOauthOption(false)

    ).then(() => setCurrentVersion());

    setStorageWithProperty("Instance", input);
    window.location.reload(); // comment out during development
  }
}

export async function setupOptionsListenerById(option, settings) {
  console.log("setupOptionsListenerById", {option, settings});

  let disabled = false;

  if (get(settings, "disabled")) {
    disabled = settings.disabled;
  }

  let element = document.getElementById(option);
  let dropdown = option + "Dropdown";
  let dropdownElement = document.getElementById(dropdown);
  console.log("setupOptionsListenerById", {option, element, dropdown, dropdownElement});

  if (element) {
    let result = await getStorage([option]);

    if (option in result === false || result[option] === null || result[option] === undefined) {
      console.log("setting default for", option);
      result[option] = get(settings, "default", { default: false });
      console.log("result[option]", {option, result});
      await setStorageWithProperty(option, result[option]);
    }

    element.checked = result[option] ? true : false;

    let defaultCallback = async () => {
      console.log("defaultCallback", {option, element});
      if (dropdownElement) {
          dropdownElement.disabled = !element.checked;

          for (let option of dropdownElement.options) {
            option.disabled = !element.checked;
          }
      }
      await setStorageWithProperty(option, element.checked);
    }

    let callbackFunction = defaultCallback;
    let callbackSetting = get(settings, "callback");

    if (callbackSetting) {
      callbackFunction = () => {
        console.log("callbackFunction", {option, element});
        callbackSetting(option, element, settings);
      }
    }

    element.addEventListener("click", callbackFunction);
    element.disabled = false;

    if (disabled) {
      element.classList.add("disabled");
      element.classList.remove("enabled");
    } else {
      element.classList.add("enabled");
      element.classList.remove("disabled");
    }
  }

  if (dropdownElement) {
    console.log("dropdownElement", {dropdown, dropdownElement});
    let dropdownDefault = get(settings, "dropdownDefault");
    let result = await getStorage([dropdown]);

    if (dropdown in result === false || result[dropdown] === null || result[dropdown] === undefined) {
      console.log("setting default for", dropdown);
      result[dropdown] = dropdownDefault;
      console.log("result[dropdown]", {dropdown, result});
      await setStorageWithProperty(dropdown, result[dropdown]);
    }

    dropdownElement.value = result[dropdown];

    let dropdownDefaultCallback = async () => {
      console.log("defaultDropdownCallback", {dropdown, dropdownElement});
      await setStorageWithProperty(dropdown, dropdownElement.value);
    }

    let dropdownCallbackFunction = dropdownDefaultCallback;
    let dropdownCallbackSetting = get(settings, "dropdownCallback");

    if (dropdownCallbackSetting) {
      dropdownCallbackFunction = () => {
        console.log("dropdownCallbackFunction", {dropdown, dropdownElement});
        dropdownCallbackSetting(dropdown, dropdownElement, settings);
      }
    }

    dropdownElement.addEventListener("change", dropdownCallbackFunction);

    for (let option of dropdownElement.options) {
      option.disabled = !element.checked;
    }

    dropdownElement.disabled = !element.checked;
  }

  console.log("setupOptionsListenerById", {option, element, dropdown, dropdownElement});

  return element;
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
  await setupOptionsListenerById("AutoRedirectOnLoadStatus", { disabled: false, dropdownDefault: "local" });
  await setupOptionsListenerById("AutoRedirectOnLoadAccount", { disabled: false, dropdownDefault: "remote"});
  await setupOptionsListenerById("AutoRedirectOnCopyPastePrompt", { disabled: true });
  await setupOptionsListenerById("ReadWriteAll", { disabled: false, callback: ifTrueThenInitializeChromeReadWriteAllOrigin });
  await setupOptionsListenerById("OauthApp", { disabled: true, callback: ifTrueThenInitializeMastodonExtension });
  await setupOptionsListenerById("UpdateStats", { disabled: true });
  await setupOptionsListenerById("Following", { disabled: true });
  await setupOptionsListenerById("OnClickedToggle", { disabled: false, default: true });
  await setupOptionsListenerById("OnClickedReadWrite", { disabled: true });

  document.onkeypress = keyPress;
}

document.addEventListener("DOMContentLoaded", onLoad);
