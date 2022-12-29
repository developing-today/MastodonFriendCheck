export const permissionRequiredInnerHTML = "Permission required.<br>Please try again."

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
      chrome.storage.sync.get(keys, (result) => {
        resolve(result);
      });
    } catch (error) {
      reject(error);
    }
  });
}

export function stripHandle(handle) {
  if (handle.toString().includes('@')) {
    const handleSplit = handle.split('@');
    return handleSplit[handleSplit.length - 1];
  } else {
    return handle;
  }
}

export function cleanDomain(domain) {
	let cleanDomain = stripHandle(domain).replace("https://", "").replace("http://", "");
  if (cleanDomain.toString().includes('/')) {
    return cleanDomain.split('/')[0];
  } else {
    return cleanDomain;
  }
}

export function makeHttps(url) {
	return "https://" + cleanDomain(url) + "/";
}

export async function getInstance() {
  return makeHttps(
			await getChromeStorage(["Instance"])
				.then(result => {
					if (result && result.Instance) {
						return result.Instance;
					}
				}));
}

export function chromePermissionsToRequest(instance, query = "*") {
  return {
    origins: [ makeHttps(instance) + query ]
  };
}

export async function chromePermissionsToRequestForInstanceApp(instance) {
  return chromePermissionsToRequest(instance, 'api/v*/*');
  // api/v1/apps
  // api/v1/accounts/<id>/following
  // api/v1/accounts/<id>/follow
}

export async function requestPermissions(permissions) {
  return new Promise((resolve, reject) => {
    try {
      chrome.permissions.request(permissions, (result) => {
        if (result) {
          resolve();
        } else {
          reject()
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
			chrome.storage.sync.set(object, () => { resolve(); });
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

export async function makeApp() {
  const url = new URL(await getInstance() + 'api/v1/apps')
	const formData = new FormData();
	formData.append('client_name', 'Mastodon Friend Checker');
	formData.append('redirect_uris', 'urn:ietf:wg:oauth:2.0:oob');
	formData.append('scopes', 'write:follows'); // read:search read:follows
	formData.append('website', 'https://src.developing.today/mastodon-friend-checker');

	return fetch(url, {
		method: 'POST',
		body: formData
	})
  .then(result => result.json())
	.then(result => {
    console.log('Success:', result);
		return result;
	})
  // .then(result => { delete result.client_secret; return result })
	.then(setChromeStorage)
	.catch(error => {
		console.error('Error:', error);
		return null;
	});
}

export async function search(query, limit=1) {
  console.log("QUERY:" + query);
  let instance = await getInstance();
  let url = new URL(instance + "api/v2/search")
  url.searchParams.append('q', query);
  url.searchParams.append('resolve', true);
  url.searchParams.append('limit', limit);
  console.log(JSON.stringify(url));
  return fetch(url)
	.then(result => result.json())
	.then(result => {
		console.log(result);
		return result;
	});
}

export async function getStatusId(query) {
  return search(query)
	.then(result => {
    console.log(JSON.stringify(result))
    if (result.accounts) {
  		return result.statuses[0].id;
    }
    // TODO: return obj with id and instance
	})
}

export async function getAccountId(query) {
  return search(query)
	.then(result => {
    console.log(JSON.stringify(result))
    if (result.accounts) {
  		return result.accounts[0].id;
    }
	})
  // TODO: return obj with id and instance
}

export async function getAccountIdByHandle(handle) {
  let trimHandle = handle;
  while(trimHandle.charAt(0) === '@')
  {
    trimHandle = trimHandle.substring(1);
  }
  let vals = trimHandle.split("@")
  return getAccountId("https://" + vals[vals.length - 1] + "/" + "@" + vals[0])
}

export async function follow(id) {
  let url = new URL(await getInstance() + '/api/v1/accounts/' + id + '/follow')
  const formData = new FormData();
  return fetch(url, {
    method: 'POST',
    body: formData,
    headers: {
      'Authorization': 'Bearer ' + await activeToken()
    }
  })
  .then(response => response.json())
  .then(result => {
    console.log('Success:', result);
		return result;
  });
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
  await setChromeStorageWithProperty("PermissionDeniedInstance", true)
  document.getElementById("instanceLabel").innerHTML = permissionRequiredInnerHTML;
}

export async function permissionGrantedInstance(input) {
  setChromeStorage({
    "Instance": input,
    "PermissionDeniedInstance": false
  })
  .then(() => { return getChromeStorage(["FollowingList","Instance"]) })
  .then(onResult);
}

export async function onClick() {
  var input = document.getElementById("instanceTextBox").value.trim();
  if (input && input != "Thanks!") {
    requestPermissions(
      await chromePermissionsToRequestForInstanceApp(input)
    ).then(async () => {
      await permissionGrantedInstance(input)
      .then(async () => {
        console.log("Making App");
        await makeApp();
        console.log("App Done");
      });
    })
    .catch(permissionDeniedInstance);
  }
}

export async function onClickFollow() {
  var input = document.getElementById("instanceTextBox").value.trim();
  if (input && input != "Thanks!") {
    console.log(await getStatusId(input));
  }
  console.log("Done");
}

export async function onLoad() {
  await getChromeStorage(["FollowingList", "Instance", "PermissionDeniedInstance"]).then(
    (result) => {
      var instanceLabel = result.Instance
      if (instanceLabel) {
        document.getElementById("instanceTextBox").value = instanceLabel;
      }
      if (result.PermissionDeniedInstance) {
        document.getElementById("instanceLabel").innerHTML = permissionRequiredInnerHTML;
      } else {
        if (result.FollowingList) {
          if (result.FollowingList.length > 0) { // TODO: isArray
            instanceLabel = instanceLabel + "\n(" + result.FollowingList.length + ")";
          }
        }
        if (!result.PermissionDeniedInstance) {
          document.getElementById("instanceLabel").innerHTML = instanceLabel;
        }
      }
    }
  );
  var submitButtonElement = document.getElementById("submitButton");
  if (submitButtonElement) {
    submitButtonElement.addEventListener("click", onClickFollow);
  }
  document.onkeypress = keyPress;
}

document.addEventListener("DOMContentLoaded", onLoad)
