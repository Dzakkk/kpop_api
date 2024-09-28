require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGODB_URL, {
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((error) => {
    console.error('Failed to connect to MongoDB:', error.message);
});

const groupSchema = new mongoose.Schema({
    name: String,
    description: String,
    debut: Date,
    labels: [String],
    status: String,
    imageURL: String,
    createdAt: { type: Date, default: Date.now }
});

const memberSchema = new mongoose.Schema({
    name: String,
    stageName: String,
    role: [String],
    birth: Date,
    imageURL: String,
    groupId: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
    labels: [String],
    createdAt: { type: Date, default: Date.now }
});

const Group = mongoose.models.Group || mongoose.model('Group', groupSchema, 'kpop_groups');
const Member = mongoose.models.Member || mongoose.model('Member', memberSchema, 'kpop_members');

const uploadDir = '/tmp/uploads';
if (!fs.existsSync(uploadDir)){
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
  });
  
  const upload = multer({ storage: storage });


const uploadToGithub = async (filePath, githubPath) => {
    const fileContent = fs.readFileSync(filePath, { encoding: 'base64' });

    const apiUrl = `https://api.github.com/repos/Dzakkk/kpop_api/contents/${githubPath}`;

    try {
        const response = await axios.put(apiUrl, {
            message: `Add image ${path.basename(filePath)}`,
            content: fileContent,
            committer: {
                name: 'Dzakkk',
                email: 'fpdzak@gmail.com'
            }
        }, {
            headers: {
                Authorization: `token ${process.env.GITHUB_TOKEN}`
            }
        });

        return response.data.content.download_url;

    } catch (error) {
        console.error('Error uploading to GitHub:', error.response ? error.response.data : error.message);
        throw error;
    }
};

app.post('/groups', upload.single('image'), async (req, res) => {
    const { name, description, labels, debut, status } = req.body;
    const filePath = req.file.path;
    const githubPath = `image/${req.file.filename}.png`;

    try {
        const imageURL = await uploadToGithub(filePath, githubPath);

        const group = new Group({ name, description, imageURL, labels, debut, status });
        await group.save();

        res.json({ message: 'Image berhasil diupload', imageURL });
    } catch (error) {
        res.status(500).json({ message: 'Failed to upload', error });
    } finally {
        fs.unlinkSync(filePath);
    }
});

app.post('/members', upload.single('image'), async (req, res) => {
    const { name, stageName, role, birth, groupId, labels } = req.body;
    const filePath = req.file.path;
    const githubPath = `image/${req.file.filename}.png`;

    try {
        const imageURL = await uploadToGithub(filePath, githubPath);

        const member = new Member({ name, stageName, role, birth, groupId, labels, imageURL });
        await member.save();

        res.json({ message: 'Image berhasil diupload', imageURL });
    } catch (error) {
        res.status(500).json({ message: 'Failed to upload', error });
    } finally {
        fs.unlinkSync(filePath);
    }
});

app.get('/groups', async (req, res) => {
    try {
        const groups = await Group.find();
        res.json(groups);
    } catch (error) {
        res.status(500).json({ message: 'Failed to retrieve groups', error });
    }
});

app.get('/members', async (req, res) => {
    try {
        const members = await Member.find().populate('groupId');
        res.json(members);
    } catch (error) {
        res.status(500).json({ message: 'Failed to retrieve members', error });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
