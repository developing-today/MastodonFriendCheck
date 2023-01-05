console.log("content.js stats loaded");

/*
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
