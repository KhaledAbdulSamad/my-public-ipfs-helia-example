const express = require('express');
const multer = require('multer');
const app = express();
const upload = multer(); //for the first endpoint
app.use(express.json()); //second endpoint


let hashMap = new Map();

async function createNode() {

    const { createHelia } = await import('helia');
    const { unixfs } = await import('@helia/unixfs');
    const { MemoryBlockstore } = await import('blockstore-core');

    // the blockstore is where we store the blocks that make up files
    const blockstore = new MemoryBlockstore();

    // create the IPFS helia node
    const helia = await createHelia({ blockstore });

    // create a filesystem on top of Helia, in this case it's UnixFS
    const fs = unixfs(helia);

    // create a second Helia node using the same blockstore
    const helia2 = await createHelia({ blockstore })

    // create a second filesystem
    const fs2 = unixfs(helia2)
    return { "A": fs, "B": fs2 };
}

async function run() {
    const fs = await createNode();

    //text file 

    app.post('/upload/textfile', upload.single('file'), async (req, res) => {
        const data = req.file.buffer;

        // add the bytes to your node and receive a unique content identifier
        let cid = await fs.A.addBytes(data);

        hashMap.set(cid.toString(), cid);
        res.status(200).send('File has been uploaded')
        console.log('Added file cid:', cid.toString())
        console.log("Use this url to access file directly : https://ipfs.io/ipfs/" + cid.toString());
    })

    app.get('/fetch/textfile', async (req, res) => {
        const cidStringFormat = req.body.cidStringFormat;
        const cid = hashMap.get(cidStringFormat);

        if (!cid) {
            res.status(404).send('CID not found')
        }

        let text;
        // this decoder will turn Uint8Arrays into strings
        const decoder = new TextDecoder();

        // read the file from the blockstore using the second Helia node
        for await (const chunks of fs.B.cat(cid)) {
            text = decoder.decode(chunks, { stream: true })
        }

        res.status(200).send('File has been retrived')
        console.log('Retrived file contents: ', text)

    })

    // image

    app.post('/upload/image', upload.single('file'), async (req, res) => {
        const data = req.file.buffer;

        // add the bytes to your node and receive a unique content identifier
        let cid = await fs.A.addBytes(data);

        hashMap.set(cid.toString(), cid);
        res.status(200).send('Image has been uploaded')
        console.log('Added image cid:', cid.toString())
        console.log("Use this url to access image directly : https://ipfs.io/ipfs/" + cid.toString());
    })

    app.get('/fetch/image', async (req, res) => {
        const cidStringFormat = req.body.cidStringFormat;
        const cid = hashMap.get(cidStringFormat);

        if (!cid) {
            res.status(404).send('CID not found');
            return; // Exit the function to prevent further execution
        }

        try {
            let imageBuffer = Buffer.alloc(0);

            // read the file from the blockstore using the second Helia node
            for await (const chunk of fs.B.cat(cid)) {
                imageBuffer = Buffer.concat([imageBuffer, Buffer.from(chunk)]);
            }

            // Assuming the image is in JPEG format, set the appropriate content type
            res.setHeader('Content-Type', 'image/jpeg');

            // Send the image buffer in the response
            res.end(imageBuffer, 'binary');

            // Log a message to indicate that the response has been sent
            console.log('Response sent successfully');

            // Exit the function to prevent further execution
            return;
        } catch (error) {
            console.error('Error fetching and sending image:', error);
            res.status(500).send('Internal Server Error');
            // Exit the function to prevent further execution
            return;
        }
    });

    app.delete('/unpin/image', async (req, res) => {
        const cidStringFormat = req.body.cidStringFormat;

        if (!hashMap.has(cidStringFormat)) {
            return res.status(404).json({ error: 'CID not found' });
        }

        // Remove the CID from the hashMap (unpinning)
        hashMap.delete(cidStringFormat);

        res.status(200).json({ message: 'Content unpinned successfully' });
        console.log('Content unpinned successfully');
    });

    app.listen(3000, () => {
        console.log("I am listening....")
    })
}

run();