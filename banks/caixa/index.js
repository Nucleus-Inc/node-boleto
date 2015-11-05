var formatters = require('../../lib/formatters'),
    ediHelper = require('../../lib/edi-helper'),
    helper = require('./helper');

exports.options = {
    logoURL: 'https://app.meucrediario.com.br/images/public/boleto/104.png',
    codigo: '104'
}

exports.dvBarra = function (barra) {
    var resto2 = formatters.mod11(barra, 9, 1);
    return (resto2 == 0 || resto2 == 1 || resto2 == 10) ? 1 : 11 - resto2;
}

exports.dvGeral = function(nossoNumero) {
    return formatters.mod11(nossoNumero.toString(), 9, 0);
}

exports.barcodeData = function (boleto) {
    var codigoBanco = this.options.codigo;

    var numMoeda = "9";

    var fatorVencimento = formatters.fatorVencimento(boleto['data_vencimento']);

    var valor = formatters.addTrailingZeros(boleto['valor'], 10);

    var agencia = boleto['agencia'];
    var carteira = boleto['carteira'];
    var convenio = formatters.addTrailingZeros(boleto['codigo_cedente'], 6);
    var convenioDv = this.dvGeral(convenio);

    var nossoNumeroAux = carteira.toString()+
            formatters.addTrailingZeros(boleto['nosso_numero'], 15);

    var nossoNumero = nossoNumeroAux.toString().substr(2,3) + // 3
        nossoNumeroAux.toString().substr(0,1) + // 1
        nossoNumeroAux.toString().substr(5,3) + // 3
        nossoNumeroAux.toString().substr(1,1) + // 1
        nossoNumeroAux.toString().substr(8,9); // 9

    var nossoNumeroDv = this.dvGeral(convenio.toString() +
                                     convenioDv.toString() +
                                     nossoNumero);

    var bar1 = codigoBanco.toString() +  // 3
               numMoeda.toString(); // 1

    var bar2 = fatorVencimento.toString() + // 4
        valor.toString() + // 10
        convenio.toString() + // 6
        convenioDv.toString() + // 1
        nossoNumero.toString() + // 17
        nossoNumeroDv.toString(); // 2

    var calculoDv = 0;
    var mult = 2;

    for(var x = (bar2.length-1); x >= 0; x--) {
        var n = parseInt(bar2.charAt(x));
        calculoDv += n*mult;

        mult++;
        if (mult==10) {
            mult=2;
        }
    }

    for(var x = (bar1.length-1); x >= 0; x--) {
        var n = parseInt(bar1.charAt(x));
        calculoDv += n*mult;

        mult++;
        if (mult==10) {
            mult=2;
        }
    }

    var resto = calculoDv % 11;
    var dv = (resto == 0 || resto == 1 || resto == 10) ? 1 : 11 - resto;

    var lineData = bar1.toString()+dv.toString()+bar2.toString();
    return lineData;
}

exports.linhaDigitavel = function (barcodeData) {
    // Posição 	Conteúdo
    // 1 a 3    Número do banco
    // 4        Código da Moeda - 9 para Real
    // 5        Digito verificador do Código de Barras
    // 6 a 19   Valor (12 inteiros e 2 decimais)
    // 20 a 44  Campo Livre definido por cada banco
    var campos = new Array();

    // 1. Campo - composto pelo código do banco, código da moéda, as cinco primeiras posições
    // do campo livre e DV (modulo10) deste campo
    var campo = barcodeData.substring(0, 3) + barcodeData.substring(3, 4) + barcodeData.substring(19, 20) + barcodeData.substring(20, 24);
    campo = campo + formatters.mod10(campo);
    campo = campo.substring(0, 5) + '.' + campo.substring(5, campo.length);
    campos.push(campo);

    // 2. Campo - composto pelas posiçoes 6 a 15 do campo livre
    // e livre e DV (modulo10) deste campo
    var campo = barcodeData.substring(24, 34);
    campo = campo + formatters.mod10(campo);
    campo = campo.substring(0, 5) + '.' + campo.substring(5, campo.length);
    campos.push(campo);

    // 3. Campo composto pelas posicoes 16 a 25 do campo livre
    // e livre e DV (modulo10) deste campo
    var campo = barcodeData.substring(34, 44);
    campo = campo + formatters.mod10(campo);
    campo = campo.substring(0, 5) + '.' + campo.substring(5, campo.length);
    campos.push(campo);

    // 4. Campo - digito verificador do codigo de barras
    var campo = barcodeData.substring(4, 5);
    campos.push(campo);

    // 5. Campo composto pelo valor nominal pelo valor nominal do documento, sem
    // indicacao de zeros a esquerda e sem edicao (sem ponto e virgula). Quando se
    // tratar de valor zerado, a representacao deve ser 000 (tres zeros).
    var campo = barcodeData.substring(5, 9) + barcodeData.substring(9, 19);
    campos.push(campo);

    return campos.join(" ");
}

exports.parseEDIFile = function (fileContent) {
    try {
        var lines = fileContent.split("\n");
        var parsedFile = {
            boletos: {}
        };

        var currentNossoNumero = null;
        var hasCompanyData = false;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var registro = line.substring(0, 1);
        }

        return parsedFile;
    } catch (e) {
        console.log(e);
        return null;
    }
};
