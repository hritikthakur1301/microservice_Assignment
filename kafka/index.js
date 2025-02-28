const { Kafka } = require('kafkajs');
const kafka = new Kafka({
  clientId: 'microservices-system',
  brokers: ['kafka:9092'],
});
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'microservices-group' });
const connectWithRetry = async (fn, retries = 5, delay = 3000) => {
  for (let i = 0; i < retries; i++) {
    try {
      await fn();
      console.log(`Kafka connection established.`);
      return;
    } catch (err) {
      console.error(
        `⚠️ Kafka connection failed. Retrying in ${delay / 1000}s...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  console.error(`Kafka connection failed after ${retries} attempts.`);
  process.exit(1);
};
const runKafka = async () => {
  await connectWithRetry(() => producer.connect());
  await connectWithRetry(() => consumer.connect());

  await consumer.subscribe({
    topics: ['USER_REGISTERED', 'VIDEO_UPLOADED'],
    fromBeginning: true,
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log(
        `Received message on topic ${topic}:`,
        message.value.toString()
      );
    },
  });
};
runKafka().catch(console.error);
module.exports = { producer, consumer };
