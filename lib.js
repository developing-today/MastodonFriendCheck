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

export function chromePermissionsToRequestForInstanceSearch(instance) {
  return chromePermissionsToRequest(instance, 'api/v2/search');
  // api/v2/search
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

export async function setChromeStorageWithObject(object) {
	return new Promise((resolve, reject) => {
		try {
			chrome.storage.sync.set(object, () => { resolve(); });
		} catch (error) {
			reject(error);
		}
	});
}

export async function setChromeStorage(name, value) {
		var object = {};
		object[name] = value;
		return setChromeStorageWithObject(object);
}

export async function onPopupLoad() {
	console.log("HI");
  document.onkeypress = keyPress;
  var submitButtonElement = document.getElementById("submitButton");

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

  if (submitButtonElement) {
    submitButtonElement.addEventListener("click", async () => {
      var input = document.getElementById("instanceTextBox").value.trim();
      if (input && input != "Thanks!") {
        await requestPermissions(
          await chromePermissionsToRequestForInstanceApp(input)
        ).then(async () => {
          console.log("Permission Request Granted");
          let object = {};
          object["Instance"] = input;
          object["PermissionDeniedInstance"] = false;
          await setChromeStorageWithObject(object
          ).then(async () => {
            await getChromeStorage(["FollowingList","Instance"]
          ).then(async (result) => {
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
            });
          });
        }).catch(async () => {
          console.log("Permission Request Denied.");
          await setChromeStorage("PermissionDeniedInstance", true)
          document.getElementById("instanceLabel").innerHTML = permissionRequiredInnerHTML;
        });
      }
    });
  }
}

// export function stripHandle(handle) {
//   if (handle.toString().includes('@')) {
//     const handleSplit = handle.split('@');
//     return handleSplit[handleSplit.length - 1];
//   } else {
//     return handle;
//   }
// }

// export function cleanDomain(domain) {
// 	let cleanDomain = stripHandle(domain).replace("https://", "").replace("http://", "");
//   if (cleanDomain.includes('/')) {
//     return cleanDomain.split('/')[0];
//   } else {
//     return cleanDomain;
//   }
// }

// export function makeHttps(url) {
// 	return "https://" + cleanDomain(url);
// }

// export function keyPress(e){
// 	var x = e || window.event;
// 	var key = (x.keyCode || x.which);
// 	if(key == 13 || key == 3){
// 		document.getElementById("submitButton").click();
// 	}
// }

export function updateFollowingList() {
	console.log("hello");
}
// 	chrome.storage.sync.get('Instance', function(result) {
// 		var parts = result.Instance.split("@");
// 		var url = "https://" + parts[parts.length - 1] + "/settings/exports/follows.csv";
// 		var xmlHttp = new XMLHttpRequest();

// 		xmlHttp.onreadystatechange = function() {
// 			if(xmlHttp.readyState === XMLHttpRequest.DONE && xmlHttp.status === 200) {
// 				if (xmlHttp.responseText == "") {
// 					throw new Error("Empty response.");
// 				} else {
// 					setChromeStorage('FollowingList', (xmlHttp.responseText.split("\n").pop()));
// 				}
// 			}
// 		};
// 		xmlHttp.open("GET", url);
// 		xmlHttp.send();
// 	});
// }

// export function onStorageChange(changes, namespace) {
//   for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
//     console.log(
//       `Storage key "${key}" in namespace "${namespace}" changed.`,
//       `Old value was "${oldValue}", new value is "${newValue}".`
//     );
//   }
// }

// export async function setChromeStorageWithDict(dict) {
// 	return new Promise((resolve, reject) => {
// 		try {
// 			chrome.storage.sync.set(dict, () => { resolve(dict); });
// 		} catch (e) {
// 			reject(e);
// 		}
// 	});
// }

// export async function setChromeStorage(name, value) {
// 	return new Promise((resolve, reject) => {
// 		var data = {};
// 		data[name] = value;
// 		setChromeStorageWithDict(chrome, data);
// 	});
// }

// export async function getChromeStorage(keys) {
// 	return new Promise((resolve, reject) => {
// 		try {
// 			chrome.storage.sync.get(keys, result => { resolve(result); });
// 		} catch (e) {
// 			reject(e);
// 		}
// 	});
// }

// export async function getInstance(defaultDomain) {
//   return
// 		makeHttps(
// 			getChromeStorage(["Instance"])
// 				.then(result => {
// 					if (result && result.Instance) {
// 						return result.Instance;
// 					} else {
// 						return defaultDomain;
// 					}
// 				})
// 				.catch(error => {
// 					console.error('Error:', error);
// 					return defaultDomain;
// 				}));
// }

// export async function chromePermissionsToRequest() {
//   return {
//     host_permissions: [ await getInstance() ]
//   };
// }

// export async function makeApp() {
// 	const formData = new FormData();
// 	formData.append('client_name', 'Mastodon Friend Checker');
// 	formData.append('redirect_uris', 'urn:ietf:wg:oauth:2.0:oob');
// 	formData.append('scopes', 'write:follows');
// 	formData.append('website', 'https://developing.today/mastodon-friend-checker');

// 	return fetch(await getInstance() + '/api/v1/apps', {
// 		method: 'POST',
// 		body: formData
// 	})
// 	.then(result => {
// 		console.log('Success:', result);
// 		return result;
// 	})
// 	.catch(error => {
// 		console.error('Error:', error);
// 		return null;
// 	});
// }

// export async function getAccessToken() {
// 	const formData = new FormData();
// 	// TODO:
// }

// export async function search(query, limit=1) {
// 	return fetch(
// 		[
// 			await getInstance(),
// 			"api/v2/search?q=",
// 			query,
// 			"&resolve=true&limit=" + limit
// 		].join("")
// 	)
// 	.then(result => result.json())
// 	.then(result => {
// 		console.log(result);
// 		return res;
// 	})
// 	.catch(function() {
// 		console.log("Error");
// 		return null;
// 	});
// }

// export async function getAccountIdByHandle(handle) {
// 	let vals = handle.trim("@").split("@")
// 	return getAccountId(vals[0], vals[1])
// }

// export async function getAccountId(username, domain) {
// 	return search(makeHttps(domain) + "/@" + username, 1)
// 	.then(result => {
// 		console.log(JSON.stringify(result))
// 		return result.accounts[0].id;
// 	})
// }

// export async function getFollowingList(id) {
// 	return fetch(await getInstance() + "/api/v1/accounts/" + id + "/following", { method: "GET" })
// 	.then(result => result.json())
//   .then(result => {
//     console.log(JSON.stringify(result))
//   })
//   .catch(function() {
//   });
// }

// export async function checkPageAgainstFollowingList() {
// 	var currentUrl = window.location.href;
// 	await getChromeStorage('FollowingList').then((result) => {
// 		if (result.FollowingList) {
// 			result.FollowingList.forEach(function(element) {
// 				var parts = element.split("@");
// 				var name = parts[parts.length - 2];
// 				var domain = parts[parts.length - 1];

// 				if (currentUrl.includes(domain) && (currentUrl.includes("@" + name) || currentUrl.includes("users/" + name + "/"))) {
// 					document.getElementsByClassName('button')[0].childNodes[0].nodeValue = "Following";
// 				}
// 			});
// 		}
// 	});
// }

// export async function onPopupLoad() {
// 	document.onkeypress = keyPress;
// 	var submitButtonElement = document.getElementById("submitButton");

// 	await getChromeStorage(['FollowingList', 'Instance'])
// 	.then(result => {
// 		console.log(result);
// 		if (result.Instance) {
// 			if (result.Instance != "@drewry@social.tchncs.de") {
// 				var userLabel = result.Instance
// 				document.getElementById("instanceTextBox").value = userLabel

// 				if (result.FollowingList) {
// 					if (result.FollowingList.length > 0) {
// 						userLabel = userLabel + "\n(" + result.FollowingList.length + ")";
// 					}
// 				}
// 				document.getElementById("instanceLabel").innerHTML = userLabel;
// 			}
// 		}
// 	});

// 	if (submitButtonElement) {
// 		submitButtonElement.addEventListener("click", () => {
// 			var input = document.getElementById("instanceTextBox").value.trim();
// 			if (input != "Thanks!" && input != "") {
// 				setChromeStorage('Instance', input);
// 				var parts = input.split("@");
// 				var url = makeHttps(parts[parts.length - 1]) + "/api/v1/accounts/1/following";
// 				var response = fetch(url, { method: 'GET' })
// 					.then(response => response.json())
// 					.then(data => {
// 						if (data == "") {
// 							alert("Error: Empty CSV");
// 						} else {
// 							var followingList = data.split("\n")
// 							followingList.pop()

// 							setChromeStorage('FollowingList', followingList);
// 							setChromeStorage('Instance', input);

// 							document.getElementById("instanceLabel").innerHTML= input + "\n(" + followingList.length + ")";
// 							document.getElementById("instanceTextBox").value="Thanks!";
// 						}
// 					})
// 					.catch(error => {
// 						console.log(error);
// 						if (error.status === 401) {
// 							document.getElementById("instanceLabel").innerHTML= "Could not access followers. Are you logged in?";
// 						} else if (error.status === 404) {
// 							document.getElementById("instanceLabel").innerHTML= "Error 404. Did you enter the correct instance domain?";
// 						} else {
// 							document.getElementById("instanceLabel").innerHTML= "Unresolved Error. Did you enter the correct information?";
// 						}
// 					});
// 			}
// 		});
// 	}
// }

// // export async function requestPermissions() {
// //   function onResponse(response) {
// //     if (response) {
// //       console.log("Permission was granted");
// //     } else {
// //       console.log("Permission was refused");
// //     }
// //     return browser.permissions.getAll();
// //   }
// //   const response = await browser.permissions.request(chromePermissionsToRequest);
// //   const currentPermissions = await onResponse(response);
// //   console.log(`Current permissions:`, currentPermissions);
// // }

// // export async function requestPermissions (event) {
// //   // Permissions must be requested from inside a user gesture, like a button's
// //   // click handler.
// //   chrome.permissions.request({
// //     permissions: ['tabs'],
// //     origins: ['https://www.google.com/']
// //   }, (granted) => {
// //     // The callback argument will be true if the user granted the permissions.
// //     if (granted) {
// //       doSomething();
// //     } else {
// //       doSomethingElse();
// //     }
// //   });
// // }

// // Extension permissions are:
// // "webRequest", "tabs", "*://*.mozilla.org/*"
// // let testPermissions1 = {
// //   origins: ["*://mozilla.org/"],
// //   permissions: ["tabs"]
// // };
// // const testResult1 = await browser.permissions.contains(testPermissions1);
// // console.log(testResult1); // true
// // chrome.permissions.contains({
// //   permissions: ['tabs'],
// //   origins: ['https://www.google.com/']
// // }, (result) => {
// //   if (result) {
// //     // The extension has the permissions.
// //   } else {
// //     // The extension doesn't have the permissions.
// //   }
// // });
// // chrome.permissions.remove({
// //   permissions: ['tabs'],
// //   origins: ['https://www.google.com/']
// // }, (removed) => {
// //   if (removed) {
// //     // The permissions have been removed.
// //   } else {
// //     // The permissions have not been removed (e.g., you tried to remove
// //     // required permissions).
// //   }
// // });
// // chrome.action.onClicked.addListener((tab) => {
// //   if(!tab.url.includes("chrome://")) {
// //     // chrome.scripting.executeScript({
// //     //   target: { tabId: tab.id },
// //     //   function: reddenPage
// //     // });
// //     var copy = document
// //         .querySelector(".copypaste > input");
// //     var x = copy ? copy.value : window.location.href;
// //     var y = cleanDomain(x).split('/');
// // 		if (y.length < 3) {
// // 			window.location.href = [await getInstance(), y[1], "@", y[0], z].join("");
// //     } else {
// // 			await search(x);
// // 			// TODO:
// //     }
// //   }
// // });
