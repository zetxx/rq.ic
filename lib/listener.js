const {createServer, createConnection} = require('net');
const {URL} = require('url');

const contentLen = (data) => {
    const sd = data.toString('utf8').toLowerCase();
    if (sd.indexOf('content-length') > -1) {
        return parseInt(sd
            .split('content-length:')[1]
            .split('\n')[0]
            .trim());
    }
    return 0;
};

const httpEnd = (data) => {
    const s1 = data.indexOf('\r\n\r\n');
    if (s1 > -1) {
        const extraLen = contentLen(data);
        return {
            pending: (s1 + extraLen + 4) > data.length,
            r: data.slice(0, s1 + extraLen + 4),
            rest: data.slice(s1 + extraLen + 4)
        };
    }
    const s2 = data.indexOf('\n\n');
    if (s2 > -1) {
        const extraLen = contentLen(data);
        return {
            pending: (s1 + extraLen + 2) > data.length,
            r: data.slice(0, s2 + extraLen + 2),
            rest: data.slice(s2 + extraLen + 2)
        };
    }
    return {
        pending: true
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
        id: 0
    }, async(cc) => {
        let cb = Buffer.from([]);
        cc.on('data', async(d) => {
            cb = Buffer.concat([cb, d]);
            const mReq = httpEnd(cb);
            if (mReq.pending) {
                return;
            }
            if (mReq.r) {
                cb = mReq.rest;
                (async() => {
                    try {
                        const comIdx = communication.push(undefined, mReq.r);
                        await destination.write(mReq.r, (data, err, end) => {
                            if (end) {
                                if (!communication.pull(comIdx)?.response) {
                                    communication.push(comIdx, Buffer.from([]));
                                    cc.write(
                                        communication.pull(comIdx)?.response ||
                                        Buffer.from([])
                                    );
                                }
                                communication.push(comIdx, undefined, true);
                            } else if (err) {
                                const sErr = Buffer.from(err.toString('utf8'));
                                cc.write(sErr);
                                communication.push(comIdx, sErr);
                                communication.push(comIdx, undefined, true);
                            } else if (!err) {
                                cc.write(data);
                                communication.push(comIdx, data);
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
const Communication = ({repeater}) => {
    let reqRep = [];
    let packetArrived = () => {};

    const o = {
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
        },
        repeat(idx) {
            repeater.request(o.pull(idx));
        }
    };
    return o;
};

const Repeater = ({
    config: {
        host = '0.0.0.0',
        listen: port = 8010
    } = {}
}) => {
    return {
        async request({request: rq}) {
            try {
                return await (new Promise((resolve, reject) => {
                    const client = createConnection({host, port});
                    client.on('ready', () => client.write(rq));
                }));
            } catch (e) {
                console.error('repeater error', e);
            }
        }
    };
};

module.exports = async(config) => {
    return await Promise.all(
        config
            .map(async(c, idx) => {
                const conf = expandConfig(c);
                const repeater = Repeater({config: conf});
                const destination = Destination(conf);
                const communication = Communication({repeater});

                await Source({
                    config: conf,
                    destination,
                    communication
                });
                return {
                    communication
                };
            })
    );
};
