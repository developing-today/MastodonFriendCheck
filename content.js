// Copyright (c) 2017 Drewry Pope. All rights reserved.

var currentURL = new URL(window.location.href);
var followButton;


function fixFollowButton() {
	chrome.storage.sync.get('FollowingList', function (result) {
		if (result.FollowingList) {
			result.FollowingList.forEach(function(element) {
				let [name, domain] = element.split(",")[0].split("@");

				if (currentURL.host === domain && currentURL.pathname.startsWith(`/@${name}`)) {
					followButton.textContent = "Following";
				}
			});
		}
	});
}

var buttonCheckInterval = setInterval(function() {
	followButton = document.querySelector('.logo-button');
	if (followButton) {
		clearInterval(buttonCheckInterval);
		fixFollowButton();
	}
}, 50);