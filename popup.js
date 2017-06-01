// Copyright (c) 2017 Drewry Pope. All rights reserved.

document.addEventListener("DOMContentLoaded", function() {
	var submitButtonElement = document.getElementById("submitButton");

	chrome.storage.sync.get('FullyDesignatedAddress', function(result) {
  	if (result.FullyDesignatedAddress) {
  		name = result.FullyDesignatedAddress;
  		document.getElementById("userIdLabel").innerHTML = result.FullyDesignatedAddress;
  	}

		if (document.getElementById("userIdLabel").innerHTML != "@drewry@social.tchncs.de") {
			document.getElementById("userIdTextBox").value = document.getElementById("userIdLabel").innerHTML;
		}
	});

	if (submitButtonElement) {
		submitButtonElement.addEventListener("click", function() {
			var input = document.getElementById("userIdTextBox").value;
			var parts = input.split("@");
			var name = parts[parts.length - 2];
			var domain = "https://" + parts[parts.length - 1];
			var url = domain + "/settings/exports/follows.csv";
			var xmlHttp = new XMLHttpRequest();
			var followingList = [];
			
			xmlHttp.onreadystatechange = function() {
				if(xmlHttp.readyState === XMLHttpRequest.DONE && xmlHttp.status === 200) {
					if (xmlHttp.responseText == "") {
						throw new Error("Empty response.");
						alert("Empty XML");
					} else {
						followingList = xmlHttp.responseText.split("\n")
						setChromeStorage('FollowingList', followingList);
						setChromeStorage('FullyDesignatedAddress', input);
						document.getElementById("userIdLabel").innerHTML= input;
						document.getElementById("userIdTextBox").value="Thanks!";
						alert("Congratulations on having " + followingList.length + " people you follow!");	
					}
				}
			};
			xmlHttp.open("GET", url);
			xmlHttp.send();
		});
	}
});

function setChromeStorage(name, value) {
	var dataObj = {};
	dataObj[name] = value;
	chrome.storage.sync.set(dataObj, function() {});
}