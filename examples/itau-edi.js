var fs = require('fs');

var ediParser = require('../index').EdiParser;

console.log(ediParser.parse('itau', fs.readFileSync(__dirname + "/retorno/CN22046B.RET").toString()).boletos);