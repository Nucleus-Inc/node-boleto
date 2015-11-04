var express = require('express');

var app = express();

var Boleto = require('../index').Boleto;

var boleto = new Boleto({
  'banco': "caixa",
  'data_emissao': new Date(),
  'data_vencimento': new Date(new Date().getTime() + 5 * 24 * 3600 * 1000),
  'valor': 150020,
  'nosso_numero': "7",
  'numero_documento': "1",
  'cedente': "Pagar.me Pagamentos S/A",
  'cedente_cnpj': "18727053000174",
  'agencia': "1869",
  'codigo_cedente': "2436694",
  'carteira': "24", //14, 24
  'pagador': "Nome do pagador\nCPF: 000.000.000-00",
  'local_de_pagamento': "PAGÁVEL EM QUALQUER BANCO ATÉ O VENCIMENTO.",
  'instrucoes': "Sr. Caixa, aceitar o pagamento e não cobrar juros após o vencimento.",
})

app.use(express.static(__dirname + '/../'));

app.get('/', function (req, res) {
  boleto.renderHTML(function (html) {
    return res.send(html);
  });
});

app.listen(3003);
