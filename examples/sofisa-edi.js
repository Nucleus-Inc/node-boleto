var fs = require('fs');

var ediParser = require('../index').EdiParser;

console.log(ediParser.parse('itau', fs.readFileSync(__dirname + "/sofisa_PV119539_549.294").toString()).boletos);