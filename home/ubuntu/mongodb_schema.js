
const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    filePath: { type: String, required: true },
    settings: { type: Object },
    metadata: { 
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    }
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;