const path = require("path");
const express = require("express");
const mongoose = require("mongoose");

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/kuziundo";

mongoose.connect(mongoUri)
  .then(() => console.log(`MongoDB connected to ${mongoUri}`))
  .catch(err => console.error('MongoDB connection error:', err));

const reportSchema = new mongoose.Schema({
  district: { type: String, required: true },
  road: { type: String, required: true },
  description: { type: String, required: true },
  severity: { type: String, required: true },
  status: { type: String, default: 'open' },
  votes: { type: Number, default: 0 },
  reporter: { type: String, default: 'Anonymous' },
  date: { type: String },
  location: { type: String, default: 'Not available' },
  images: { type: [String], default: [] }
}, { timestamps: true });

const Report = mongoose.model('Report', reportSchema);

app.get('/api/reports', async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Unable to fetch reports' });
  }
});

app.post('/api/reports', async (req, res) => {
  try {
    const {
      district,
      road,
      description,
      severity,
      reporter,
      date,
      location,
      images
    } = req.body;

    if (!district || !road || !description || !severity) {
      return res.status(400).json({
        error: 'District, road, description, and severity are required.'
      });
    }

    const safeImages = Array.isArray(images) ? images : [];

    const report = await Report.create({
      district,
      road,
      description,
      severity,
      status: 'open',
      votes: 0,
      reporter: reporter || 'Anonymous',
      date: date || new Date().toLocaleDateString('en-GB'),
      location: location || 'Not available',
      images: safeImages
    });

    res.status(201).json(report);
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({
      error: error.message || 'Unable to create report'
    });
  }
});

app.patch('/api/reports/:id', async (req, res) => {
  try {
    const updated = await Report.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Report not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({ error: 'Unable to update report' });
  }
});

app.delete('/api/reports/:id', async (req, res) => {
  try {
    const deleted = await Report.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Report not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ error: 'Unable to delete report' });
  }
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname,'index.html'));
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});