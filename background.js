// Copyright (c) 2017 Drewry Pope. All rights reserved.

setInterval(updateFollowingList, 15 * 60 * 1000);

function updateFollowingList()
{
	chrome.storage.sync.get('FullyDesignatedAddress', function(result)
	{
		var input = result.FullyDesignatedAddress;
		var parts;
		var name;
		var domain;
		var url;
		var followingList = [];

		parts = input.split("@");
		name = parts[parts.length - 2];
		domain = "https://" + parts[parts.length - 1];
		url = domain + "/users/" + name + "/following";
		recursiveAddAllFollowing(url);

		function recursiveAddAllFollowing(inputUrl)
		{
			var xmlHttp = new XMLHttpRequest();

			xmlHttp.open('GET', inputUrl);

			xmlHttp.onreadystatechange = function()
			{
				var xml;
				var handle = [];
				var re = /@[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+/;
				var reLocal = /@[a-zA-Z0-0._-]+/;

				if(xmlHttp.readyState === XMLHttpRequest.DONE && xmlHttp.status === 200)
				{
					if (xmlHttp.responseText == "")
					{
						throw new Error("Empty response.");
					}
					xml = (new DOMParser()).parseFromString(xmlHttp.responseText, "text/html");
					for (var i = 1; i < xml.getElementsByClassName("name").length; i++)
					{
						handle.push(String(re.exec(xml.getElementsByClassName("name")[i].childNodes[1].text)));

						if (handle[handle.length - 1] == 'null')
						{
							handle[handle.length - 1] = String(reLocal.exec(xml.getElementsByClassName("name")[i].childNodes[1].text));
						}
					}
					for (var iHandle = 0; iHandle < handle.length; iHandle++)
					{
						var inputParts = handle[iHandle].split("@");

						if (inputParts.length == 3)
						{
							followingList.push("https://" + inputParts[inputParts.length - 1] + "/@" + inputParts[inputParts.length - 2]);
						} else
						{
							followingList.push(domain  + "/@"  + inputParts[inputParts.length - 1]);
						}
					}
					if (xml.getElementsByClassName("next_page disabled").length == 0 && xml.getElementsByClassName("next_page").length != 0)
					{
						var nextPageUrl = domain + xml.getElementsByClassName("next_page")[0].getAttribute("href");
						if (nextPageUrl != 'null' && nextPageUrl != 'undefined') recursiveAddAllFollowing(nextPageUrl);
					}
					else
					{	
						setChromeStorage("FollowingList", followingList);
					}
				}
			};
			xmlHttp.send();
		}
	});
}

function setChromeStorage(name, value)
{	
	var dataObj = {};
	dataObj[name] = value;
	chrome.storage.sync.set(dataObj, function() {});
}