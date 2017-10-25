#!/usr/bin/env node
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

var Splitter = require("../lib/melinda.split.js");
var argv = require('yargs').demand(1).argv;
var colors = require('colors');
var config = require('../config');

var DEBUG = process.env.NODE_ENV == "debug";
var splitter = new Splitter(config.api);

var id = argv._[0];

splitter.split(id)
.then(function() {
	console.log("ok");
}).catch(function(error) {
	console.error(colors.red("Error: " + error.message));
	if (DEBUG) console.log(error.stack);
}).done();
