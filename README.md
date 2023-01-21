# MastodonFriendCheck
If you follow a Mastodon Web Profile, it changes "Remote Follow" to "Following"


Features:
- If following, follow button lists following.
- Jump/Toggle Between Local Mastodon Page & Original Mastodon page
  - extension menu clickable action
  - context menu clickable button
  - optional auto-Jump
    - by status or account
    - when local or remote

```


// console.log("content.js", "cache", cache);
// console.log("content.js", "loaded");

/*
following
  this is done using messages between here and the service worker background.js

  on-page load:
    service worker sees page is loaded, it:
  1. Get the current URL
  2. Determine if the URL is a mastodon page, else return
  3. Determine if it's a profile page, else return
  4. Determine if it's a remote profile page, else return
     4.1 must be remote, because local profiles would already have follow status
  5. Get the profile handle from the url

  option 1
  6. Search for the profile handle in the local database
  8. if found, update follow->following on-page
  8. if following, make 'following' button a link to local version of profile page

  option 2
  6. [ already have a cache of all following handles ]
  6.1. a cache may need account access to get the following list
  7. check if handle is in cache
  8. if found, update follow->following on-page
  10. if following, make 'following' button a link to local version of profile page

  option 3
  6. Search for the profile handle in the local database
  7. if found, take the id from the account returned
  8. check following status
  9. if found, update follow->following on-page
  10. if following, make 'following' button a link to local version of profile page


  on-click of the follow button, send a message to the service worker
  1. Get the current URL
  2. Determine if the URL is a mastodon page, else return
  3. Determine if it's a profile page, else return
  4. Determine if it's a remote profile page, else return
  4.1 must be remote, because local profiles would already have follow status
  5. Get the profile handle from the url
  6. Search for the profile handle in the local database
  7. if found, take the id from the account returned
  9.1. update follow->following on-page
  10.1. if following, make 'following' button a link to local version of profile page

*/

/*
stats
  this is done using messages between here and the service worker background.js

  1. Get the current URL
  2. Determine if the URL is a mastodon page, else return
    2.1. Determine if it's a status, it must be a status.
         2.1.1 running these searchs on every post in the feed is infeasiable.
  3. If URL is local,
    3.1. If post is local to local, nothing to do, return.
    3.2. If post is local to remote,
      3.2.1. Get the post ID
      3.2.2. Search for the post ID in the local database
      3.2.3. Take url from returned status
      3.2.4. get post id from url
      3.2.5. search for post id in remote url
      3.2.6. If found, return stats
      3.2.7. update page
  4. If URL is remote,
    If post is local to the given remote, nothing to do, return.
    If post is remote to remote,
      4.1. Get the post ID
      4.2 search for the post ID in the local database
      4.3 Take url from returned status
      4.4 get post id from url
      4.5 search for post id in remote url
      4.6 If found, return stats
      4.7 update page
*/

/*
links
  TODO:
  - make setting for each below
  - when link like "@jack@twitter.com"
     - make it into a hyperlink to https://twitter.com/jack
  - make profile links click to original page
  - make profile handle a link to profile page
    - if local, link to original
    - if remote, link to local
*/

/*

https://mastodon.social/api/v1/accounts/lookup?acct=elonjet

https://mastodon.social/api/v1/accounts/109512940238834674/featured_tags

https://mastodon.social/api/v1/accounts/109512940238834674

https://mastodon.social/api/v1/accounts/109512940238834674/statuses?pinned=true

https://mastodon.social/api/v1/accounts/109512940238834674/statuses?exclude_replies=true

*/


/*
// todo:

----

code redirects based on url

but it can overwhelm api limits

oauth is setup
but access token is untested
and 'follow' and 'list following' logic is not implemented

popup moved to options
but action button is unused sofar

need to add options
jump
  - autojump
  - jump on copypaste
  - manual jump
follow
  - following when following
  - follow button works
- new tab or update current_tab
  - must fix update current tab

improve caching
  cache all url translations ? both ways?
  cache timing / max search calls per minute ___


improve and guarantee tab updates happen in correct window or otherwise always in a new tab.
maybe close current activetab, then open new tab
but that might scare a user and be unreliable


does following list need private access?

create tab vs new tab


----


follow
following
follower
blocked
muted
mutuals

[[2023-01-02 Monday]][[z/2023/01/02]]
<enable extended access for all tabs>
  - you give chaos goblin power? <confirm>
  - fix original page following button as above
    - needs * host permission for content script
    - may need or be easier with oauth for original instance for api
    - may need oauth scope read:follows, read:blocks, read:mutes
  - if you click a link from local mastodon, the numbers are updated to = original page
    - needs * host permission for cors
    - needs fetch to query original instance
  - allow follow button to be clicked and work
    - needs * host permission for content script
    - needs fetch to query original instance
    - needs oauth for original instance for api
    - needs oauth scope write:follows


-----


move oauth app config into settings page separte from initial app

phases
0 no config
1 config mastodon instance, gaet chrome host for instance
  - user must grant permissions
2 config oauth app for instance, get oauth client id and secret,
  - user must grant permissions for oauth app
3 get token
  - user will see redirect url before extension redirects

is there a change scope path without full oauth rebuild?
will dev today actually have to host oauth app?


-----

TODO: if handle, add to app name, add isodate
*/


```
