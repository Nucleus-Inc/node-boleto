var formatters = require('../../lib/formatters'),
    ediHelper = require('../../lib/edi-helper'),
    helper = require('./helper');

exports.options = {
    logoURL: 'https://s3.amazonaws.com/boleto.meucrediario.com.br/756.png',
    codigo: '756'
};

exports.dvBarra = function (barra) {
    var resto2 = formatters.mod11(barra, 9, 1);
    return (resto2 == 0 || resto2 == 1 || resto2 == 10) ? 1 : 11 - resto2;
};

exports.barcodeData = function (boleto) {
    var codigoBanco = this.options.codigo;

    var numMoeda = "9";
    var fatorVencimento = formatters.fatorVencimento(boleto['data_vencimento']);

    var valor = formatters.addTrailingZeros(boleto['valor'], 10);

    var agencia = boleto['agencia'];
    var carteira = boleto['carteira'];
    var codigoCedente = formatters.addTrailingZeros(boleto['codigo_cedente'], 10);
    var convenio = formatters.addTrailingZeros(boleto['codigo_cedente'], 7);

    var sequencia = agencia + codigoCedente + formatters.addTrailingZeros(boleto['nosso_numero'], 7);

    var calculoDv = 0;
    var indice = [3,1,9,7,3,1,9,7,3,1,9,7,3,1,9,7,3,1,9,7,3]
    for (var num = 0; num < sequencia.length; num++) {
        if (num != 4) {
            var constante = indice[num];
            calculoDv += parseInt(sequencia[num]) * constante;
        }
    }

    var resto = calculoDv % 11;
    var dv = (resto == 0 || resto == 1) ? 0 : 11 - resto;

    var modalidadeCobranca = '02';
    var numeroParcela = '000';
    var nossoNumero = formatters.addTrailingZeros(boleto['nosso_numero'], 7) + dv.toString();
    var campoLivre = modalidadeCobranca.toString() + // 2
        convenio.toString() + // 7
        nossoNumero.toString() + // 8
        numeroParcela.toString(); // 1

    var dvBarra = this.dvBarra(codigoBanco.toString() +
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
};

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

            if (registro == '0') {
                parsedFile['razao_social'] = line.substring(46, 76);
                parsedFile['data_arquivo'] = helper.dateFromEdiDate(line.substring(94, 100));
            } else if (registro == '1') {
                var boleto = {};

                parsedFile['cnpj'] = formatters.removeTrailingZeros(line.substring(3, 17));
                parsedFile['carteira'] = formatters.removeTrailingZeros(line.substring(85, 88));
                parsedFile['agencia_cedente'] = formatters.removeTrailingZeros(line.substring(17, 21));
                parsedFile['conta_cedente'] = formatters.removeTrailingZeros(line.substring(22, 30));

                boleto['codigo_ocorrencia'] = line.substring(108, 110);
                boleto['data_ocorrencia'] = helper.dateFromEdiDate(line.substring(110, 116));
                boleto['data_credito'] = helper.dateFromEdiDate(line.substring(175, 181));
                boleto['vencimento'] = helper.dateFromEdiDate(line.substring(146, 152));

                boleto['valor'] = formatters.removeTrailingZeros(line.substring(152, 165));
                boleto['valor_pago'] = formatters.removeTrailingZeros(line.substring(253, 266));
                boleto['valor_tarifa'] = formatters.removeTrailingZeros(line.substring(181, 188));

                boleto['banco_recebedor'] = formatters.removeTrailingZeros(line.substring(165, 168));
                boleto['agencia_recebedora'] = formatters.removeTrailingZeros(line.substring(168, 173));

                boleto['edi_line_number'] = i;
                boleto['edi_line_checksum'] = ediHelper.calculateLineChecksum(line);
                boleto['edi_line_fingerprint'] = boleto['edi_line_number'] + ':' + boleto['edi_line_checksum'];

                var isPaid = (parseInt(boleto['valor_pago']) >= parseInt(boleto['valor']) || boleto['codigo_ocorrencia'] == '06');
                boleto['pago'] = isPaid;

                currentNossoNumero = formatters.removeTrailingZeros(line.substring(62, 73));
                parsedFile.boletos[currentNossoNumero] = boleto;
            }
        }

        return parsedFile;
    } catch (e) {
        console.log(e);
        return null;
    }
};

exports.getHeaderEdiFile = function (params) {
    var sequencial = formatters.addTrailingZeros(params.sequencia||1, 6);

    var line = '0'; // Identificação do Registro Header - 1
    line += '1'; // Tipo de Operação - 1
    line += 'REMESSA';  // Identificação por Extenso do Tipo de Operação - 7
    line += '01';  // Identificação do Tipo de Serviço - 2
    line += 'COBRANÇA';  // Identificação por Extenso do Tipo de Serviço - 8
    line += '       ';  // Complemento do Registro: Brancos - 7
    line += formatters.addTrailingZeros(params.agencia, 4);  // Prefixo da Cooperativa - 4
    line += formatters.mod11(params.agencia);  // Dígito Verificador do Prefixo - 1
    line += formatters.addTrailingZeros(params.codigo_cedente, 8);  // Código do Cliente/Beneficiário - 8
    line += formatters.mod11(params.codigo_cedente);  // Dígito Verificador do Código - 1
    line += '      ';  // Número do convênio líder: Brancos - 6
    line += formatters.addTrailingSpaces(params.cedente, 30); // Nome do Beneficiário - 30
    line += '756BANCOOBCED'; // Identificação do Banco: "756BANCOOBCED" - 18
    line += formatters.formatDate(params.data_geracao||new Date(), "ddmmaa"); // Data da Gravação da Remessa: formato ddmmaa - 6
    line += '0'+sequencial.toString(); // Seqüencial da Remessa: número seqüencial acrescido de 1 a cada remessa. Inicia com "0000001" - 7
    line += formatters.addTrailingSpaces('', 287);  // Complemento do Registro: Brancos - 287
    line += sequencial.toString(); // Seqüencial do Registro:”000001” - 6

    return line;
};

exports.getDetail = function(params, boleto) {
    var line = '1'; // Identificação do Registro Detalhe: 1 (um) - 1

    /*
        Tipo de Inscrição do Beneficiário:
        "01" = CPF
        "02" = CNPJ  - 2
     */
    var numero = "";
    if ((boleto.pagador_cnpj) && (boleto.pagador_cnpj.toString().length >= 14)) {
        line += '02';
        line += formatters.addTrailingZeros(boleto.pagador_cnpj.toString(), 14); // Número do CPF/CNPJ do Beneficiário - 14
    } else {
        line += '01';
        line += formatters.addTrailingZeros(boleto.pagador_cpf.toString(), 14); // Número do CPF/CNPJ do Beneficiário - 14
    }

    line += formatters.addTrailingZeros(params.agencia, 4);  // Prefixo da Cooperativa - 4
    line += formatters.mod11(params.agencia);  // Dígito Verificador do Prefixo - 1
    line += formatters.addTrailingZeros(params.conta, 8);  // Conta Corrente - 8
    line += formatters.mod11(params.conta);  // Dígito Verificador da Conta - 1
    line += formatters.addTrailingZeros(params.codigo_cedente, 6);  // Número do Convênio de Cobrança do Beneficiário - 6
    line += formatters.addTrailingSpaces('', 25);  // Número de Controle do Participante: Brancos - 25
    line += formatters.addTrailingZeros(boleto["nosso_numero"], 11);  // Nosso Número - 11
    line += formatters.addTrailingZeros(boleto["nosso_numero_dv"], 1);  // Digito verificador do Nosso Número - 1
    line += formatters.addTrailingZeros(boleto["parcela"]||'1', 2);  // Número da Parcela: "01" se parcela única - 2
    line += '00'; // Grupo de Valor: "00" - 2

    return line;
};