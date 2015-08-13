#!/usr/bin/env node
"use strict";

var config = require('../config');
var argv = require('yargs').argv;
var Merger = require('../lib/melinda.merge');
var readline = require('readline');
var winston = require('winston');
var moment = require('moment');

var date_time_string = new moment().format();
var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({ json: false, timestamp: true }),
    new winston.transports.File({ filename: 'run_' + date_time_string + '.log', json: false })
  ],
  exceptionHandlers: [
    new (winston.transports.Console)({ json: false, timestamp: true }),
    new winston.transports.File({ filename: 'exceptions_' + date_time_string + '.log', json: false })
  ],
  exitOnError: true
});


// if --no-op, then just display the merged result without saving anything.
if (argv.op === false) {
	config.noop = true;
}

config.noop = true;

var merger = new Merger(config);

// if --batch, then read record id pairs from stdin until eof
if (argv.batch) {

	var queue = [];

	var rl = readline.createInterface({
	  input: process.stdin
	});

	rl.on('line', function(line) {
	
		var id_match_re = /^(\d+)[;,\s](\d+)$/;
		var match = id_match_re.exec(line);
		if (match === null) {
			console.error("Skipping line: " + line);
		} else {
			var id1 = match[1];
			var id2 = match[2];

			queue.push([id1, id2]);

		}

	});

	rl.on('close', function() {

		var startTime = moment();
		var doneCount = 0;

		mergeNext();

		function mergeNext() {

			if (doneCount > 0) {
				var now = moment();
				var timeTaken = now - startTime;
				var timePerItem = timeTaken / doneCount;
				var itemsLeft = queue.length;

				var estimatedCompletion = now.add(timePerItem * itemsLeft, 'ms');
				logger.info("Queue has %d items left. Estimated completion at %s", itemsLeft, estimatedCompletion.format());
			}
			doneCount++;

			var pair = queue.pop();
			
			if (pair === undefined) {
				logger.info("Queue drained. Batch complete.");
			} else {
				logger.info("Next pair: %s %s", pair[0], pair[1]);
				var id1 = pair[0];
				var id2 = pair[1];
				merger.merge(id1, id2).then(function() {
					logger.info("%s %s: merge ok", id1, id2);
				})
				.progress(function(msg) {
					logger.info("%s %s: %s", id1, id2, msg);
				})
				.catch(errorHandler(id1,id2))
				.done(mergeNext);

			}
		}

	});

} else {
	argv = require('yargs').demand(2).argv;
	var id1 = argv._[0];
	var id2 = argv._[1];

	merger.merge(id1, id2).then(function() {
		logger.info("%s %s: merge ok", id1, id2);
	})
	.catch(errorHandler(id1,id2))
	.done();

}

function errorHandler(id1,id2) {

	return function(error) {

		if (error instanceof Error) {

			if (error.name === "MergeValidationError") {

				logger.error("%s %s Cannot merge:", id1, id2);
				error.message.split("\n").forEach(function(message) {
					logger.error("%s %s %s", id1, id2, message);
				});
			} else if (error.name == "InvalidRecordError") {
				logger.error("%s %s Invalid record: %s", id1, id2, error.message);

			} else if (error.status_code !== undefined && error.status_code == 500) {

				logger.error("%s %s Internal server error from Melinda. Skipping.", id1, id2);

			} else {
				throw error;
			}

		} else {

			logger.error("ERROR", error);
			if (error.errors) {
				error.errors.forEach(function(err) {
					logger.error("%s %s %s %s", id1, id2, err.code, err.message);
				});	
			}
			
		}

	};
}