"use strict";

var config = require('./config');
var argv = require('yargs').demand(2).argv;
var Merger = require('./lib/melinda.merge');

var id1 = argv._[0];
var id2 = argv._[1];

var merger = new Merger(config);

merger.merge(id1, id2).then(function() {
	console.log("ok");
}).catch(function(error) {

	console.log("ERROR");
	
	if (error.name === "MergeValidationError") {
		console.error("Cannot merge:");
		console.error(error.error.message);	
	} else {
		throw error;
	}
}).done();

