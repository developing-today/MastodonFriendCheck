// Copyright (c) 2017 Drewry Pope. All rights reserved.

setInterval(updateFollowingList, 5 * 60 * 1000);

function updateFollowingList() {
	chrome.storage.sync.get('FullyDesignatedAddress', function(result) {
		var parts = result.FullyDesignatedAddress.split("@");
		var url = "https://" + parts[parts.length - 1] + "/settings/exports/follows.csv";
		var xmlHttp = new XMLHttpRequest();

		xmlHttp.onreadystatechange = function() {
			if(xmlHttp.readyState === XMLHttpRequest.DONE && xmlHttp.status === 200) {
				if (xmlHttp.responseText == "") {
					throw new Error("Empty response.");
				} else {
					setChromeStorage('FollowingList', (xmlHttp.responseText.split("\n").pop()));
				}
			}
		};
		xmlHttp.open("GET", url);
		xmlHttp.send();
	});
}

function setChromeStorage(name, value) {
	var dataObj = {};
	dataObj[name] = value;
	chrome.storage.sync.set(dataObj, function() {});
}
