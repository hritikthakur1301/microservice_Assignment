const express = require('express');
const mongoose = require('mongoose');
const { Kafka } = require('kafkajs');
const Video = require('./models/videoModel');
const authMiddleware = require('./middleware/auth');
const app = express();
app.use(express.json());
mongoose.connect('mongodb://mongodb:27017/videoDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const kafka = new Kafka({
  clientId: 'video-service',
  brokers: ['kafka:9092'],
  connectionTimeout: 3000,
  retry: { retries: 10 },
});
const producer = kafka.producer();
const startProducer = async () => {
  await producer.connect();
  console.log('Kafka Producer Connected');
};

startProducer().catch((error) =>
  console.error('Kafka Producer Error:', error)
);
app.post('/upload', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin')
      return res.status(403).json({ error: 'Only admin can upload videos' });
    const { title, description, subscriptionType, url } = req.body;
    const video = new Video({ title, description, subscriptionType, url });
    const savedVideo = await video.save();

    await producer.send({
      topic: 'VIDEO_UPLOADED',
      messages: [{ value: JSON.stringify(savedVideo) }],
    });
    res.json({ message: 'Video uploaded successfully', data: savedVideo });
  } catch (error) {
    console.error('Error uploading video:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.get('/videos', authMiddleware, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = 'createdAt',
      order = 'desc',
      title,
    } = req.query;

    let query = {};

    if (req.user.role !== 'admin') {
      query.subscriptionType = req.user.subscriptionType;
    }
    if (title && title.trim() !== '') {
      query.title = { $regex: title, $options: 'i' };
    }
    const videos = await Video.find(query)
      .sort({ [sort]: order === 'asc' ? 1 : -1 })
      .skip((page) * limit)
      .limit(parseInt(limit));

    res.json({ message: 'Videos fetched successfully', data: videos });
  } catch (error) {
    res.status(500).json({ error: error });
  }
});
app.listen(3003, () => console.log('Video Service running on port 3003'));
