let cache = { counter: 0, handlers: {}, ports: {} }

function isDebug () {
  return !('update_url' in chrome.runtime.getManifest())
}
let isDebugMode = isDebug()

function normalizeLine (line) {
  let cleanLine = line.replace(/^\s+at\s+/, '') // remove "at" and surrounding whitespace

  let functionName = cleanLine.split(' ')[0]
  let [file, linePosition, columnPosition] = cleanLine.split(':').slice(1)

  file = (file || '').split('/').slice(-1)[0]
  linePosition = parseInt((linePosition || '').replace(/\D/g, '')) // remove non-digits
  columnPosition = parseInt((columnPosition || '').replace(/\D/g, '')) // remove non-digits

  let position = linePosition + ':' + columnPosition

  return {
    function: functionName,
    file,
    line: linePosition,
    column: columnPosition,
    position,
    href: window?.location?.href
  }
}

function logWithLevel (level, ...args) {
  if (isDebugMode) {
    //See https://stackoverflow.com/a/27074218/470749
    var e = new Error()
    if (!e.stack) {
      try {
        // IE requires the Error to actually be thrown or else the
        // Error's 'stack'property is undefined.
        throw e
      } catch (e) {
        if (!e.stack) {
          //return 0; // IE < 10, likely
        }
      }
    }
    var stack = e.stack.toString().split(/\r\n|\n/)

    stack.shift() // "Exception"
    stack.shift() // "logWithLevel"
    stack.shift() // "log"

    stack = stack.map(normalizeLine)

    let metadata = { level, stack, ...stack[0] }
    let caller =
      metadata.function.indexOf('/') === -1 ? metadata.function : metadata.file
    Object.assign(metadata, { args })
    let short = { '|': metadata }
    short[caller] = metadata.line
    console.log(short, ...args)
  }
}

function log (...args) {
  logWithLevel('LOG', ...args)
}

function error (...args) {
  logWithLevel('ERROR', ...args)
}

async function sendMessage (message, timestamp) {
  if (cache?.['ports']?.['onLoad']?.isDisconnected) {
    log('port disconnected. not sending message', message)
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
    log('no message type', messageObject)

    if (typeof message === 'string') {
      log('message is string. setting message type to message', {
        messageObject,
        message
      })
      messageObject.type = message
    } else {
      log('message is not string. leaving message type unset.', {
        messageObject,
        message
      })
    }
  }
  log('sending message', messageObject)

  try {
    await chrome.runtime.sendMessage(messageObject)
  } catch (e) {
    error(e)
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
  log('got callback timestamp', {
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
        log(
          'content.js',
          'defaultCallback_getCallbackTimestamp',
          'got result',
          { result }
        )
      }
  log('got callback timestamp', {
    group,
    timestamp,
    callback
  })

  if (group) {
    log('returning with group', {
      group,
      timestamp,
      callback
    })
    Object.assign(cache[group], object)
    // cache[group]?.counter++;
    // cache.counter++;
    return { group, timestamp }
  } else {
    log('returning without group', {
      group,
      timestamp,
      callback
    })
    Object.assign(cache, object)
    // cache.counter++;
    return { timestamp }
  }
}

async function onMessage (message) {
  log('got message', message)
  if (Array.isArray(message)) {
    return Promise.allSettled(message.map(onMessage))
  }

  if (message.type) {
    if (message.type === 'echoRequest') {
      sendMessage({ type: 'echoResponse', content: message.content })
    } else {
      log('no message type found', message)
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
      log('no callback for message', message)
    }
  }

  return Promise.resolve()
}

function fixFollowButton (button, url) {
  log('fixing follow button', button, url)

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
      log('follow button clicked', event)
      window.open(url, '_self')
    },
    { passive: true }
  )
}

function addFollowListener (button, url) {
  log('adding follow listener', button, url)

  button.addEventListener(
    'click',
    function (event) {
      log('follow button clicked', event)
      event.preventDefault()
      event.stopPropagation()
      button.innerHTML = 'Follow...'
      sendMessage(
        { type: 'follow', url },
        getCallbackTimestamp('follow', function (result) {
          log('got follow result', result)

          if (
            result.type === 'following' &&
            (!result.content || !('error' in result.content))
          ) {
            fixFollowButton(button, url)
          } else {
            log(
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
  log('added follow listener', button, url)
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
      log('found follow button', {
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
      log('follow button not found', {
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
  log('applying handlers', {
    result
  })

  return Promise.allSettled(
    (cache['handlers']?.[result?.name] ?? [])?.map(handler => {
      log('calling handler', {
        type,
        url,
        result,
        handler
      })
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
      log('open', url)
      window.open(url, '_self')
    } else if (type === 'following') {
      log('following', url)

      findFollowButton(url, fixFollowButton, result)
    } else if (type === 'addFollowListener') {
      log(
        'content.js',
        'handleMessage',
        'not following',
        'addFollowListener',
        url
      )

      findFollowButton(url, addFollowListener, result)
    } else {
      log('no url type found', {
        type,
        url,
        result
      })
    }
  } else if (type) {
    log('no url', { type, url, result })

    if (type === 'addFollowListener') {
      log('not following', url)

      findFollowButton(window.location.href, addFollowListener, result)
    } else if (type === 'onConnect') {
      // ports
      log({
        type,
        url,
        result
      })
      if (result?.name) {
        log({
          type,
          url,
          result
        })

        applyHandlers(result.name, result)
      } else {
        log('no name', {
          type,
          url,
          result
        })
      }
    } else {
      log('no url type found', {
        type,
        url,
        result
      })
    }
  } else {
    log('no type', { type, url, result })
  }

  log('result', result)
  return Promise.resolve()
}

async function onLoadResult (result) {
  log('got onLoad result', result)

  if (Array.isArray(result)) {
    await Promise.allSettled(result.content.map(handleMessage))
  } else {
    await handleMessage(result)
  }

  log('result', result)
  return Promise.resolve()
}

function isConnected (port, isConnected) {
  if (port?.name) {
    cache['ports'][port.name] = port
    cache['ports'][port.name].isDisconnected = !isConnected
    log('port name', { port, isConnected })
  } else {
    log('no port name', port)
  }
}

function onDisconnect (port) {
  log('cleaning up on disconnect', {
    port,
    this: this
  })
  isConnected(port, false)
}

function onConnect (port) {
  log(port)
  isConnected(port, true)

  if (port?.onMessage) {
    port.onMessage.addListener(function (message) {
      log('port.onMessage', {
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
    // log('checking url', {
    //   url,
    //   href: window.location.href
    // })

    if (Date.now() - timeNow > 30 * 60 * 1000) {
      clearInterval(urlCheckInterval)
    }

    if (window.location.href !== url) {
      log('url changed', {
        url,
        href: window.location.href
      })
      clearInterval(urlCheckInterval)
      onLoad()
    }
  }, 50)
}

async function onLoadHandler (input) {
  log('onLoadHandler', 'input', input)
  await sendMessage(
    { type: 'onLoad' },
    getCallbackTimestamp('onLoad', onLoadResult)
  )
}

function onLoad () {
  log('onLoad', window.location.href)
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
  default: [input => log('default', 'handler', JSON.stringify(input))]
}

chrome.runtime.onConnect.addListener(onConnect)
chrome.runtime.onMessage.addListener(onMessage)

onLoad()
log('loaded', window.location.href)
// TODO autojump .copypaste prompt
