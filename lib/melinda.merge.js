/**
*
* @licstart  The following is the entire license notice for the JavaScript code in this file.
*
* A library and a command line tool for merging records in Melinda
*
* Copyright (C) 2015, 2017 University Of Helsinki (The National Library Of Finland)
*
* This file is part of melinda-merge-cli
*
* melinda-merge-cli program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as
* published by the Free Software Foundation, either version 3 of the
* License, or (at your option) any later version.
*
* melinda-merge-cli is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.
*
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <http://www.gnu.org/licenses/>.
*
* @licend  The above is the entire license notice
* for the JavaScript code in this file.
*
*/
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

				if (config.noop === true) {
					console.log("Merged record would be this:");
					
					console.log(result.merged.toString());
					return;
				}

				return transaction.run([
					{ action: deleteRecordFromMelinda.bind(null, result.records.preferred.original), rollback: undeleteRecordFromMelinda.bind(null, id1) },
					{ action: deleteRecordFromMelinda.bind(null, result.records.other.original),     rollback: undeleteRecordFromMelinda.bind(null, id2) },
					{ action: function() { return client.createRecord(result.merged, {bypass_low_validation: 1}).then(log("mergesave")); }, rollback: undefined }
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
			return client.updateRecord(record, {bypass_low_validation: 1}).then(function(res) {
				console.log("UNDELETE OK", res.messages);
			});
		});	
	}

	function deleteRecordFromMelinda(record) {
		record.appendField(["STA", "", "", "a", "DELETED"]);
		updateRecordLeader(record, 5, 'd');

		return client.updateRecord(record, {bypass_low_validation: 1}).then(function(res) {
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