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
/*jshint mocha:true*/
"use strict";

var chai = require('chai');
var expect = chai.expect;
var Record = require('marc-record-js');
var fs = require('fs');
var MockAPI = require('melinda-api-mock');
var Splitter = require('../lib/melinda.split.js');
var transaction = require('async-transaction');

var api = new MockAPI({
	recordsDir: __dirname + "/records/"
});
var port = 9521;

var splitter = new Splitter({
	endpoint: "http://localhost:" + port,
	user: "test",
	password: "test"
});

describe('Split', function() {

	before(function(done) {
		api.listen(port, done);
	});
	afterEach(function(done) {
		api.reset();
		done();
	});

	it('should split merged record', function(done) {
		splitter.split("007012503").then(done).done();

	});

	it('should throw if record does not have field 583 with merge information', function(done) {
		splitter.split("007012502").then(function() {
			throw new Error("Split was ok");
		}).catch(function(error) {
			expect(error.message).to.equal("Cannot split: record doesn't contain merge information in field 583");
			done();
		}).done();
	});

	it('should throw if there is LOW tag mismatch', function(done) {
		splitter.split("007012505").then(function() {
			throw new Error("Split was ok");
		}).catch(function(error) {
			expect(error.message).to.equal("LOW tag group mismatch between merged record and source records. Autosplit not possible");
			done();
		}).done();
	});

	it('should throw if there are any errors and rollback is succesful', function(done) {
		api.setRecord("007012502").toReturn('put', 500);

		splitter.split("007012503").then(function() {
			throw new Error("Split was ok");
		}).catch(function(error) {
			expect(error.message).to.equal("Internal Server Error (rollback was successful)");
			
			expect(api.trace()).to.eql([ 
				[ 'get', '007012503' ],
				[ 'get', '007012501' ],
				[ 'get', '007012502' ],
				[ 'get', '007012503' ],
				[ 'put', '007012503' ],
				[ 'put', '007012501' ],
				[ 'put', '007012502' ], // this fails, so we start rollback
				[ 'get', '007012501' ],
				[ 'put', '007012501' ],
				[ 'get', '007012503' ],
				[ 'put', '007012503' ]
			]);

			done();
		}).done();

	});
	
	it('should throw if there are any errors and rollback fails', function(done) {

		api.setRecord("007012502").toReturn('put', 500);
		api.setRecord("007012501").toReturn('put', 0); // 0 means continue normally, so first put will be ok
		api.setRecord("007012501").toReturn('put', 500); // second put is done while executing a rollback, so failing this will fail the rollback and cause fatal error.


		splitter.split("007012503").then(function() {
			throw new Error("Split was ok");
		}).catch(function(error) {
			
			
			expect(error.message).to.equal("Internal Server Error");
			expect(error).to.be.an.instanceof(transaction.RollbackError);

			expect(api.trace()).to.eql([ 
				[ 'get', '007012503' ],
				[ 'get', '007012501' ],
				[ 'get', '007012502' ],
				[ 'get', '007012503' ],
				[ 'put', '007012503' ],
				[ 'put', '007012501' ],
				[ 'put', '007012502' ], // this fails, so we start rollback
				[ 'get', '007012501' ],
				[ 'put', '007012501' ] // this fails, so rollback fails causing a transaction.RollbackError. System cannot recover from this failure.
			]);
			

			done();
		}).done();

	});
	
	after(function(done) {
		api.close(done);
	});

});


