const express = require('express');
const mongoose = require('mongoose');
const Profile = require('./models/profileModel');
const { Kafka } = require('kafkajs');

const app = express();
app.use(express.json());

mongoose.connect('mongodb://mongodb:27017/profileDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const kafka = new Kafka({
  clientId: 'profile-service',
  brokers: ['kafka:9092'],
  connectionTimeout: 3000,
  retry: { retries: 10 }
});

const consumer = kafka.consumer({ groupId: 'profile-group' });

const startConsumer = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: 'USER_REGISTERED', fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      if (topic === 'USER_REGISTERED') {
        try {
          const userData = JSON.parse(message.value.toString());
          await Profile.create({
            userId: userData._id,
            name: '',
            about: '',
            profileImage: '',
          });
          console.log('Profile created for user:', userData._id);
        } catch (error) {
          console.error('Error processing message:', error);
        }
      }
    },
  });
};
startConsumer().catch((error) =>
  console.error('Kafka Consumer Error:', error)
);
app.put('/update-profile/:id', async (req, res) => {
  try {
    const { name, about, profileImage } = req.body;
    const profile = await Profile.findOneAndUpdate(
      { userId: req.params.id },
      { name, about, profileImage },
      { upsert: true, new: true }
    );
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error });
  }
});
app.listen(3002, () => console.log('Profile Service running on port 3002'));
