const {createServer, createConnection} = require('net');
const {URL} = require('url');

const Destination = ({
    destination = new URL('http://example.com:80')
}) => {
    const {
        port,
        hostname: host
    } = destination;
    // http only
    const Client = async() => {
        const c = (new Promise((resolve, reject) => {
            let respRes, respRej;
            let data = Buffer.from([]);
            const state = {connected: 0, ready: 0, ended: 0, resolved: 0};
            const client = createConnection({host, port});
            const response = new Promise((resolve, reject) => (
                (respRes = resolve) | (respRej = reject)
            ));
            client.on('lookup', () => (state.resolved = 1));
            client.on('connect', () => (state.connected = 1));
            client.on('ready', () => ((state.ready = 1) | resolve({
                client,
                response
            })));
            client.on('end', () => {
                state.ended = 1;
                respRes(data);
            });
            client.on('data', (d) => (data = Buffer.concat([data, d])));
            client.on('error', (e) => {
                if (!state.ready) {
                    return reject(e);
                }
                console.error('client error while communicating', e);
                respRej(e);
            });
        }));
        return await c;
    };

    const write = async(data) => {
        const {client, response} = await Client();
        client.write(data);
        return await response;
    };

    return {
        write
    };
};

const Source = async({
    destination,
    config: {
        listen = 8010
    } = {}
}) => {
    const server = createServer({
        keepAlive: false,
        allowHalfOpen: false
    }, async(cc) => {
        cc.on('data', async(d) => {
            try {
                const resp = await destination.write(d);
                console.log(resp);
            } catch (e) {
                console.log(e);
            }
            console.log(d.toString('utf8'));
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

module.exports = async(config) => {
    const conf = expandConfig(config);
    const destination = Destination(conf);
    await Source({
        config: conf,
        destination
    });
    return {
        packets: {},
        repeat: {}
    };
};
