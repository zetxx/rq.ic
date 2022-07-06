/*
  The following is an example of how to use the parser as a standalone module.
  Both parseRequest and parseResponse can be used to parse a raw HTTP request/response from a Buffer.
*/

// Replace the require when using the module from npm.
const {HTTPParser} = require('http-parser-js');

function parseRequest(input) {
    if (!input.length) {
        return input;
    }
    const parser = new HTTPParser(HTTPParser.REQUEST);
    let complete = false;
    let shouldKeepAlive;
    let upgrade;
    let method;
    let url;
    let versionMajor;
    let versionMinor;
    let headers = [];
    let trailers = [];
    let bodyChunks = [];

    parser[HTTPParser.kOnHeadersComplete] = function (req) {
        shouldKeepAlive = req.shouldKeepAlive;
        upgrade = req.upgrade;
        method = HTTPParser.methods[req.method];
        url = req.url;
        versionMajor = req.versionMajor;
        versionMinor = req.versionMinor;
        headers = req.headers;
    };

    parser[HTTPParser.kOnBody] = function (chunk, offset, length) {
        bodyChunks.push(chunk.slice(offset, offset + length));
    };

    // This is actually the event for trailers, go figure.
    parser[HTTPParser.kOnHeaders] = function (t) {
        trailers = t;
    };

    parser[HTTPParser.kOnMessageComplete] = function () {
        complete = true;
    };

    // Since we are sending the entire Buffer at once here all callbacks above happen synchronously.
    // The parser does not do _anything_ asynchronous.
    // However, you can of course call execute() multiple times with multiple chunks, e.g. from a stream.
    // But then you have to refactor the entire logic to be async (e.g. resolve a Promise in kOnMessageComplete and add timeout logic).
    parser.execute(input);
    parser.finish();

    if (!complete) {
        throw new Error('Could not parse request');
    }

    let body = Buffer.concat(bodyChunks).toString('base64');

    return {
        shouldKeepAlive,
        upgrade,
        method,
        url,
        versionMajor,
        versionMinor,
        headers,
        body,
        trailers,
    };
}

function parseResponse(input) {
    if (!input.length) {
        return input;
    }
    const parser = new HTTPParser(HTTPParser.RESPONSE);
    let complete = false;
    let shouldKeepAlive;
    let upgrade;
    let statusCode;
    let statusMessage;
    let versionMajor;
    let versionMinor;
    let headers = [];
    let trailers = [];
    let bodyChunks = [];

    parser[HTTPParser.kOnHeadersComplete] = function (res) {
        shouldKeepAlive = res.shouldKeepAlive;
        upgrade = res.upgrade;
        statusCode = res.statusCode;
        statusMessage = res.statusMessage;
        versionMajor = res.versionMajor;
        versionMinor = res.versionMinor;
        headers = res.headers;
    };

    parser[HTTPParser.kOnBody] = function (chunk, offset, length) {
        bodyChunks.push(chunk.slice(offset, offset + length));
    };

    // This is actually the event for trailers, go figure.
    parser[HTTPParser.kOnHeaders] = function (t) {
        trailers = t;
    };

    parser[HTTPParser.kOnMessageComplete] = function () {
        complete = true;
    };

    // Since we are sending the entire Buffer at once here all callbacks above happen synchronously.
    // The parser does not do _anything_ asynchronous.
    // However, you can of course call execute() multiple times with multiple chunks, e.g. from a stream.
    // But then you have to refactor the entire logic to be async (e.g. resolve a Promise in kOnMessageComplete and add timeout logic).
    parser.execute(input);
    parser.finish();

    if (!complete) {
        throw new Error('Could not parse');
    }

    let body = Buffer.concat(bodyChunks).toString('base64');

    return {
        shouldKeepAlive,
        upgrade,
        statusCode,
        statusMessage,
        versionMajor,
        versionMinor,
        headers,
        body,
        trailers,
    };
};

module.exports = {
    parseRequest,
    parseResponse
};