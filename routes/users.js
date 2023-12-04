var express = require('express');
var router = express.Router();
const promisifyAll = require('util-promisifyall');
const Client = require('ftp');

const ftp = require("basic-ftp");

let config = {
  host: '192.168.1.58',
  port: 21,
  user: 'user',
  password: '123Lion+90'
};


let client = new Client();
client = promisifyAll(client);

client.autoConnect = async () => {
    await client.connect(config);
    return new Promise(resolve => {
        client.on('ready', _ => resolve());
    });
};

client.recursiveList = async (path) => {
    let filelist = [];

    const rootList = await client.listAsync(path);

    const promises = await rootList.map(file => {
        return new Promise((resolve) => {
            let filePath = `${path}/${file.name}`;
            file.parentDir = filePath.replace(file.name, '');
            file.path = filePath;
            file.level = 0;
            filelist.push(file);
            if (file.type === 'd') {
                resolve(client.recursiveSubtree(filePath, file, 1));
            } else {
                resolve();
            }
        });
    });



    await Promise.all(promises);
    return filelist;
};


client.recursiveSubtree = async (path, currentNode, currentLevel) => {
    if(currentNode.sons === undefined || currentNode.sons === null){
        currentNode.sons = [];
    }

    const rootList = await client.listAsync(path);

    const promises = await rootList.map(file => {
        return new Promise((resolve) => {
            let filePath = `${path}/${file.name}`;
            file.parentDir = filePath.replace(file.name, '');
            file.path = filePath;
            file.level = currentLevel;
            currentNode.sons.push(file);
            if (file.type === 'd') {
                resolve(client.recursiveSubtree(filePath, file, currentLevel+1));
            } else {
                resolve();
            }
        });
    });

    await Promise.all(promises);
}

async function getResult(){
    await client.autoConnect();
    const remoteFiles = await client.recursiveList('/ftp/user');
    //response.send(remoteFiles);
    await client.end();
    return remoteFiles;
}

async function downloadFile(path, res){
    let content = '';
    await client.autoConnect();
    await client.get(path, function(err, stream){
        if(err) {
            res.send("ERRORE");
            return;
        }
        stream.on('data', function(chunk) {
            content += chunk.toString();
        });
        stream.on('end', async function() {
            // content variable now contains all file content.
            await client.end();
            res.send(JSON.parse(content));
        });
    });
}

async function saveFile(buffer,path,  res){
    await client.autoConnect();
    client.put(buffer, path,  function (response) {
        client.end();
        res.send(response);
    });

}

async function createDir(path){
   /* await client.autoConnect();
    console.log("MI SONO CONNESSO, FACCIO LA MKDIR");
    await client.mkdir(path, true, callback);
    await client.end();
    return true; */
    const newClient = new ftp.Client();
    newClient.ftp.verbose = true;
    try{
        await newClient.access(config);
        await newClient.ensureDir(path);
    }catch(err){
        return false;
    }
    await newClient.close();
    return true;
}

function callback(errorMessage){
    console.log("ERRORE NEL MKDIR");
    console.log(errorMessage);
}

async function createBasicFtpClient(){

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
        });
    });
});

router.post('/downloadFile', function(req, res, next)  {
    let element = req.body;
    if(element['type'] === 'd'){
        res.send("YOU CANNOT DOWNLOAD A DIRECTORY");
        return;
    }
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

router.post('/createFolder', function(req, res, next)  {
    let element = req.body;
    let completePathToSave = element['path'];
    console.log("PATH COMPLETO DA SALVARE");
    console.log(completePathToSave);
    createDir(completePathToSave).then(result => {
        res.send(result);
    })
});

module.exports = router;
