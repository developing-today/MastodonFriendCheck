// Copyright (c) 2017 Drewry Pope. All rights reserved.
import './lib.js';

var currentUrl = window.location.href;

// TODO: use lib
chrome.storage.sync.get('FollowingList', function (result) {
	if (result.FollowingList != "null") {
		result.FollowingList.forEach(function(element) {
			var parts = element.split("@");
			var name = parts[parts.length - 2];
			var domain = parts[parts.length - 1];

			if (currentUrl.includes(domain) && (currentUrl.includes("@" + name) || currentUrl.includes("users/" + name + "/"))) {
				document.getElementsByClassName('button')[0].childNodes[0].nodeValue = "Following";
			}
		});
	}
});

//TODO: probably needs scripting permissions wildcard or something
