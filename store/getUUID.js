/* eslint-disable consistent-return */
/*
* Functions to convert username to uuid and cache them.
* Returns non-dashed uuid or an error.
 */
const config = require('../config');
const { logger, removeDashes, getData } = require('../util/utility');
const cacheFunctions = require('../store/cacheFunctions');
const redis = require('../store/redis');

function fetchUUID(username, cb) {
  const url = `https://api.mojang.com/users/profiles/minecraft/${username}`;
  return getData(redis, url, (err, body) => {
    if (err) {
      return cb(err, null);
    }
    const uuid = JSON.parse(body).id;
    return cb(null, uuid);
  });
}

function getUUID(name, cb) {
  const key = `uuid:${name.toLowerCase()}`;
  cacheFunctions.read({ key }, (uuid) => {
    if (uuid) {
      logger.debug(`Cache hit for uuid: ${name} - ${uuid}`);
      return cb(null, uuid);
    }
    logger.debug(`Cache miss for uuid ${name}`);
    if ((/^[0-9a-f]{32}$/i).test(name)) {
      return cb(null, name);
    }
    if ((/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i).test(name)) {
      return cb(null, removeDashes(name));
    }
    if (!(/^\w{1,16}$/i).test(name)) {
      return cb('Invalid username or UUID!');
    }
    fetchUUID(name, (fetchErr, uuid) => {
      if (fetchErr) {
        return cb(fetchErr, null);
      }
      if (config.ENABLE_UUID_CACHE) {
        cacheFunctions.write({
          key,
          duration: config.UUID_CACHE_SECONDS,
        }, uuid);
        return cb(null, uuid);
      }
      return cb(null, uuid);
    });
  });
}

module.exports = getUUID;
