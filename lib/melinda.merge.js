"use strict";
var MelindaMergeController = require('melinda-merge-controller');
var MelindaClient = require('melinda-api-client');
var transaction = require('async-transaction');
var Q = require('q');
Q.longStackSupport = true;

function constructor(config) {

	var client = new MelindaClient(config.api);
	var merger = new MelindaMergeController(config.merge_controller);

	function merge(id1, id2) {

		return Q.all([
			client.loadRecord(id1),
			client.loadRecord(id2)
		]).then(function(records) {

			return merger.mergeRecords(records[0], records[1]).then(function(result) {

				return transaction.run([
					{ action: deleteRecordFromMelinda.bind(null, result.records.preferred.original), rollback: undeleteRecordFromMelinda.bind(null, id1) },
					{ action: deleteRecordFromMelinda.bind(null, result.records.other.original),     rollback: undeleteRecordFromMelinda.bind(null, id2) },
					{ action: function() { return client.createRecord(result.merged).then(log("mergesave")); }, rollback: undefined }
				]).catch(function(error) {

					if (error instanceof transaction.RollbackError) {
						console.log("ROLLBACK FAILED");
						console.log(error);
						process.exit(1);
					}

					error.message += " (rollback was successful)";
					throw error;
				});

			});

		});

	}

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

	return {
		merge: merge
	};
}

module.exports = constructor;