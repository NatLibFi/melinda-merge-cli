#!/usr/bin/env node
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
