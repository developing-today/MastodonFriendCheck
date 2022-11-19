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
	chrome.storage.sync.get('FullyDesignatedAddress', function(result) {
		let parts = result.FullyDesignatedAddress.split("@");
		let domain = parts[parts.length - 1];
		let user = currentURL.pathname.match(/\/@(\w+)/)[1];
		let url = `https://${domain}/@${user}@${currentURL.host}`;
		followButton.addEventListener("click", function (event) {
			window.location.href = url;
			event.preventDefault();
			event.stopPropagation();
		});
	});
}

var buttonCheckInterval = setInterval(function() {
	followButton = document.querySelector('.logo-button');
	if (followButton) {
		clearInterval(buttonCheckInterval);
		fixFollowButton();
	}
}, 50);