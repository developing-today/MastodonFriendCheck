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
    } catch (e) {
      reject(e);
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
	return "https://" + cleanDomain(url);
}

export async function getInstance() {
  const result = makeHttps(
			await getChromeStorage(["Instance"])
				.then(result => {
					if (result && result.Instance) {
						return result.Instance;
					}
				}));
  console.log(result);
  return result;

}

export async function chromePermissionsToRequest() {
  return {
    host_permissions: [ await getInstance() ]
  };
}

export async function requestPermissions() {
  chrome.permissions.request(
    await chromePermissionsToRequest(),
    (granted) => { // The callback argument will be true if the user granted the permissions.
      if (granted) {
        console.log("WISH GRANTED");
      } else {
        console.log("WISH REJECTED");
      }
    }
  );
}

export async function onPopupLoad() {
  document.onkeypress = keyPress;
  var submitButtonElement = document.getElementById("submitButton");

  await getChromeStorage(["FollowingList", "Instance"]).then(
    (result) => {
      if (result.Instance) {
        var instanceLabel = result.Instance;
        document.getElementById("instanceTextBox").value = instanceLabel;

        if (result.FollowingList) {
          if (result.FollowingList.length > 0) {
            instanceLabel = instanceLabel + "\n(" + result.FollowingList.length + ")";
          }
        }
        document.getElementById("instanceLabel").innerHTML = instanceLabel;
      }
    }
  );

  if (submitButtonElement) {
    submitButtonElement.addEventListener("click", async () => {
      var input = document.getElementById("instanceTextBox").value.trim();
      if (input != "Thanks!" && input != "") {
        var data = {};
        data["Instance"] = input;
        chrome.storage.sync.set(data, async () => {
          await getChromeStorage([
            "FollowingList",
            "Instance",
          ]).then(async (result) => {
            if (result.Instance) {
              document.getElementById("instanceTextBox").value = "Thanks!";

              var instanceLabel = result.Instance;
              if (result.FollowingList) {
                if (result.FollowingList.length > 0) {
                  instanceLabel =
                    instanceLabel + "\n(" + result.FollowingList.length + ")";
                }
              }
              document.getElementById("instanceLabel").innerHTML = instanceLabel;
              await requestPermissions();
            }
          });
        });
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", onPopupLoad);
