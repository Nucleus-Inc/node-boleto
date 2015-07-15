var formatters = require('../../lib/formatters'),
    ediHelper = require('../../lib/edi-helper'),
    helper = require('./helper');

exports.options = {
    logoURL: 'http://app.meucrediario.com.br/images/public/boleto/756.png',
    codigo: '756'
}

exports.dvBarra = function (barra) {
    var resto2 = formatters.mod11(barra, 9, 1);
    return (resto2 == 0 || resto2 == 1 || resto2 == 10) ? 1 : 11 - resto2;
}

exports.barcodeData = function (boleto) {
    var codigoBanco = this.options.codigo;

    var numMoeda = "9";
    var fixo = "9"; // Numero fixo para a posição 05-05
    var ios = "0"; // IOS - somente para Seguradoras (Se 7% informar 7, limitado 9%) - demais clientes usar 0

    var fatorVencimento = formatters.fatorVencimento(boleto['data_vencimento']);

    var valor = formatters.addTrailingZeros(boleto['valor'], 10);

    var agencia = boleto['agencia'];
    var carteira = boleto['carteira'];
    var codigoCedente = formatters.addTrailingZeros(boleto['codigo_cedente'], 10);
    var convenio = formatters.addTrailingZeros(boleto['codigo_cedente'], 7);

    var sequencia = agencia + codigoCedente + formatters.addTrailingZeros(boleto['nosso_numero'], 7);
    var calculoDv = 0;
    var cont = 0;
    for (var num = 0; num <= sequencia.length; num++) {
        cont++;

        var constante = null;
        if (cont == 1) {
            // constante fixa Sicoob » 3197
            constante = 3;
        }
        if (cont == 2) {
            constante = 1;
        }
        if (cont == 3) {
            constante = 9;
        }
        if (cont == 4) {
            constante = 7;
            cont = 0;
        }
        calculoDv = calculoDv + (sequencia.substr(num, 1) * constante);
    }

    var resto = calculoDv % 11;
    var dv;
    if (resto == 0 || resto == 1) {
        dv = 0;
    }
    else {
        dv = 11 - resto;
    }

    var modalidadeCobranca = '02';
    var numeroParcela = '000';
    var nossoNumero = formatters.addTrailingZeros(boleto['nosso_numero'], 7) + dv;
    var campoLivre = modalidadeCobranca.toString() + // 2
        convenio.toString() + // 7
        nossoNumero.toString() + // 8
        numeroParcela.toString(); // 1

    var dvBarra = formatters.mod11(codigoBanco.toString() +
        numMoeda.toString() +
        fatorVencimento.toString() +
        valor.toString() +
        carteira.toString() +
        agencia.toString() +
        campoLivre.toString());

    var lineData = codigoBanco.toString() +  // 3
        numMoeda.toString() + // 1
        dvBarra.toString() + // 1
        fatorVencimento.toString() + // 4
        valor.toString() + // 10
        carteira.toString() + // 1
        agencia.toString() + // 4
        campoLivre.toString(); // 18

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

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var registro = line.substring(7, 8);

            if (registro == '0') {
                parsedFile['cnpj'] = line.substring(17, 32);
                parsedFile['razao_social'] = line.substring(72, 102);
                parsedFile['agencia_cedente'] = line.substring(32, 36);
                parsedFile['conta_cedente'] = line.substring(37, 47);
                parsedFile['data_arquivo'] = helper.dateFromEdiDate(line.substring(143, 152));
            } else if (registro == '3') {
                var segmento = line.substring(13, 14);

                if (segmento == 'T') {
                    var boleto = {};

                    boleto['codigo_ocorrencia'] = line.substring(15, 17);
                    boleto['vencimento'] = formatters.dateFromEdiDate(line.substring(69, 77));
                    boleto['valor'] = formatters.removeTrailingZeros(line.substring(77, 92));
                    boleto['tarifa'] = formatters.removeTrailingZeros(line.substring(193, 208));
                    boleto['banco_recebedor'] = formatters.removeTrailingZeros(line.substring(92, 95));
                    boleto['agencia_recebedora'] = formatters.removeTrailingZeros(line.substring(95, 100));

                    currentNossoNumero = formatters.removeTrailingZeros(line.substring(40, 52));
                    parsedFile.boletos[currentNossoNumero] = boleto;
                } else if (segmento == 'U') {
                    parsedFile.boletos[currentNossoNumero]['valor_pago'] = formatters.removeTrailingZeros(line.substring(77, 92));

                    var paid = parsedFile.boletos[currentNossoNumero]['valor_pago'] >= parsedFile.boletos[currentNossoNumero]['valor'];
                    paid = paid && parsedFile.boletos[currentNossoNumero]['codigo_ocorrencia'] == '17';

                    var boleto = parsedFile.boletos[currentNossoNumero];

                    boleto['pago'] = paid;
                    boleto['edi_line_number'] = i;
                    boleto['edi_line_checksum'] = ediHelper.calculateLineChecksum(line);
                    boleto['edi_line_fingerprint'] = boleto['edi_line_number'] + ':' + boleto['edi_line_checksum'];

                    currentNossoNumero = null;
                }
            }
        }

        return parsedFile;
    } catch (e) {
        return null;
    }
};
