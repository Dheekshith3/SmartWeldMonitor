const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, required: true },
  passwordHash: { type: String, required: true }
}, { timestamps: true });

const machineSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: String,
  model: String,
  location: String,
  status: String,
  health: Number,
  temperature: Number,
  vibration: Number,
  current: Number,
  voltage: Number,
  production: Number,
  good: Number,
  defects: Number,
  downtime: Number,
  assigned: String
}, { timestamps: true });

const alertSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  machine: String,
  type: String,
  severity: String,
  message: String,
  status: String,
  time: String
}, { timestamps: true });

const maintenanceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  machine: String,
  type: String,
  priority: String,
  description: String,
  technician: String,
  status: String,
  scheduled: String
}, { timestamps: true });

module.exports = {
  User: mongoose.model('User', userSchema, 'users'),
  Machine: mongoose.model('Machine', machineSchema, 'machines'),
  Alert: mongoose.model('Alert', alertSchema, 'alerts'),
  Maintenance: mongoose.model('Maintenance', maintenanceSchema, 'maintenance')
};