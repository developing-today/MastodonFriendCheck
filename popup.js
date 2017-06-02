// Copyright (c) 2017 Drewry Pope. All rights reserved.
document.onkeypress = keyPress;

function keyPress(e){
	var x = e || window.event;
	var key = (x.keyCode || x.which);
	if(key == 13 || key == 3){
		document.getElementById("submitButton").click();
	}
}

document.addEventListener("DOMContentLoaded", function() {
	var submitButtonElement = document.getElementById("submitButton");

	chrome.storage.sync.get(['FollowingList', 'FullyDesignatedAddress'], function(result) {
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
		submitButtonElement.addEventListener("click", function() {
			var input = document.getElementById("userIdTextBox").value.trim();
			if (input != "Thanks!" && input != "") {
				var parts = input.split("@");
				var url = "https://" + parts[parts.length - 1] + "/settings/exports/follows.csv";
				var xmlHttp = new XMLHttpRequest();
				
				xmlHttp.onreadystatechange = function() {
					if(xmlHttp.readyState === XMLHttpRequest.DONE && xmlHttp.status === 200) {
						if (xmlHttp.responseText == "") {
							alert("Error: Empty CSV");
						} else {
							var followingList = xmlHttp.responseText.split("\n")
							followingList.pop()

							setChromeStorage('FollowingList', followingList);
							setChromeStorage('FullyDesignatedAddress', input);

							document.getElementById("userIdLabel").innerHTML= input + "\n(" + followingList.length + ")";
							document.getElementById("userIdTextBox").value="Thanks!";
						}
					} else if (xmlHttp.readyState === XMLHttpRequest.DONE && xmlHttp.status === 401) {
						document.getElementById("userIdLabel").innerHTML= "Could not access followers. Are you logged in?";
					} else if (xmlHttp.readyState === XMLHttpRequest.DONE && xmlHttp.status === 404) {
						document.getElementById("userIdLabel").innerHTML= "Error 404. Did you enter the correct instance domain?";
					} else if (xmlHttp.readyState === XMLHttpRequest.DONE) {
						document.getElementById("userIdLabel").innerHTML= "Unresolved Error. Did you enter the correct information?";
					}
				};
				xmlHttp.open("GET", url);
				xmlHttp.send();
			}
		});
	}
});

function setChromeStorage(name, value) {
	var dataObj = {};
	dataObj[name] = value;
	chrome.storage.sync.set(dataObj, function() {});
}