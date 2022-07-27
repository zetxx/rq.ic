const {createServer, createConnection} = require('net');
const {parse} = require('url');

const packetsFab = () => {
    let queue = [];
    let fns = [];
    return {
        push(item) {
            const idx = queue.push(item);
            fns.map(async(fn) => {
                try {
                    await fn(item, idx - 1);
                } catch (e) {
                    const idx = fns.findIndex((f) => f === fn);
                    fns = fns.slice(0, idx)
                        .concat(
                            fns.slice(idx + 1, fns.length)
                        );
                    console.error('de-registering');
                }
            })
        },
        reg(fn) {
            const idx = fns.push(fn);
            fn.idx = idx;
        },
        items() {
            return queue;
        },
        reset() {
            queue = [];
            return queue;
        }
    };
};

const dataCollector = () => {
    const collection = {
        request:  Buffer.from([]),
        response:  Buffer.from([])
    };
    return {
        set(key, data) {
            collection[key] = Buffer.concat([
                collection[key],
                data
            ])
        },
        get() {
            return collection;
        }
    }
};

const server = async(
    client,
    packets,
    {
        listen = 8010
    } = {}) => {
        const server = createServer({
            keepAlive: false,
            allowHalfOpen: false
        }, async(cc) => {
        const dt = dataCollector();
        const c = await client(() => {
            cc.on('data', (d) => {
                dt.set('request', d);
                c.write(d);
            });
            cc.on('error', (e) => {
                console.error('client connected to server Error');
                console.error(e);
            });
            c.on('data', (d) => {
                dt.set('response', d);
                cc.write(d);
            });
            c.on('error', (e) => {
                console.error('client connected to origin Error');
                console.error(e);
                dt.get().request.length && packets.push(dt.get());
                cc.end();
            });
            c.on('end', () => {
                dt.get().request.length && packets.push(dt.get());
                cc.end();
            });
        });
    });
    
    server.on('error', (err) => {
        console.error(err);
    });
    
    server.listen(listen, () => console.log(`IC: listening on: ${listen}`));
};

const clientFab = ({
    destination = 'http://localhost:80'
} = {}) => (onConn = (client) => {}) => {
    const {
        port,
        hostname: host
    } = parse(destination);
    const cf = (resolve, c = 0) => {
        const cc = createConnection({
            port,
            host,
            keepAlive: false,
            allowHalfOpen: false
        }, (...args) => {
            resolve(cc);
            setTimeout(() => onConn(...args), 10);
        });
        cc.on('error', (e) => {
            cc.end();
            setTimeout(() => cf(resolve, c + 1), c * 1000);
        });
    };
    return new Promise((resolve) => {
        cf(resolve);
    });
};

const repeatFab = (client, packets) => (id) => {
    const packet = packets.items()[id];
    const dt = dataCollector();
    dt.set('request', packet.request);
    const c = client(() => {
        c.on('data', (d) => {
            dt.set('response', d);
            setTimeout(() => c.end(), 5000);
        });
        c.on('error', (e) => {
            console.error('client connected to origin Error');
            console.error(e);
        });
        c.on('end', () => packets.push(dt.get()));
        c.write(packet.request);
    });
};

module.exports = async(config) => {
    const packets = packetsFab();
    const client = clientFab(config);
    const repeat = repeatFab(
        client,
        packets
    );
    await server(
        client,
        packets,
        config
    );
    return {
        packets,
        repeat
    };
};
