/* eslint-disable consistent-return */
/*
* Worker to generate SkyBlock item schema from auction database
 */
const async = require('async');
const redis = require('../store/redis');
const { getItems, getAuctions } = require('../store/queries');
const { logger, removeFormatting, invokeInterval } = require('../util/utility');

const schemaObject = (auction) => {
  const {
    tier,
    category,
    item,
  } = auction;
  try {
    return {
      name: removeFormatting(item.name),
      tier,
      category,
      item_id: item.item_id,
      texture: item.attributes.texture,
    };
  } catch (e) {
    logger.warn(`Found bad item in DB: ${JSON.stringify(auction)}`);
  }
};

function doItems(cb) {
  getItems((err, ids) => {
    if (err) {
      logger.error(err);
      cb(err);
    }
    logger.info(`Found ${ids.length} item IDs from the database`);
    redis.get('skyblock_items', (err, res) => {
      if (err) {
        logger.error(err);
        cb(err);
      }
      const items = JSON.parse(res) || {};
      ids = ids.filter(id => !(id in items));
      logger.info(`${ids.length} IDs aren't currently included`);
      let counter = 0;
      async.each(ids, (id, cb) => {
        getAuctions({
          'item.attributes.id': id,
          'item.attributes.modifier': null,
          'item.name': { $ne: '§fnull' },
        }, 'tier category item', { limit: 1 }, (err, auction) => {
          if (err) {
            return cb(err);
          }
          if (auction.length === 0) return cb();
          counter += 1;
          items[id] = schemaObject(auction[0]);
          return cb();
        });
      }, (err) => {
        if (err) {
          return cb(err);
        }
        redis.set('skyblock_items', JSON.stringify(items), (err) => {
          if (err) logger.error(err);
          logger.info(`${counter} new items discovered`);
          return cb();
        });
      });
    });
  });
}

invokeInterval(doItems, 60 * 60 * 1000);
