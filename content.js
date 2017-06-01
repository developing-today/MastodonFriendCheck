// Copyright (c) 2017 Drewry Pope. All rights reserved.

var currentUrl = window.location.href;
var followingList = [];
chrome.storage.sync.get('FollowingList', function (result)
{
	alert(followingList.length)
    if (result.FollowingList != "null") followingList = result.FollowingList;
	alert(followingList.length)

    if (followingList)
    {
		followingList.forEach(function(element)
		{
			if (currentUrl == element)
			{
        alert(element)
				document.getElementsByClassName('button')[0].childNodes[0].nodeValue = "Following";
			}
		});
	}
});