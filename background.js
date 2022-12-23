// Copyright (c) 2017 Drewry Pope. All rights reserved.
// import './lib.js'

// import { updateFollowingList } from './lib.js';
// redo import with global alias
import * as lib from './lib.js';

const storageCache = { count: 0 };

const initStorageCache = chrome.storage.sync.get().then((items) => {
	Object.assign(storageCache, items);
});

setInterval(lib.updateFollowingList, 5 * 60 * 1000);

chrome.storage.onChanged.addListener((changes, namespace) => {
  for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
    console.log(
      `Storage key "${key}" in namespace "${namespace}" changed.`,
      `Old value was "${oldValue}", new value is "${newValue}".`
    );
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await initStorageCache;
  } catch (e) {
  }
  storageCache.count++;
  storageCache.lastTabId = tab.id;
  chrome.storage.sync.set(storageCache);
});
