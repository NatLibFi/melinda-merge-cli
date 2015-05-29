"use strict";

var MelindaClient = require('melinda-api-client');
var Q = require('q');
var transaction = require('async-transaction');
Q.longStackSupport = true;

function constructor(config) {

	var client = new MelindaClient(config);

	function splitRecord(id) {
		id = toAlephId(id);

		return client.loadRecord(id)
		.then(parseSourceRecordIds)
		.then(loadRecords)
		.then(markUndeleted)
		.then(addLinksFrom(id))
		.then(function(recs) {

			var ids = recs.map(recordToId);

			return client.loadRecord(id).then(function(record) {

				if (validateLOWTagGroups(record, recs) === false) {
					throw new Error("LOW tag group mismatch between merged record and source records. Autosplit not possible");
				}

				return transaction.run([
					{ action: updateMergedRecordToDeleted.bind(null, record, ids), rollback: undeleteMergedRecordFromMelinda.bind(null, id) },
					{ action: function() { return client.updateRecord(recs[0]); }, rollback: deleteRecordFromMelinda.bind(null, ids[0]) },
					{ action: function() { return client.updateRecord(recs[1]); }, rollback: undefined }
				]).catch(function(error) {
					if (error instanceof transaction.RollbackError) {
						console.log(error);
						console.log("ROLLBACK FAILED");
						console.log("You must manually check the state of records", ids, "and", id);
						process.exit(1);
					}
					error.message += " (rollback was successful)";
					throw error;

				});
				
			});
			
		});
	}

	function validateRecordHasNotBeenChanged(mergedRecord) {

		var changeLog = mergedRecord.fields.filter(byTag('CAT'));
		var mergeTime = mergedRecord.fields.filter(byTag('583'));

	}

	function flatten(array) {
		return Array.prototype.concat.apply([], array);
	}

	function validateLOWTagGroups(mergedRecord, sourceRecordArray) {

		var mergedRecordLOWs = mergedRecord.fields.filter(byTag('LOW')).map(toSubvalue('a')).reduce(unique, []);
		var sourceRecordLOWs = sourceRecordArray.map(function(record) {
			return flatten(record.fields.filter(byTag('LOW')).map(toSubvalue('a')));
		});
		mergedRecordLOWs = flatten(mergedRecordLOWs);
		sourceRecordLOWs = flatten(sourceRecordLOWs);

		sourceRecordLOWs = sourceRecordLOWs.reduce(unique, []);

		return setsIdentical(mergedRecordLOWs, sourceRecordLOWs);
	}

	function setsIdentical(set1, set2) {
		return isSubset(set1, set2) && isSubset(set2, set1);
	}

	function isSubset(set1, set2) {
		return set1.reduce(function(sofar, item) {
			if (set2.indexOf(item) === -1) {
				sofar = false;
			}
			return sofar;
		}, true);
	}

	function unique(memo, item) {
		if (memo === undefined) {
			memo = [];
		}
		if (memo.indexOf(item) == -1) {
			memo.push(item);
		}
		return memo;
	}

	function byTag(tag) {
		return function(field) {
			return field.tag === tag;
		};
	}

	function toSubvalue(code) {
		return function(field) {
			return field.subfields
					.filter(function(subfield) { return subfield.code == code; })
					.map(function(subfield) { return subfield.value; });
		};
	}

	function updateMergedRecordToDeleted(record, ids) {
		record.appendField(["STA", "", "", "a", "DELETED"]);
		record.insertField({
				tag: '583',
				subfields: [
					{ code: 'a', value:'SPLIT TO ' + '(FI-MELINDA)' + ids[0] + " + " + '(FI-MELINDA)' + ids[1] },
					{ code: 'c', value: formatDate(new Date()) },
					{ code: '5', value:'MELINDA' },
				]
		});

		updateRecordLeader(record, 5, 'd');

		return client.updateRecord(record);
	}

	function undeleteMergedRecordFromMelinda(recordId) {
		return client.loadRecord(recordId).then(function(record) {
			record.fields = record.fields.filter(function(field) { return field.tag !== "STA";});
			updateRecordLeader(record, 5, 'c');

			removeLatestSplitNote(record);

			return client.updateRecord(record).then(function(res) {
				console.log("UNDELETE OK", res.messages);
			});
		});
	}

	function deleteRecordFromMelinda(recordId) {

		return client.loadRecord(recordId).then(function(record) {
			record.appendField(["STA", "", "", "a", "DELETED"]);
			updateRecordLeader(record, 5, 'd');

			return client.updateRecord(record).then(function(res) {
				console.log("DELETE OK", res.messages);
			});
		});
	}

	function recordToId(record) {
		var f001List = record.fields.filter(function(field) {
			return field.tag === "001";
		}).map(to('value'));

		if (f001List.length !== 1) {
			throw new Error("Could not parse id from record");
		}

		return f001List[0];
	}

	function formatDate(date) {
	    var tzo = -date.getTimezoneOffset();
	    var dif = tzo >= 0 ? '+' : '-';

	    return date.getFullYear() +
	        '-' + pad(date.getMonth()+1) +
	        '-' + pad(date.getDate()) +
	        'T' + pad(date.getHours()) +
	        ':' + pad(date.getMinutes()) +
	        ':' + pad(date.getSeconds()) +
	        dif + pad(tzo / 60) +
	        ':' + pad(tzo % 60);

	    function pad(num) {
			var str = num.toString();
			while(str.length < 2) {
				str = "0" + str;
			}
			return str;
	    }
	}

	function markUndeleted(recordList) {
		recordList.forEach(function(record) {
			record.fields = record.fields.filter(function(field) { return field.tag !== "STA"; });
			updateRecordLeader(record, 5, 'c');
		});
		return recordList;
	}

	function addLinksFrom(id) {
		return function(recordList) {

			recordList.forEach(function(record) {
				if (!record.fields.some(hasFieldValue("035","z", "(FI-MELINDA)" + id))) {
					record.insertField(["035", "", "", "z", "(FI-MELINDA)" + id]);
				}
			});
			return recordList;
		};
	}

	function hasFieldValue(tag, subfieldCode, subfieldValue) {
		return function(field) {
			if (field.tag === tag) {
				return field.subfields.some(function(subfield) {
					return (subfield.code === subfieldCode && subfield.value === subfieldValue);
				});
			}
			return false;
		};
	}

	function loadRecords(idList) {
		return Q.all(idList.map(function(id) {
			return client.loadRecord(id);
		}));
	}

	function getLatestOperationNoteFrom583(record) {

		var f583 = record.fields.filter(function(field) { return field.tag === "583"; });

		if (f583.length === 0) {
			throw new Error("Cannot split: record doesn't contain merge information in field 583");
		}

		f583.sort(function(a,b) {
			var a_time = a.subfields.filter(toCode('c')).map(to('value'))[0];
			var b_time = b.subfields.filter(toCode('c')).map(to('value'))[0];

			return (new Date(a_time) - new Date(b_time));
		});

		return f583.pop();

	}

	function parseSourceRecordIds(record) {

		var latest_583 = getLatestOperationNoteFrom583(record);

		var info = latest_583.subfields.filter(toCode('a'));
		if (info[0] === undefined) {
			throw new Error("Cannot split: could not parse source records from field 583");
		}
		if (/^SPLIT TO/.test(info[0].value)) {
			throw new Error("Record has already been splitted.");
		}
		var match = /MERGED FROM \(FI-MELINDA\)(\d+) \+ \(FI-MELINDA\)(\d+)/.exec(info[0].value);
		if (match === null) {
			throw new Error("Cannot split: could not parse source records from field 583");	
		}

		var sourceId1 = match[1];
		var sourceId2 = match[2];
		
		return [sourceId1, sourceId2];

	}

	function removeLatestSplitNote(record) {
		var f583 = record.fields.filter(function(field) { return field.tag === "583"; });

		f583.sort(function(a,b) {
			var a_time = a.subfields.filter(toCode('c')).map(to('value'))[0];
			var b_time = b.subfields.filter(toCode('c')).map(to('value'))[0];

			return (new Date(a_time) - new Date(b_time));
		});

		var latest_583 = f583.pop();
		var info = latest_583.subfields.filter(toCode('a'));

		if (/^SPLIT TO/.test(info[0].value)) {

			record.fields = record.fields.filter(function(field) {
				return field !== latest_583;
			});
		}

	}

	function to(attr) {
		return function(obj) {
			return obj[attr];
		};
	}
	function toCode(code) {
		return function(sub) {
			return sub.code === code;
		};
	}

	function updateRecordLeader(record, index, characters) {
		record.leader = record.leader.substr(0,index) + characters + record.leader.substr(index+characters.length);
	}

	function toAlephId(id) {
		var idStr = id.toString();
		while (idStr.length < 9) {
			idStr = "0" + idStr;
		}
		return idStr;
	}

	return {
		split: splitRecord
	};

}

module.exports = constructor;