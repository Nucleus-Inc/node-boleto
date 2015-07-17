exports.dateFromEdiDate = function (ediDate) {
    var ano = parseInt(ediDate.substring(4, 8));
    if (ano < 80) {
        ano += 2000;
    }
    return new Date(ano, parseInt(ediDate.substring(2, 4)) - 1, parseInt(ediDate.substring(0, 2)));
}
