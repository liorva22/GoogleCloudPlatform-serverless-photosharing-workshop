const express = require('express');
const fileUpload = require('express-fileupload');
const Firestore = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const path = require('path');
const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
dayjs.extend(relativeTime);
const { generateSignedUrl } = require('./cloudStorageUtils'); // Import the generateSignedUrl function

const app = express();
app.use(express.static('public'));
app.use(fileUpload({
    limits: { fileSize: 10 * 1024 * 1024 },
    useTempFiles: true,
    tempFileDir: '/tmp/'
}));

app.post('/api/pictures', async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        console.log("No file uploaded");
        return res.status(400).send('No file was uploaded.');
    }
    console.log(`Receiving files ${JSON.stringify(req.files.pictures)}`);

    const pics = Array.isArray(req.files.pictures) ? req.files.pictures : [req.files.pictures];

    pics.forEach(async (pic) => {
        console.log('Storing file', pic.name);
        const newPicture = path.resolve('/tmp', pic.name);
        await pic.mv(newPicture);

        const pictureBucket = storage.bucket(process.env.BUCKET_PICTURES);
        await pictureBucket.upload(newPicture, { resumable: false });
    });

    res.redirect('/');
});

app.get('/api/pictures', async (req, res) => {
    console.log('Retrieving list of pictures');

    const thumbnails = [];
    const pictureStore = new Firestore().collection('pictures');
    const snapshot = await pictureStore
        .where('thumbnail', '==', true)
        .orderBy('created', 'desc').get();

    if (snapshot.empty) {
        console.log('No pictures found');
    } else {
        snapshot.forEach(doc => {
            const pic = doc.data();
            thumbnails.push({
                name: doc.id,
                labels: pic.labels,
                color: pic.color,
                created: dayjs(pic.created.toDate()).fromNow()
            });
        });
    }
    console.table(thumbnails);
    res.send(thumbnails);
});

app.get('/api/pictures/:name', async (req, res) => {
    const signedUrl = await generateSignedUrl(process.env.BUCKET_PICTURES, req.params.name, 3600); // Adjust expiration as needed
    res.redirect(signedUrl);
});

app.get('/api/thumbnails/:name', async (req, res) => {
    const signedUrl = await generateSignedUrl(process.env.BUCKET_THUMBNAILS, req.params.name, 3600); // Adjust expiration as needed
    res.redirect(signedUrl);
});

app.get('/api/collage', async (req, res) => {
    const signedUrl = await generateSignedUrl(process.env.BUCKET_THUMBNAILS, 'collage.png', 3600); // Adjust expiration as needed
    res.redirect(`${signedUrl}?${Date.now()}`);
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`Started web frontend service on port ${PORT}`);
    console.log(`- Pictures bucket = ${process.env.BUCKET_PICTURES}`);
    console.log(`- Thumbnails bucket = ${process.env.BUCKET_THUMBNAILS}`);
});
