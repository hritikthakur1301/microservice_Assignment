const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    subscriptionType: { type: String, enum: ['free', 'paid'], required: true },
    url: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Video', VideoSchema);
