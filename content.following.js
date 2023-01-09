console.log("content.js following loaded");

/*

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
  8. follow account with id
  9. content receives message:
  9.1. update follow->following on-page
  10.1. if following, make 'following' button a link to local version of profile page


*/
