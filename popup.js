import './lib.js';

document.onkeypress = keyPress;

document.addEventListener("DOMContentLoaded", () => {
	var submitButtonElement = document.getElementById("submitButton");

	getChromeStorage(['FollowingList', 'FullyDesignatedAddress'])
	.then(result => {
		console.log(result);
		if (result.FullyDesignatedAddress) {
			if (result.FullyDesignatedAddress != "@drewry@social.tchncs.de") {
				var userLabel = result.FullyDesignatedAddress
				document.getElementById("userIdTextBox").value = userLabel

				if (result.FollowingList) {
					if (result.FollowingList.length > 0) {
						userLabel = userLabel + "\n(" + result.FollowingList.length + ")";
					}
				}
				document.getElementById("userIdLabel").innerHTML = userLabel;
			}
		}
	});

	if (submitButtonElement) {
		submitButtonElement.addEventListener("click", () => {
			var input = document.getElementById("userIdTextBox").value.trim();
			if (input != "Thanks!" && input != "") {
				var parts = input.split("@");
				var url = makeHttps(parts[parts.length - 1]) + "/api/v1/accounts/1/following";
				var response = fetch(url, { method: 'GET' })
						.then(response => response.json())
						.then(data => {
							if (data == "") {
								alert("Error: Empty CSV");
							} else {
								var followingList = data.split("\n")
								followingList.pop()

								setChromeStorage('FollowingList', followingList);
								setChromeStorage('FullyDesignatedAddress', input);

								document.getElementById("userIdLabel").innerHTML= input + "\n(" + followingList.length + ")";
								document.getElementById("userIdTextBox").value="Thanks!";
							}
						})
						.catch(error => {
							console.log(error);
							if (error.status === 401) {
								document.getElementById("userIdLabel").innerHTML= "Could not access followers. Are you logged in?";
							} else if (error.status === 404) {
								document.getElementById("userIdLabel").innerHTML= "Error 404. Did you enter the correct instance domain?";
							} else {
								document.getElementById("userIdLabel").innerHTML= "Unresolved Error. Did you enter the correct information?";
							}
						});
			}
		});
	}
});

// document.querySelector('#my-button').addEventListener('click', requestPermissions);
