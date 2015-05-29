"use strict";
var MelindaMergeController = require('melinda-merge-controller');
var MelindaClient = require('melinda-api-client');
var config = require('./config');
var argv = require('yargs').demand(2).argv;
var transaction = require('async-transaction');

var id1 = argv._[0];
var id2 = argv._[1];

var Q = require('q');

var client = new MelindaClient(config.api);
var merger = new MelindaMergeController(config.merge_controller);

Q.longStackSupport = true;

Q.all([
	client.loadRecord(id1),
	client.loadRecord(id2)
]).then(function(records) {

	merger.mergeRecords(records[0], records[1]).then(function(result) {

		transaction.run([
			{ action: deleteRecordFromMelinda.bind(null, result.records.preferred.original), rollback: undeleteRecordFromMelinda.bind(null, id1) },
			{ action: deleteRecordFromMelinda.bind(null, result.records.other.original),     rollback: undeleteRecordFromMelinda.bind(null, id2) },
			{ action: function() { return client.createRecord(result.merged).then(log("mergesave")); }, rollback: undefined }
		]).then(function() {
			console.log("ok");
		}).catch(function(error) {
			if (error instanceof transaction.RollbackError) {
				console.log("ROLLBACK FAILED");
				console.log(error);
				process.exit(1);
			}
			console.log(error.message);
			console.log("(rollback was successful)");
		}).done();

	}).catch(function(error) {
		console.log(error);
		if (error.name === "MergeValidationError") {
			console.error("Cannot merge:");
			console.error(error.error.message);	

		} else {
		
			throw error;
		}
	}).done();

}).done();


function log(title) {
	return function(res) {
		console.log("** " + title + " **");
		console.log(res);
	};
}

function undeleteRecordFromMelinda(recordId) {
	return client.loadRecord(recordId).then(function(record) {
		record.fields = record.fields.filter(function(field) { return field.tag !== "STA";});
		updateRecordLeader(record, 5, 'c');
		return client.updateRecord(record).then(function(res) {
			console.log("UNDELETE OK", res.messages);
		});
	});
	
}

function deleteRecordFromMelinda(record) {
	record.appendField(["STA", "", "", "a", "DELETED"]);
	updateRecordLeader(record, 5, 'd');

	return client.updateRecord(record).then(function(res) {
		console.log("DELETE OK", res.messages);
	});
}

function updateRecordLeader(record, index, characters) {
	record.leader = record.leader.substr(0,index) + characters + record.leader.substr(index+characters.length);
}
