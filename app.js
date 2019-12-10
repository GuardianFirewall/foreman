const https = require('https')
require('dotenv').config()
const express = require('express')
const path = require('path')
const fs = require('fs');
const useragent = require('express-useragent')
const bodyParser = require('body-parser');
const io = require('@pm2/io')
const socket = require('socket.io');
const uuidv4 = require('uuid/v4');
const crypto = require('crypto');
var compare = require('tsscmp');
var basicAuth = require('basic-auth');

var webServer = null;
var socketServer = null;
var socketClients = [];

var forceNoAuthFlag = ((process.env.FOREMAN_FORCE_NOAUTH == 'true') ? true:false) || false;

var endpointAllRequestCounter = io.counter({
	name: '/api/find/all requests'
})

var endpointBuildRequestCounter = io.counter({
	name: '/api/find/:build requests'
})

var endpointDeviceRequestCounter = io.counter({
	name: '/api/find/:device requests'
})

var endpointDeviceBuildRequestCounter = io.counter({
	name: '/api/find/:build/:device requests'
})

var availableFirmwares = io.metric({
	name: 'Firmwares in Keystore'
})

var foremanSubmissionsCounter = io.counter({
	name: 'Submissions'
})

// express 
const app = express()
const express_port = process.env.FOREMAN_PORT || 4141

// mongodb
const mongo = require('mongodb').MongoClient
const mongodb_url = 'mongodb://localhost:27017'

// mongodb globals
var mongo_db = null;
var mongo_collection = null;
var mongo_collection_keybags = null;
var mongo_collection_Superusers = null;
var mongo_collection_APIKeys = null;
function connectToMongo(callback) {
	mongo.connect(mongodb_url, {
		useNewUrlParser: true,
		useUnifiedTopology: true
		}, (err, client) => {
		if (err) {
			console.error(err)
			return
		}
		console.log('connected to mongodb')
		mongo_db = client.db('foreman')
		mongo_collection = mongo_db.collection('builds')
		mongo_collection_keybags = mongo_db.collection('keybags')
		mongo_collection_APIKeys = mongo_db.collection('authorizedkeys')
		mongo_collection_Superusers = mongo_db.collection('superusers');
		callback()
	})
}

function mongo_generalCleanConfigForUser(configData, cleanKey) {
	var cleanedConfigData = configData
	var cleanedImagesDictionary = {}
	if (cleanedConfigData['_id'] != undefined) {
		delete cleanedConfigData['_id'];
	}
	let dirtyImagesDictionary = cleanedConfigData[cleanKey]
	let dirtyImagesKeys = Object.keys(dirtyImagesDictionary)
	for (var i = dirtyImagesKeys.length - 1; i >= 0; i--) {
		var cleanKey = dirtyImagesKeys[i].replace(/\_/g,'.')
		cleanKey = cleanKey.replace('all.flash', 'all_flash')
		cleanedImagesDictionary[cleanKey] = dirtyImagesDictionary[dirtyImagesKeys[i]]
	}
	cleanedConfigData[cleanKey] = cleanedImagesDictionary
	return cleanedConfigData
}

function mongo_generalCleanConfigForStorageWithKey(configData, cleanKey) {
	var cleanedConfigData = configData
	var cleanedImagesDictionary = {}
	let dirtyImagesDictionary = cleanedConfigData[cleanKey]
	let dirtyImagesKeys = Object.keys(dirtyImagesDictionary)
	for (var i = dirtyImagesKeys.length - 1; i >= 0; i--) {
		let cleanKey = dirtyImagesKeys[i].replace(/\./g,'_')
		cleanedImagesDictionary[cleanKey] = dirtyImagesDictionary[dirtyImagesKeys[i]]
	}
	cleanedConfigData[cleanKey] = cleanedImagesDictionary
	return cleanedConfigData
}

/* Mongo Superuser Collection Methods */
function mongo_removeSuperuser(superuserProfile, callback) {
	console.log(pKey)
	if (mongo_collection_Superusers != null) {
		mongo_getAllAuthorizedAPIKeys(function(err, allAPIKeys) {
			for (var i = allAPIKeys.length - 1; i >= 0; i--) {
				if (allAPIKeys[i]['key'] == pKey) {
					mongo_collection_Superusers.deleteOne(allAPIKeys[i], callback)
				}
			}
		})
	}
}

function mongo_addSuperuser(superuserUsername, superuserPassphrase, callback) {
	if (mongo_collection_Superusers != null) {
		mongo_collection_Superusers.insertOne({'user':superuserUsername, 'hash':superuserPassphrase}, (err, result) => {
			if (err) {
				callback(err, false)
			} else {
				callback(err, true)
			}
		});
	}
}

function mongo_getSuperusers(callback) {
	if (mongo_collection_Superusers != null) {
		mongo_collection_Superusers.find().toArray((err, items) => {
			callback(err, items)
		})
	}
}

/* Mongo API Key Collection Methods */
function mongo_removeAuthorizedAPIKey(pKey, callback) {
	if (mongo_collection_APIKeys != null) {
		mongo_getAllAuthorizedAPIKeys(function(err, allAPIKeys) {
			for (var i = allAPIKeys.length - 1; i >= 0; i--) {
				if (allAPIKeys[i]['key'] == pKey) {
					mongo_collection_APIKeys.deleteOne(allAPIKeys[i], callback)
				}
			}
		})
	}
}

function mongo_addAuthorizedAPIKey(callback) {
	var generatedKey = uuidv4();
	if (mongo_collection_APIKeys != null) {
		mongo_collection_APIKeys.insertOne({'key':generatedKey}, (err, result) => {
			if (err) {
				callback(err, generatedKey)
			} else {
				callback(err, generatedKey)
			}
		})
	}
}

function mongo_getAllAuthorizedAPIKeys(callback) {
	if (mongo_collection_APIKeys != null) {
		mongo_collection_APIKeys.find().toArray((err, items) => {
			callback(err, items)
		})
	}
}


/* Mongo Keybag Collection Methods */
function mongo_removeKeybag(configData, callback) {
	if (mongo_collection_keybags != null) {
		mongo_collection_keybags.deleteOne(configData, callback)
	}
}

function mongo_addKeybag(configData, callback) {
	var cleanedConfig = mongo_generalCleanConfigForStorageWithKey(configData, 'kbags')
	cleanedConfig = mongo_generalCleanConfigForStorageWithKey(configData, 'images')
	if (mongo_collection_keybags != null) {
		mongo_collection_keybags.insertOne(cleanedConfig, (err, result) => {
			if (err) {
				callback(err, result)
			} else {
				callback(err, result)
			}
		})
	}
}

function mongo_getAllKeybags(callback) {
	if (mongo_collection_keybags != null) {
		mongo_collection_keybags.find().toArray((err, items) => {
			if (err) {
				callback(err, items)
			} else {
				availableFirmwares.set(items.length)
				var cleanedItems = [];
				for (var i = items.length - 1; i >= 0; i--) {
					var cleaned = mongo_generalCleanConfigForUser(items[i], 'kbags');
					cleaned = mongo_generalCleanConfigForUser(items[i], 'images')
					cleanedItems.push(cleaned)
				}
				callback(err, cleanedItems)
			}
		})
	}
}

/* Mongo Keystore Collection Methods */
function mongo_addKeystoreConfig(configData, callback) {
	let cleanedConfig = mongo_generalCleanConfigForStorageWithKey(configData, 'images')
	if (mongo_collection != null) {
		mongo_collection.insertOne(cleanedConfig, (err, result) => {
			if (err) {
				callback(err, result)
			} else {
				callback(err, result)
			}
		})
	}
}

function mongo_getAllConfigsKeystore(callback) {
	if (mongo_collection != null) {
		mongo_collection.find().toArray((err, items) => {
			if (err) {
				callback(err, items)
			} else {
				availableFirmwares.set(items.length)
				var cleanedItems = [];
				for (var i = items.length - 1; i >= 0; i--) {
					cleanedItems.push(mongo_generalCleanConfigForUser(items[i], 'images'))
				}
				callback(err, cleanedItems)
			}
		})
	}
}

// check the keystore for a target device and ios build, if an entry exists return true
function checkKeystoreForDeviceAndBuild(keystore, targetDevice, targetBuild) {
	for (var i = keystore.length - 1; i >= 0; i--) {
		if (keystore[i]["device"] == targetDevice && keystore[i]["build"] == targetBuild) {
			console.log("rejecting submission request for device "+targetDevice+" and build "+targetBuild)
			return true; // found a keystore entry
		}
	}
	return false; // no keystore entry found
}

function validateKeystoreSubmission(requestSubmission) {
	try {
		// check that our device key is set
		if (requestSubmission["device"].length <= 0) {
			console.log("failed model validation")
			return 1;
		}
		// check that our build key is set
		if (requestSubmission["build"].length <= 0) {
			console.log("failed build validation")
			return 2;
		}
		// check that we have images in our submission
		let originalImagesDictionary = requestSubmission["images"];
		let requestImagesKeys = Object.keys(originalImagesDictionary)
		if (requestImagesKeys.length <= 0) {
			console.log("failed image length validation")
			return 3;
		}
		// and check that the keys /look/ valid
		for (var i = requestImagesKeys.length - 1; i >= 0; i--) {
			let kbag = originalImagesDictionary[requestImagesKeys[i]];
			if (kbag.length != 96) {
				console.log("failed key length validation")
				return 4; // our key length is invalid
			}
		}
	} catch (error) {
		console.log(error)
		return 5;
	}

	// if all is well, return true. 
	return 0;
}

function validateKeybagsSubmission(requestSubmission) {
	try {
		// check that our device key is set
		if (requestSubmission["device"].length <= 0) {
			console.log("failed model validation")
			return 1;
		}
		// check that our build key is set
		if (requestSubmission["build"].length <= 0) {
			console.log("failed build validation")
			return 2;
		}
		// check that we have images in our submission
		let originalImagesDictionary = requestSubmission["kbags"];
		let requestImagesKeys = Object.keys(originalImagesDictionary)
		if (requestImagesKeys.length <= 0) {
			console.log("failed kbags length")
			return 3;
		}
	} catch (error) {
		console.log(error)
		return 5;
	}

	// if all is well, return true. 
	return 0;
}

var auth = function (req, res, next) {
	var user = basicAuth(req);
	if (!user || !user.name || !user.pass) {
		res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
		res.sendStatus(401);
		return;
	}
	
	if (compare(user.name, 'foreman')) {
		let digest = crypto.createHash('sha512').update(user.pass).digest('hex');
		if (compare(digest, process.env.FOREMAN_ADMIN_DIGEST)) {
			next();
			return;
		}
		res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
		res.sendStatus(401);
		return;
	}
	
	let givenUsername = user.name;
	let givenPassword = user.pass;
	if (mongo_collection_Superusers != null) {
		mongo_getSuperusers(function(err, allSuperusers) {
			var didAuthenticate = false;
			for (var i = allSuperusers.length - 1; i >= 0; i--) {
				if (compare(user.name, allSuperusers[i].user)) {
					let round_one = crypto.createHash('sha256').update(user.pass).digest('hex');
					let round_two = crypto.createHash('sha256').update(user.name+round_one).digest('hex');
					if (round_two == allSuperusers[i].hash) {
						didAuthenticate = true;
						break;
					}
				}
			}
			if (didAuthenticate == false) {
				res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
				res.sendStatus(401);
				return;
			} else {
				next();
				return;
			}
		});
	}  else {
		res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
		res.sendStatus(401);
		return;
	}
}

// json parse for request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// catch any GET requests to our root
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/landing.html')))

// catch any GET requests to view our keybag queue
app.get('/api/queue', (req, res) => {
	mongo_getAllKeybags(function(err, items) {
		res.writeHead(200, {"Content-Type": "application/json"});
		res.end(JSON.stringify(items));
	});
});

// catch any GET requests to our admin root
app.get('/admin', auth, (req, res) => {
	res.sendFile(path.join(__dirname, 'public/admin.html')) 
});

app.get('/admin/apikeys', auth, (req, res) => {
	mongo_getAllAuthorizedAPIKeys(function(err, items) {
		res.writeHead(200, {"Content-Type": "application/json"});
		res.end(JSON.stringify(items));
	});
});

app.get('/admin/newkey', auth, (req, res) => {
	mongo_addAuthorizedAPIKey(function(err, newKey) {
		res.writeHead(200, {"Content-Type": "application/json"});
		res.end(JSON.stringify(newKey));
	});
});

app.get('/admin/delete/:apikey', auth, (req, res) => {
	mongo_removeAuthorizedAPIKey(req.params.apikey, function(retA, retB) {
		res.writeHead(200, {"Content-Type": "application/json"});
		res.end(JSON.stringify(retA));
	});
});

app.get('/admin/superuser/users', auth, (req, res) => {
	mongo_getSuperusers(function(err, items) {
		res.writeHead(200, {"Content-Type": "application/json"});
		res.end(JSON.stringify(items));
	});
});

app.post('/admin/superuser/add', auth, (req, res) => {
	let newSuperuserUsername = req.body.username;
	let newSuperuserPassword = req.body.hash; 
	let hash = crypto.createHash('sha256');
	hash.update(newSuperuserUsername+newSuperuserPassword);
	let storedHash = hash.digest('hex');
	mongo_addSuperuser(newSuperuserUsername, storedHash, function(err, didAddSuperuser) {
		res.writeHead(200, {"Content-Type": "application/json"});
		res.end(JSON.stringify(didAddSuperuser));
	});
});

app.post('/admin/superuser/remove', auth, (req, res) => {
	mongo_removeAuthorizedAPIKey(req.body.apikey, function(retA, retB) {
		res.writeHead(200, {"Content-Type": "application/json"});
		res.end(JSON.stringify(retA));
	});
});

app.delete('/queue', (req, res) => {
	mongo_removeKeybag(req.body, function(err, ret) {
		if (ret) {
			console.log("deleting keybag submission");
			res.end(JSON.stringify({"result":true}));
		} else {
			console.log("error deleting keybag submission, err => "+err);
			if (err) {
				res.end(JSON.stringify({"result":false, "error":err}));
			} else {
				res.end(JSON.stringify({"result":false, "error":null}));
			}
		}
	});
});

// handle a GET request for all of our stored keys
app.get('/api/find/all', (req, res) => {
	endpointAllRequestCounter.inc()
	mongo_getAllConfigsKeystore(function(err, items) {
		res.writeHead(200, {"Content-Type": "application/json"});
		res.end(JSON.stringify(items));
	})
});

// handle a GET request for keys, given a target device and build
app.get('/api/find/combo/:device/:build', (req, res) => {
	endpointDeviceBuildRequestCounter.inc()
	let targetDevice = req.params.device
	let targetBuild = req.params.build
	mongo_getAllConfigsKeystore(function(err, items) {
		let keystore = items
		res.writeHead(200, {"Content-Type": "application/json"});
		for (var i = keystore.length - 1; i >= 0; i--) {
			if (keystore[i]["device"] == targetDevice && keystore[i]["build"] == targetBuild) {
				res.end(JSON.stringify(keystore[i])) // return our found entry
				break; // just incase?
			}
		}
		res.end(JSON.stringify({"result":false, "error":"no keystore entries found for "+targetDevice+" and build "+targetBuild}))
	})
});

// handle a GET request for all keys available, given a target device
app.get('/api/find/device/:device', (req, res) => {
	endpointDeviceRequestCounter.inc()
	let targetDevice = req.params.device
	if (true) {}
	mongo_getAllConfigsKeystore(function(err, items) {
		let keystore = items
		var foundEntries = []
		for (var i = keystore.length - 1; i >= 0; i--) {
			if (keystore[i]["device"] == targetDevice) {
				console.log("entry found!")
				foundEntries.push(keystore[i])		
			}
		}
		res.writeHead(200, {"Content-Type": "application/json"});
		if (foundEntries.length > 0) {
			res.end(JSON.stringify(foundEntries)) 
		} else {
			res.end(JSON.stringify({"result":false, "error":"no keystore entries found for "+targetDevice}))
		}
	})
});

// handle a GET request for all keys available, given a target build
app.get('/api/find/build/:build', (req, res) => {
	endpointBuildRequestCounter.inc()
	let targetBuild = req.params.build
	mongo_getAllConfigsKeystore(function(err, items) {
		let keystore = items
		var foundEntries = []
		for (var i = keystore.length - 1; i >= 0; i--) {
			if (keystore[i]["build"] == targetBuild) {
				console.log("entry found!")
				foundEntries.push(keystore[i])		
			}
		}
		res.writeHead(200, {"Content-Type": "application/json"});
		if (foundEntries.length > 0) {
			res.end(JSON.stringify(foundEntries)) 
		} else {
			res.end(JSON.stringify({"result":false, "error":"no keystore entries found for "+targetBuild}))
		}
	});
});

function checkIfKeyIsAuthorized(keyToCheck, callback) {
	if (forceNoAuthFlag == true) {
		callback(true);
		return;
	}
	mongo_getAllAuthorizedAPIKeys(function(err, allAPIKeys) {
		var didFindKey = false;
		for (var i = allAPIKeys.length - 1; i >= 0; i--) {
			if (allAPIKeys[i]['key'] === keyToCheck) {
				didFindKey = true;
			}
		}
		callback(didFindKey);
	});
}

// handle keybag submission
app.post('/api/submit/keybags', function(req, res) {
	console.log("got keybag submission request for device "+req.body.device+" and build "+req.body.build)
	let requestUserAgent = req.headers['user-agent'];
	let requestToken = req.headers['x-api-key'];
	res.writeHead(200, {"Content-Type": "application/json"});
	if (!requestUserAgent.includes("grandmaster")) {
		res.end(JSON.stringify({"result":false, "error":"User-Agent is invalid"}))
	}
	if (requestToken == undefined) {
		res.end(JSON.stringify({"result":false, "error":"token is missing"}))
	}
	checkIfKeyIsAuthorized(requestToken, function(isAuthorized) {
		if (isAuthorized) {
			// continue on
			let submissionBuild = req.body.build
			let submissionDevice = req.body.device
			mongo_getAllKeybags(function(err, items) {
				let keystore = items
				if (checkKeystoreForDeviceAndBuild(keystore, submissionDevice, submissionBuild)) {
					console.log("keybag submission already exists");
					res.end(JSON.stringify({"result":false, "error":"entry already exists in the keybag queue"}));
				} else {
					if (validateKeybagsSubmission(req.body) != 0) {
						console.log("keybag submission failed validation");
						res.end(JSON.stringify({"result":false, "error":"submission failed validation"}));
					} else {
						mongo_addKeybag(req.body, function(err, ret){
							if (ret) {
								console.log("accepting keybag submission");
								res.end(JSON.stringify({"result":true}));
							} else {
								console.log("rejecting keybag submission, err => "+err);
								if (err) {
									res.end(JSON.stringify({"result":false, "error":err}));
								} else {
									res.end(JSON.stringify({"result":false, "error":null}));
								}
							}
						});
					}
				}
			});
		} else {
			res.end(JSON.stringify({"result":false, "error":"token is not authorized"}))
		}
	});
});

// handle a key submission
app.post('/api/submit/keys', function(req, res) {
	console.log("got keys submission request for device "+req.body.device+" and build "+req.body.build)
	let requestUserAgent = req.headers['user-agent'];
	let requestToken = req.headers['x-api-key'];
	res.writeHead(200, {"Content-Type": "application/json"});
	if (!requestUserAgent.includes("grandmaster")) {
		res.end(JSON.stringify({"result":false, "error":"User-Agent is invalid"}))
	}
	if (requestToken == undefined) {
		res.end(JSON.stringify({"result":false, "error":"token is missing"}))
	}

	checkIfKeyIsAuthorized(requestToken, function(isAuthorized) {
		if (isAuthorized) {
			foremanSubmissionsCounter.inc()
			// continue on
			let submissionBuild = req.body.build
			let submissionDevice = req.body.device
			mongo_getAllConfigsKeystore(function(err, items) {
				let keystore = items
				if (checkKeystoreForDeviceAndBuild(keystore, submissionDevice, submissionBuild)) {
					res.end(JSON.stringify({"result":false, "error":"entry already exists in the keystore"}));
				} else {
					if (validateKeystoreSubmission(req.body) != 0) {
						res.end(JSON.stringify({"result":false, "error":"submission failed validation"}));
					} else {
						mongo_addKeystoreConfig(req.body, function(err, ret){
							if (ret) {
								socketNewKeysetEmit(req.body);
								console.log("accepting submission");
								res.end(JSON.stringify({"result":true}));
							} else {
								console.log("rejecting submission");
								res.end(JSON.stringify({"result":false, "error":err}));
							} 
						});
					}
				}
			});
		} else {
			res.end(JSON.stringify({"result":false, "error":"token is not authorized"}))
		}
	});
});

function socketRoutineKeybagEmit() {
	console.log('emiting keybag queue to '+((socketClients.length == undefined) ? 0:socketClients.length)+' clients.');
	mongo_getAllKeybags(function(err, items) {
		for (var i = socketClients.length - 1; i >= 0; i--) {
			if (socketClients[i] != undefined) {
				console.log(JSON.stringify(items))
				socketClients[i].emit('queue', items);
			}
		}
	});
}

function socketRoutineHeartbeatEmit() {
	console.log('emiting a heartbeat to '+((socketClients.length == undefined) ? 0:socketClients.length)+' clients.');
	for (var i = socketClients.length - 1; i >= 0; i--) {
		if (socketClients[i] != undefined) {
			let epochNow = Math.floor(new Date() / 1000);
			socketClients[i].emit('heartbeat', epochNow);
		}
	}
}

function socketNewKeysetEmit(keyset) {
	console.log('emiting new keyset to '+((socketClients.length == undefined) ? 0:socketClients.length)+' clients.');
	for (var i = socketClients.length - 1; i >= 0; i--) {
		if (socketClients[i] != undefined) {
			var cleanKeyset = keyset;
			if (cleanKeyset['_id'] != undefined) {
				delete cleanKeyset['_id'];
			}
			socketClients[i].emit('keyset', cleanKeyset);
		}
	}
}

// connect to mongo
connectToMongo(function() {
	// reload the keystore
	mongo_getAllConfigsKeystore(function(err, items) {
		console.log("reloaded keystore")
	})
	// create our https API server
	var certOptions = {
		key: fs.readFileSync(process.env.FOREMAN_SSL_KEY),
		cert: fs.readFileSync(process.env.FOREMAN_SSL_CERT)
	};
	webServer = https.createServer(certOptions, app).listen(express_port, function () {
		console.log('foreman listening on port '+express_port)
	});
	socketServer = socket(webServer)
	socketServer.on('connection', function(client) {
		console.log('client connected');
		mongo_getAllKeybags(function(err, items) {
			console.log(JSON.stringify(items));
			client.emit('queue', items);
		});
		socketClients.push(client);
		client.on('clientheartbeat', function(data) {
			if (data) {
				console.log('got a clientheartbeat => '+(new Date(data*1000)));
			}
		});
		client.on('queue', function(ack) {
			mongo_getAllKeybags(function(err, items) {
				console.log(JSON.stringify(items))
				ack(items);
			});
		});
		client.on('disconnect', function() {
			console.log('client disconnected');
			var i = socketClients.indexOf(client);
      		socketClients.splice(i, 1);
		});
	});
	// routine emit a heartbeat every 1 minute
	setInterval(socketRoutineHeartbeatEmit, 60000);
	// routine emit the keybag queue every 15 minutes
	setInterval(socketRoutineKeybagEmit, 900000);
});
