const Joi = require('joi');
const mqtt = require('mqtt');
const winston = require('winston');

// Configure the logger.
const logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)(Object.assign({
      json: false,
      prettyPrint: true,
      humanReadableUnhandledException: true,
      colorize: true,
      level: process.env.LOG_LEVEL,
      timestamp: true,
      silent: process.env.NODE_ENV === 'test'
    }))
  ]
});

// Validate the environment.
const schema = Joi.object({
  LOG_LEVEL: Joi.string().allow([
    'debug',
    'error',
    'info',
    'warn'
  ]).required(),
  MAX_VALUE: Joi.number().required(),
  MIN_VALUE: Joi.number().required(),
  MQTT_BROKER_URL: Joi.string().required(),
  MQTT_TOPIC: Joi.string().required(),
  NAME: Joi.string().required(),
  NODE_ENV: Joi.string().allow([
    'development',
    'production',
    'staging',
    'test'
  ]).required(),
  VALUE_INTERVAL: Joi.number().min(1).required()
}).unknown().required();
const { error, value: _env } = Joi.validate(process.env, schema);
if (error) {
  logger.error(`The environment is invalid (cause: ${error.details[0].message}).`);
  process.exit(23);
}

// Connect to the MQTT broker.
logger.info(`System connects to the MQTT broker @ ${process.env.MQTT_BROKER_URL}.`);
const client = mqtt.connect(process.env.MQTT_BROKER_URL, {
  connectTimeout: 5
});

let connected = false;

client.on('connect', () => {
  logger.info(`System connected to the MQTT broker @ ${process.env.MQTT_BROKER_URL}.`);
  connected = true;
  const topic = process.env.MQTT_TOPIC;
  const min = parseInt(process.env.MIN_VALUE);
  const max = parseInt(process.env.MAX_VALUE);

  // Subscribe to the topic.
  logger.debug(`Subscribe to topic ${topic}.`);
  client.subscribe(topic);
  logger.debug(`Subscribed to topic ${topic}.`);

  // Every process.env.VALUE_INTERVAL seconds...
  setInterval(() => {
    // ...generate a random value within the range...
    const value = min + Math.ceil(Math.random() * (max - min));
    // ...and publish it...
    logger.debug(`Publish value ${value} to topic ${topic}.`);
    client.publish(topic, value.toString());
    logger.debug(`Published value ${value} to topic ${topic}.`);
  }, parseInt(process.env.VALUE_INTERVAL) * 1000);
});

client.on('error', (error) => {
  logger.error('Something went wrong.', error);
});

// NOTE: No error event is sent when connection fails. The code below can be removed when
// https://github.com/GladysAssistant/Gladys/issues/540 is fixed.
setTimeout(() => {
  if (connected) {
    return;
  }
  logger.error(`System failed to connect to the MQTT broker @ ${process.env.MQTT_BROKER_URL}.`);
  process.exit(42);
}, 30 * 1000);

if (!module.parent) {
  logger.info(`Random value generator for topic ${ process.env.MQTT_TOPIC } started.`);
}
