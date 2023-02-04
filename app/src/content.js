let cache = { counter: 0, handlers: {}, ports: {} }

async function sendMessage (message, timestamp) {
  if (cache?.['ports']?.['onLoad']?.isDisconnected) {
    console.log(
      'content.js',
      'sendMessage',
      'port disconnected. not sending message',
      message
    )
    Promise.resolve()
    return
  }

  if (Array.isArray(message)) {
    return Promise.allSettled(
      message.map(message => sendMessage(message, timestamp))
    )
  }

  let messageObject = { content: message }

  if (timestamp) {
    if (timestamp.group) {
      Object.assign(messageObject, {
        group: timestamp.group,
        timestamp: timestamp.timestamp
      })
    } else {
      Object.assign(messageObject, { timestamp: timestamp.timestamp })
    }
  } else {
    Object.assign(messageObject, { timestamp: Date.now() })
  }

  if (message.type) {
    Object.assign(messageObject, { type: message.type })
  }

  if (!messageObject.type) {
    console.log('content.js', 'no message type', messageObject)

    if (typeof message === 'string') {
      console.log(
        'content.js',
        'message is string. setting message type to message',
        { messageObject, message }
      )
      messageObject.type = message
    } else {
      console.log(
        'content.js',
        'message is not string. leaving message type unset.',
        { messageObject, message }
      )
    }
  }
  console.log('content.js', 'sending message', messageObject)

  try {
    await chrome.runtime.sendMessage(messageObject)
  } catch (error) {
    console.log('content.js', 'sendMessage', 'error', error)
  }
  Promise.resolve()
}

function getCallbackTimestamp (group, callback) {
  let timestamp = Date.now()
  let object = cache

  if (group) {
    if (
      cache[group] === undefined ||
      cache[group] === null ||
      typeof cache[group] !== 'object' ||
      Array.isArray(cache[group])
    ) {
      cache[group] = { counter: 0 }
    }
    object = cache[group]
  }
  console.log('content.js', 'getCallbackTimestamp', 'got callback timestamp', {
    group,
    timestamp,
    callback
  })

  if (
    object[timestamp] === undefined ||
    object[timestamp] === null ||
    typeof object[timestamp] !== 'object' ||
    Array.isArray(object[timestamp])
  ) {
    object[timestamp] = {}
  }

  object[timestamp].callback = callback
    ? callback
    : function (result) {
        console.log(
          'content.js',
          'defaultCallback_getCallbackTimestamp',
          'got result',
          { result }
        )
      }
  console.log('content.js', 'getCallbackTimestamp', 'got callback timestamp', {
    group,
    timestamp,
    callback
  })

  if (group) {
    console.log('content.js', 'getCallbackTimestamp', 'returning with group', {
      group,
      timestamp,
      callback
    })
    Object.assign(cache[group], object)
    // cache[group]?.counter++;
    // cache.counter++;
    return { group, timestamp }
  } else {
    console.log(
      'content.js',
      'getCallbackTimestamp',
      'returning without group',
      { group, timestamp, callback }
    )
    Object.assign(cache, object)
    // cache.counter++;
    return { timestamp }
  }
}

async function onMessage (message) {
  console.log('content.js', 'onMessage', 'got message', message)
  if (Array.isArray(message)) {
    return Promise.allSettled(message.map(onMessage))
  }

  if (message.type) {
    if (message.type === 'echoRequest') {
      sendMessage({ type: 'echoResponse', content: message.content })
    } else {
      console.log('content.js', 'onMessage', 'no message type found', message)
    }
  }

  if (message.timestamp) {
    if (
      message.group &&
      cache[message.group] &&
      cache[message.group][message.timestamp] &&
      cache[message.group][message.timestamp]?.callback &&
      typeof cache[message.group][message.timestamp]?.callback === 'function'
    ) {
      await cache[message.group][message.timestamp]?.callback(message)
    } else if (
      cache[message.timestamp] &&
      cache[message.timestamp]?.callback &&
      typeof cache[message.timestamp]?.callback === 'function'
    ) {
      await cache[message.timestamp]?.callback(message)
    } else {
      console.log('content.js', 'onMessage', 'no callback for message', message)
    }
  }

  return Promise.resolve()
}

function fixFollowButton (button, url) {
  console.log(
    'content.js',
    'fixFollowButton',
    'fixing follow button',
    button,
    url
  )

  let buttonA = document.createElement('a')
  buttonA.href = url
  buttonA.innerHTML = 'Following'

  button.classList.forEach(className => {
    buttonA.classList.add(className)
  })
  button.innerHTML = buttonA.outerHTML

  button.addEventListener(
    'click',
    function (event) {
      console.log(
        'content.js',
        'fixFollowButton',
        'follow button clicked',
        event
      )
      window.open(url, '_self')
    },
    { passive: true }
  )
}

function addFollowListener (button, url) {
  console.log(
    'content.js',
    'addFollowListener',
    'adding follow listener',
    button,
    url
  )

  button.addEventListener(
    'click',
    function (event) {
      console.log('content.js', 'handleMessage', 'follow button clicked', event)
      event.preventDefault()
      event.stopPropagation()
      button.innerHTML = 'Follow...'
      sendMessage(
        { type: 'follow', url },
        getCallbackTimestamp('follow', function (result) {
          console.log(
            'content.js',
            'addFollowListener',
            'got follow result',
            result
          )

          if (
            result.type === 'following' &&
            (!result.content || !('error' in result.content))
          ) {
            fixFollowButton(button, url)
          } else {
            console.log(
              'content.js',
              'addFollowListener',
              'got unexpected result',
              result
            )
          }
        })
      )
    },
    { passive: false }
  )
  console.log(
    'content.js',
    'addFollowListener',
    'added follow listener',
    button,
    url
  )
}

async function findFollowButton (url, callback, settings) {
  if (!settings) {
    settings = {}
  }

  let timeoutInSeconds = settings.timeoutInSeconds || 15
  let querySelector = settings.querySelector || '.logo-button'
  let timeNow = Date.now()

  let buttonCheckInterval = setInterval(function () {
    button = document.querySelector(querySelector)

    if (button) {
      console.log('content.js', 'handleMessage', 'found follow button', {
        button,
        url,
        callback,
        settings,
        querySelector,
        timeoutInSeconds
      })
      clearInterval(buttonCheckInterval)
      callback(button, url)
    }

    if (Date.now() - timeNow > timeoutInSeconds * 1000) {
      console.log('content.js', 'handleMessage', 'follow button not found', {
        button,
        url,
        callback,
        settings,
        querySelector,
        timeoutInSeconds
      })
      clearInterval(buttonCheckInterval)
    }
  }, 50)
}

async function applyHandlers (result) {
  console.log('content.js', 'handleMessage', 'onConnect', 'applying handlers', {
    result
  })

  return Promise.allSettled(
    (cache['handlers']?.[result?.name] ?? [])?.map(handler => {
      console.log(
        'content.js',
        'handleMessage',
        'onConnect',
        'calling handler',
        { type, url, result, handler }
      )
      return handler(result)
    })
  )
}

async function handleMessage (result) {
  let type = result.type
  let url = result.content.url

  applyHandlers(type, result)

  if (type && url) {
    if (type === 'open') {
      console.log('content.js', 'handleMessage', 'open', url)
      window.open(url, '_self')
    } else if (type === 'following') {
      console.log('content.js', 'handleMessage', 'following', url)

      findFollowButton(url, fixFollowButton, result)
    } else if (type === 'addFollowListener') {
      console.log(
        'content.js',
        'handleMessage',
        'not following',
        'addFollowListener',
        url
      )

      findFollowButton(url, addFollowListener, result)
    } else {
      console.log('content.js', 'handleMessage', 'no url type found', {
        type,
        url,
        result
      })
    }
  } else if (type) {
    console.log('content.js', 'handleMessage', 'no url', { type, url, result })

    if (type === 'addFollowListener') {
      console.log('content.js', 'handleMessage', 'not following', url)

      findFollowButton(window.location.href, addFollowListener, result)
    } else if (type === 'onConnect') {
      // ports
      console.log('content.js', 'handleMessage', 'onConnect', {
        type,
        url,
        result
      })
      if (result?.name) {
        console.log('content.js', 'handleMessage', 'onConnect', {
          type,
          url,
          result
        })

        applyHandlers(result.name, result)
      } else {
        console.log('content.js', 'handleMessage', 'onConnect', 'no name', {
          type,
          url,
          result
        })
      }
    } else {
      console.log('content.js', 'handleMessage', 'no url type found', {
        type,
        url,
        result
      })
    }
  } else {
    console.log('content.js', 'handleMessage', 'no type', { type, url, result })
  }

  console.log('content.js', 'handleMessage', 'result', result)
  return Promise.resolve()
}

async function onLoadResult (result) {
  console.log('content.js', 'onLoadResult', 'got onLoad result', result)

  if (Array.isArray(result)) {
    await Promise.allSettled(result.content.map(handleMessage))
  } else {
    await handleMessage(result)
  }

  console.log('content.js', 'onLoadResult', 'result', result)
  return Promise.resolve()
}

function isConnected (port, isConnected) {
  if (port?.name) {
    cache['ports'][port.name] = port
    cache['ports'][port.name].isDisconnected = !isConnected
    console.log('content.js', 'isConnected', 'port name', { port, isConnected })
  } else {
    console.log('content.js', 'isConnected', 'no port name', port)
  }
}

function onDisconnect (port) {
  console.log('content.js', 'onDisconnect', 'cleaning up on disconnect', {
    port,
    this: this
  })
  isConnected(port, false)
}

function onConnect (port) {
  console.log('content.js', 'onConnect', port)
  isConnected(port, true)

  if (port?.onMessage) {
    port.onMessage.addListener(function (message) {
      console.log('content.js', 'onConnect', 'port.onMessage', {
        port,
        message,
        this: this
      })
      handleMessage(message)
    })
  }

  if (port?.onDisconnect) {
    port.onDisconnect.addListener(onDisconnect)
  }

  handleMessage({ type: 'onConnect', port: port.name })
}

function setupUrlCheckInterval () {
  let url = window.location.href
  let timeNow = Date.now()

  let urlCheckInterval = setInterval(function () {
    console.log('content.js', 'checking url', {
      url,
      href: window.location.href
    })

    if (Date.now() - timeNow > 30 * 60 * 1000) {
      clearInterval(urlCheckInterval)
    }

    if (window.location.href !== url) {
      console.log('content.js', 'url changed', {
        url,
        href: window.location.href
      })
      clearInterval(urlCheckInterval)
      onLoad()
    }
  }, 50)
}

async function onLoadHandler (input) {
  console.log('content.js', 'onLoadHandler', 'input', input)
  await sendMessage(
    { type: 'onLoad' },
    getCallbackTimestamp('onLoad', onLoadResult)
  )
}

function onLoad () {
  console.log('content.js', 'onLoad', window.location.href)
  chrome.runtime.connect(null, { name: 'onLoad' })
  onLoadHandler()
  setupUrlCheckInterval()
}

function defaultHandler (input) {
  return cache?.['handlers']?.['default'](input)
}

cache['handlers'] = {
  onLoad: [onLoadHandler],
  following: [input => defaultHandler({ type: 'following', input })],
  followHandler: [input => defaultHandler({ type: 'followHandler', input })],
  default: [
    input =>
      console.log('content.js', 'default', 'handler', JSON.stringify(input))
  ]
}

chrome.runtime.onConnect.addListener(onConnect)
chrome.runtime.onMessage.addListener(onMessage)

onLoad()
console.log('content.js', 'loaded', window.location.href)
// TODO autojump .copypaste prompt
