const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Kafka } = require('kafkajs');
const User = require('./models/usermodel');

const app = express();
app.use(express.json());

mongoose.connect('mongodb://mongodb:27017/userDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const kafka = new Kafka({
  clientId: 'user-service',
  brokers: ['kafka:9092'],
  connectionTimeout: 3000,
  retry: { retries: 10 },
});
const producer = kafka.producer();
const startProducer = async () => {
  try {
    await producer.connect();
    console.log('Kafka Producer Connected (User-Service)');
  } catch (error) {
    console.error('Kafka Producer Connection Failed:', error);
  }
};
startProducer();
const sendKafkaMessage = async (topic, message) => {
  try {
    if (!producer.isConnected()) {
      console.warn('⚠️ Kafka Producer Disconnected, Reconnecting...');
      await producer.connect();
    }
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });
    console.log(`Message sent to topic ${topic}:`, message);
  } catch (error) {
    console.error('Error sending Kafka message:', error);
  }
};

app.post('/register', async (req, res) => {
  try {
    const { email, password, confirmPassword, subscriptionType, role } =
      req.body;
    if (password !== confirmPassword)
      return res.status(400).json({ error: 'Passwords do not match' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      email,
      password: hashedPassword,
      subscriptionType,
      role,
    });
    const savedUser = await user.save();

    await sendKafkaMessage('USER_REGISTERED', savedUser);
    res
      .status(201)
      .json({ message: 'User registered successfully', data: savedUser });
  } catch (error) {
    res.status(500).json({ error: error });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        subscriptionType: user.subscriptionType,
      },
      process.env.JWT_SECRET || 'SECRET_KEY',
      { expiresIn: '1h' }
    );

    res.json({ message: 'Login successful', token, user });
  } catch (error) {
    res.status(500).json({ error: error });
  }
});

app.get('/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json({ message: 'Users fetched successfully', data: users });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.listen(3001, () => console.log('User Service running on port 3001'));
