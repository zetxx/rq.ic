const {createServer, createConnection} = require('net');
const {URL} = require('url');

const httpEnd = (data) => {
    const s1 = data.indexOf('\r\n\r\n');
    if (s1) {
        const sd = data.toString('utf8').toLowerCase();
        if (sd.indexOf('content-length') > -1) {
            const extraLen = sd
                .split('content-length:')[1]
                .split('\n')[0]
                .trim();
            return {
                r: data.slice(0, s1 + parseInt(extraLen) + 4),
                rest: data.slice(s1 + parseInt(extraLen) + 4)
            };
        }
        return {
            r: data.slice(0, s1 + 4),
            rest: data.slice(s1 + 4)
        };
    }
    const s2 = data.indexOf('\n\n');
    if (s2) {
        return {
            r: data.slice(0, s2 + 2),
            rest: data.slice(s2 + 2)
        };
    }
    return {
        r: undefined,
        rest: data
    };
};

const Destination = ({
    destination = new URL('http://example.com:80')
}) => {
    const {
        port,
        hostname: host
    } = destination;
    // http only
    const Client = async(pushBack) => {
        const c = (new Promise((resolve, reject) => {
            const state = {connected: 0, ready: 0, ended: 0, resolved: 0};
            const client = createConnection({host, port});
            client.on('lookup', () => (state.resolved = 1));
            client.on('connect', () => (state.connected = 1));
            client.on('ready', () => ((state.ready = 1) | resolve({
                client
            })));
            client.on('end', () => {
                pushBack(undefined, undefined, 1);
                state.ended = 1;
            });
            client.on('data', (d) => (pushBack(d)));
            client.on('error', (e) => {
                if (!state.ready) {
                    return reject(e);
                }
                console.error('client error while communicating', e);
                pushBack(undefined, e);
            });
        }));
        return await c;
    };

    const write = async(data, pushBack) => {
        const {client} = await Client(pushBack);
        client.write(data);
        return {};
    };

    return {
        write
    };
};
const Source = async({
    destination,
    config: {
        listen = 8010
    } = {},
    communication
}) => {
    const server = createServer({
        keepAlive: false,
        allowHalfOpen: false
    }, async(cc) => {
        let cb = Buffer.from([]);
        cc.on('data', async(d) => {
            cb = Buffer.concat([cb, d]);
            const mReq = httpEnd(cb);
            if (mReq.r) {
                cb = mReq.rest;
                (async() => {
                    try {
                        const comIdx = communication(undefined, mReq.r);
                        await destination.write(mReq.r, (data, err, end) => {
                            if (end) {
                                communication(comIdx, undefined, true);
                            } else if (!err) {
                                cc.write(data);
                                communication(comIdx, data);
                            }
                        });
                    } catch (e) {
                        console.log(e);
                    }
                })();
            }
        });
        cc.on('error', (e) => {
            console.error('client connected to server Error');
            console.error(e);
        });
    });

    server.on('error', (err) => {
        console.error(err);
    });

    server.listen(listen, () => console.log(`IC: listening on: ${listen}`));
};

const expandConfig = ({destination, ...rest}) => ({
    ...rest,
    destination: new URL(destination)
});
const Communication = () => {
    let reqRep = [];
    let packetArrived = () => {};
    return {
        whenArrived(cb) {
            packetArrived = cb;
        },
        pull(idx) {
            if (idx !== undefined) {
                return reqRep[idx];
            }
            return reqRep;
        },
        push(idx, data, notify) {
            if (notify) {
                return packetArrived(idx);
            }
            if (idx === undefined) {
                const newIdx = reqRep.push({request: data});
                return newIdx - 1;
            }
            if (!reqRep[idx]) {
                return;
            }
            if (!reqRep[idx].response) {
                reqRep[idx].response = Buffer.from([]);
            }
            reqRep[idx].response = Buffer.concat([
                reqRep[idx].response,
                data
            ]);
        },
        reset() {
            reqRep = [];
        }
    };
};

module.exports = async(config) => {
    const conf = expandConfig(config);
    const destination = Destination(conf);
    const communication = Communication();

    await Source({
        config: conf,
        destination,
        communication: communication.push
    });
    return {
        communication
    };
};
