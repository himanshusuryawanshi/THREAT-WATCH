const store = {}

export function getCache(key) {
  const item = store[key]
  if (!item) return null
  if (Date.now() > item.expiry) {
    delete store[key]
    return null
  }
  return item.data
}

export function setCache(key, data, ttlSeconds) {
  store[key] = {
    data,
    expiry: Date.now() + ttlSeconds * 1000,
  }
}

export function clearCache(key) {
  delete store[key]
}

export function cacheStats() {
  const keys   = Object.keys(store)
  const active = keys.filter(k => Date.now() < store[k].expiry)
  return { total: keys.length, active: active.length, keys: active }
}