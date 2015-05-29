/*	{ extractor: selector.extractEncodingLevel, normalizer: nullNormalizer },
	{ extractor: selector.extractCatalogingSourceFrom008 },
	{ extractor: selector.extractRecordAge, 		normalizer: lexicalNormalizer },
	{ extractor: selector.extractLocalOwnerCount },
	{ extractor: selector.extractLatestChange(byHumanFilter), 	normalizer: lexicalNormalizer },
	{ extractor: selector.extractSpecificLocalOwner("FENNI") },
	{ extractor: selector.extractSpecificLocalOwner("VIOLA") },
	{ extractor: selector.extractFieldCount("650") },
	{ extractor: selector.extractPublicationYear, normalizer: reverseLexicalNormalizer },
	{ extractor: selector.extractSpecificFieldValue('042', ['a'], 'finb') },
	{ extractor: selector.extractFieldLength('250') },
	{ extractor: selector.extractNonFinnishHELKA },
	{ extractor: selector.extractSpecificSingleLocalOwner("VAARI"), normalizer: invertScores }

*/
(function(root, factory) {
	"use strict";
	if (typeof define === 'function' && define.amd) {
		define([], factory);
	} else if(typeof exports === 'object') {
		module.exports = factory();  // jshint ignore:line
	} else {
		root.MelindaPreferenceStrategy = factory();
	}
}(this, function() {
	"use strict";

	var strategy = { 
	  weights:   [ 20, 823, 80, 255, 198, 637, 747, 223, 568, 690, 186, 69, 916 ], 
	 // weights: [ 38, 921, 83, 551, 129, 928, 204, 292, 573 ],
	 // weights: [ 1, 11, 1, 15, 15, 13, 14, 13 ],
	  adjusts: [ 'qi', 'qi', 'qd', 'li', 'qd', 'ld', 'li', 'li', 'ld' ],
	  names: [ "ENL", "CSO", "AGE", "LOW", "LCH", "FEN", "VIO", "650", "PDA", "042", "250", "HEL", "VAA"]
	};

	return strategy;
}));
