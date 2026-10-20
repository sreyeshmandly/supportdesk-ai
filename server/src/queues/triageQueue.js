const { Queue } = require('bullmq');

const queueName = 'ticket-triage';

function createRedisConnection() {
  const requiredVariables = [
    'REDIS_HOST',
    'REDIS_PORT',
    'REDIS_PASSWORD'
  ];

  for (const variable of requiredVariables) {
    if (!process.env[variable]) {
      throw new Error(`${variable} is missing from server/.env`);
    }
  }

  return {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    username: 'default',
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null
  };
}

const triageQueue = new Queue(queueName, {
  connection: createRedisConnection()
});

module.exports = triageQueue;