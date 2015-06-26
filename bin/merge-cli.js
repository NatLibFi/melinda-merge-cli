#!/usr/bin/env node
"use strict";

var config = require('../config');
var argv = require('yargs').demand(2).argv;
var Merger = require('../lib/melinda.merge');

var id1 = argv._[0];
var id2 = argv._[1];

// if --no-op, then just display the merged result without saving anything.
if (argv.op === false) {
	config.noop = true;
}

var merger = new Merger(config);

merger.merge(id1, id2).then(function() {
	console.log("ok");
}).catch(function(error) {


	if (error instanceof Error) {

		if (error.name === "MergeValidationError") {
			console.error("Cannot merge:");
			console.error(error.error.message);	
			//console.error(error.error.stack);
		} else {
			throw error;
		}

	} else {
		console.log("ERROR");
		error.errors.forEach(function(err) {
			console.log(err.code, err.message);
		});

	}

}).done();

