var express = require('express');
var router = express.Router();
const promisifyAll = require('util-promisifyall');
const Client = require('ftp');
const zlib = require('zlib');
const { parser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/StreamArray');

let config = {
  host: '192.168.1.58',
  port: 21,
  user: 'user',
  password: '123Lion+90'
};

let filelist = [];
let content = '';




let client = new Client();
client = promisifyAll(client);

client.autoConnect = async () => {
    await client.connect(config);
    return new Promise(resolve => {
        client.on('ready', _ => resolve());
    });
};

client.recursiveList = async (path) => {
    if (!filelist)
        filelist = [];

    const rootList = await client.listAsync(path);

    const promises = await rootList.map(file => {
        return new Promise((resolve) => {
            let filePath = `${path}/${file.name}`;
            if (file.type === 'd') {
                resolve(client.recursiveList(filePath));
            } else {
                file.parentDir = filePath.replace(file.name, '');
                file.path = filePath;
                filelist.push(file);
                resolve();
            }
        });
    });

    await Promise.all(promises);
    return filelist;
};

async function getResult(){
    await client.autoConnect();
    const remoteFiles = await client.recursiveList('/ftp/user');
    //response.send(remoteFiles);
    return remoteFiles;
}

async function downloadFile(path, res){
    await client.autoConnect();
    console.log("MI SONO CONNESSO, PATH");
    console.log(path);
    await client.get(path, function(err, stream){
        if(err) throw err;
        stream.on('data', function(chunk) {
            content += chunk.toString();
        });
        stream.on('end', function() {
            // content variable now contains all file content.
            res.send(JSON.parse(content));
        });
    });
}

async function saveFile(buffer,path,  res){
    await client.autoConnect();
    client.put(buffer, path, function (response) {
        res.send(response);
    });
}

/* GET users listing. */
router.get('/', function(req, res, next) {
    getResult().then(result => {
        res.send(result);
    });
});

router.get('/fromFile', function(req, res, next)  {

    getResult().then(result => {
        var currentElement = result[1];
        downloadFile(currentElement['path'], res).then(stream => {
           console.log("HO FINITO");
        });
    });
});

router.post('/downloadFile', function(req, res, next)  {
    let element = req.body;
    // element should contain COMPLETE path ( WITH THE FILENAME.json )
    downloadFile(element['path'], res);
});


router.post('/saveFile', function(req, res, next)  {
    let element = req.body;
    // element should be something like
    // {
    // "content" : {entire content here},
    // "path" : "CURRENT COMPLETE FILE PATH ( WITH THE FILENAME.json )
    // }
    let buffer = Buffer.from(JSON.stringify(element['content']));
    let path = element['path'];
    saveFile(buffer,path,  res);
});

module.exports = router;
