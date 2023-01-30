export function get(object, property, settings) {
  console.log("get", { object, property, settings });
  let defaultValue = settings ? get(settings, "default") : null;

  let resultCondition = object &&
      property &&
      typeof object === "object" &&
      typeof property === "string" &&
      property in object &&
      object[property] !== undefined &&
      object[property] !== null
  let result = resultCondition ? object[property] : defaultValue;

  console.log("get", "result", { resultCondition, defaultValue, result });
  return result;
}

export function permissionRequiredInnerHTML() {
  return "Permission required.<br>Please try again.";
}

export async function getAppPermissions() {
  return await getStorageProperty("scopes") || "write:follows"; //"read:search read:follows";
}

export async function getRedirectUri() {
  return await getStorageProperty("redirect_uri") || "urn:ietf:wg:oauth:2.0:oob";
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
  let sync  = await chrome.storage.sync.get(Array.isArray(keys) ? keys : [keys]);
  let local = await chrome.storage.local.get(Array.isArray(keys) ? keys : [keys]);
  let result = {};
  Object.assign(result, sync, local);
  console.log("getStorage", { keys, result, sync, local });
  return result;
}

export async function getStorageProperty(name, defaultValue = null) {
  if (Array.isArray(name) && name.length > 0) {
    name = name[0];
  }
  let result = await getStorage([name]);
  console.log("getStorageProperty", { name, result, defaultValue });
  return get(result, name, { default: defaultValue });
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
  return getStorageProperty("client_id");
}

export async function getInstance(isNotForceHttps) {

  if (isNotForceHttps) {
    return getStorageProperty("Instance");
  } else {
    return getStorageProperty("InstanceHttps");
  }
}

export async function authorizeUser() {
  console.log("authorizeUser");
  const url = new URL(await getInstance() + "oauth/authorize");
  console.log("authorizeUser", url);
  url.searchParams.append("response_type", "code");
  url.searchParams.append("client_id", await getClientId());
  url.searchParams.append("redirect_uri", await getRedirectUri());
  url.searchParams.append("scope", await getAppPermissions());
  console.log("authorizeUser", url);
  newTab(url);
  window.location.reload(); // comment out during development
  // todo consider dynamic reload of options page values instead of full page reload
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
      //   "name": "Mastodon Friend Check",
      //   "redirect_uri": "urn:ietf:wg:oauth:2.0:oob",
      //   "vapid_key": "PODTeC4QbxR2XyKrqeLxOBkMSZf32CJaEfcvnF1QwKow0o1qu4hoA4XYEXAMPLEh33MmEd0xbYkPzdsn4mm4cRY=",
      //   "website": "https://src.developing.today/MastodonFriendCheck"
      // }

  */
  console.log("Making App");
  const url = new URL((await getInstance()) + "api/v1/apps");
  const host = url.host;
  const formData = new FormData();
  const scopes = await getAppPermissions();
  formData.append("client_name", chrome.runtime.getManifest().name);
  formData.append("redirect_uris", await getRedirectUri());
  formData.append("scopes", scopes); // read:search read:follows
  formData.append(
    "website",
    chrome.runtime.getManifest().homepage_url
  );
  console.log("makeApp", { url, formData });
  let result = await fetch(url, {
    method: "POST",
    body: formData,
  }).then(result => result.json()
  ).then(result => {
    return result;
  });
  console.log("makeApp result", { result });

  if (!result || result.error) {
    console.error("makeApp error", { result });
    return result;
  }

  let apps = await getStorageProperty("apps") || {};
  let app = { host };
  Object.assign(app, result);
  apps[host] = app;
  Object.assign(result, { app, apps, url, host, formData, scopes });
  await setStorage(result);
  return result;
}

export async function onResult() {
  let result = getStorage(["follows", "Instance"])
  console.log("onResult", { result });

  if (result.Instance) {
    let instanceLabel = result.Instance;

    if (result.follows.content) {

      if (Object.keys(result.follows.content).length > 0) {
        instanceLabel =
          instanceLabel + "\n(" + Object.keys(result.follows.content).length + ")";
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

export async function initializeStorage(input) {
  console.log("initializeStorage", input);
  let result = await setStorage({
    Instance: input,
    InstanceHttps: makeHttps(input),
    InstanceClean: cleanDomain(input),
    PermissionDeniedInstance: false,
    OauthApp: false,
    Version: getCurrentVersion(),
  }).then(async (result) => {
    console.log("initializeStorage", {result});
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

export async function initializeMastodonOauthApp() {
  console.log("initializeMastodonOauthApp");
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
    ).then(async () => setOauthOption(true)
    ).catch(async () => setOauthOption(false));
  } else {
    console.log("ifTrueThenInitializeChromeReadWriteAllOrigin", "unchecked");
    await setOauthOption(false);
  }
  // window.location.reload(); // comment out during development
  // todo consider dynamic reload of options page values instead of full page reload
}

export async function ifTrueThenInitializeMastodonOauthApp(option, element, settings) {
  console.log("ifTrueThenInitializeMastodonOauthApp", {option, element, settings});
  let followingElement = document.getElementById("FollowListener");

  if (get(element, "checked")) {
    console.log("ifTrueThenInitializeMastodonOauthApp", "checked");
    await initializeMastodonOauthApp(
    ).then(async () => {
      console.log("ifTrueThenInitializeMastodonOauthApp", "initializeMastodonOauthApp");
      if (followingElement) {
        await setStorageWithProperty("FollowListener", true);
        followingElement.disabled = false;
        followingElement.checked = true;
        followingElement.classList.add("enabled");
        followingElement.classList.remove("disabled");
      } else {
        console.error("ifTrueThenInitializeMastodonOauthApp", "followingElement not found");
      }
    }).then(() => setOauthOption(true)
    ).catch(() => setOauthOption(false));
  } else {
    console.log("ifTrueThenInitializeMastodonOauthApp", "unchecked");
    await setOauthOption(false);
    if (followingElement) {
      await setStorageWithProperty("FollowListener", false);
      followingElement.classList.add("disabled");
      followingElement.classList.remove("enabled");
      followingElement.checked = false;
      followingElement.disabled = true;
    } else {
      console.error("ifTrueThenInitializeMastodonOauthApp", "followingElement not found");
    }
  }
  // window.location.reload(); // comment out during development
  // todo consider dynamic reload of options page values instead of full page reload

}
// # todo setup oauth to contain url in settings and reuse indefinitely whnever getinstance matches
// # todo setup urls for toggle to include more information, where it was called, tally of times called, tally of times toggle
export async function onClicked() {
  let input = document.getElementById("instanceTextBox").value.trim();

  if (input && input != "Thanks!") {
    let instance = await getInstance();
    console.log("onClicked", { input, instance });

    if (!instance || instance != input) {
      await requestPermissions(await extensionPermissionsToRequestForInstanceApp(input)
      ).catch(async () => {
        await permissionDeniedInstance();
        Promise.reject("permissionDeniedInstance");
      }).then(() => initializeStorage(input));
      // window.location.reload(); // comment out during development
      // todo consider dynamic reload of options page values instead of full page reload
    }
  }
}

export async function setupOptionsListenerById(option, settings) {
  console.log("setupOptionsListenerById", {option, settings});
  // todo: setupOptionsListenerById 'dependencyCallback'
  // exampe callback
  // if oauth is enabled,
  //    check that 'access_token' exists.
  //    verify_credentials access_token
  //    if code, retry generate from code
  // if not, set value back to false
  //

  // todo: update apps to be only source for oauth
  // apps[instanceUrl.hostname] = { access_token, client_id, client_secret, code, created_at, id, redirect_uri, scopes, token_type, updated_at, url }
  // something like that
  let disabled = false;

  if (get(settings, "disabled")) {
    disabled = settings.disabled;
  }

  let element = document.getElementById(option);
  let dropdown = option + "Dropdown";
  let dropdownElement = document.getElementById(dropdown);
  console.log("setupOptionsListenerById", {option, element, dropdown, dropdownElement});

  if (element) {
    let result = await getStorageProperty(option);
    console.log("setupOptionsListenerById", {option, result});

    if (result === null || result === undefined) {
      console.log("setting default for", option);
      result = get(settings, "default", { default: false });
      console.log("result", {option, result});
      await setStorageWithProperty(option, result);
    }

    element.checked = result ? true : false;

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

    console.log("callbackSetting", {option, callbackSetting});

    if (callbackSetting) {
      callbackFunction = () => {
        console.log("callbackFunction", {option, element});
        callbackSetting(option, element, settings);
      }
    }

    element.addEventListener("click", callbackFunction, { passive: true });
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
    let result = await getStorageProperty(dropdown);

    if (result === null || result === undefined) {
      console.log("setting default for", dropdown);
      result = dropdownDefault;
      console.log("result", {dropdown, result});
      await setStorageWithProperty(dropdown, result);
    }

    dropdownElement.value = result;

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

    dropdownElement.addEventListener("change", dropdownCallbackFunction, { passive: true });

    for (let option of dropdownElement.options) {
      option.disabled = !element.checked;
    }

    dropdownElement.disabled = !element.checked;
  }

  console.log("setupOptionsListenerById", {option, element, dropdown, dropdownElement});

  return element;
}

export async function onClickedShortcut() {
  await newTab('chrome://extensions/shortcuts');
}

export async function onLoad() {
  await getStorage([
    "follows",
    "Instance",
    "PermissionDeniedInstance",
    "OauthApp"
  ]).then(async result => {
    let instanceLabel = result.Instance;

    if (result.Instance) {
      document.getElementById("instanceTextBox").value = instanceLabel;
      await setupOptionsListenerById("OpenInNewTab", { disabled: false });
      await setupOptionsListenerById("AutoJumpOnLoadStatus", { disabled: false, dropdownDefault: "local" });
      await setupOptionsListenerById("AutoJumpOnLoadAccount", { disabled: false, dropdownDefault: "remote"});
      await setupOptionsListenerById("AutoJumpOnCopyPastePrompt", { disabled: true });
      await setupOptionsListenerById("ReadWriteAll", { disabled: false, callback: ifTrueThenInitializeChromeReadWriteAllOrigin });
      await setupOptionsListenerById("OauthApp", { disabled: false, callback: ifTrueThenInitializeMastodonOauthApp });
      await setupOptionsListenerById("UpdateStats", { disabled: true });
      await setupOptionsListenerById("Following", { disabled: false, default: true  });
      await setupOptionsListenerById("OnClickedToggle", { disabled: false, default: true });
      await setupOptionsListenerById("ContextMenu", { disabled: false, default: true });
      await setupOptionsListenerById("Shortcut", { disabled: false, default: true });

      let shortcutsButtonElement = document.getElementById("shortcutsButton");

      if (shortcutsButtonElement) {
        shortcutsButtonElement.addEventListener("click", onClickedShortcut, { passive: true });
        shortcutsButtonElement.disabled = false;
        shortcutsButtonElement.classList.add("enabled");
        shortcutsButtonElement.classList.remove("disabled");
      }
    }

    if (result.OauthApp) {
      await setupOptionsListenerById("FollowListener", { disabled: false, default: true });
    } else {
      await setupOptionsListenerById("FollowListener", { disabled: true });
    }

    if (result.PermissionDeniedInstance) {
      document.getElementById("instanceLabel").innerHTML =
        permissionRequiredInnerHTML();

    } else if (instanceLabel) {

      if (result.follows) {
        console.log("result.follows", result.follows);

        if (result.follows.content && Object.keys(result.follows.content).length > 0) {
          instanceLabel =
            instanceLabel + "\n(" + Object.keys(result.follows.content).length + ")";
        }
      }

      if (!result.PermissionDeniedInstance) {
        document.getElementById("instanceLabel").innerHTML = instanceLabel;
      }
    }
  });

  let submitButtonElement = document.getElementById("submitButton");

  if (submitButtonElement) {
    submitButtonElement.addEventListener("click", onClicked, { passive: true });
  }

  document.onkeypress = keyPress;
}

document.addEventListener("DOMContentLoaded", onLoad, { passive: true });
