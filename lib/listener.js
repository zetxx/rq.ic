const {createServer, createConnection} = require('net');
const {URL} = require('url');

const Destination = ({
    destination = 'http://localhost:80'
}) => {
    const {
        port,
        hostname: host
    } = new URL(destination);
    let client;

    const Client = async() => {
        if (client) {
            return client;
        }
        return await (new Promise((resolve, reject) => {
            client = createConnection({host, port}, () => {
                console.log('connected to destination!');
                resolve();
            });
        }));
    };

    const write = async(data) => {
        await Client();
        client.write(data);
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
        const dst = destination;
        cc.on('data', async(d) => {
            await dst.write(d);
            console.log(d.toString());
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

module.exports = async(config) => {
    const destination = Destination(config);
    await Source({
        config,
        destination
    });
    return {
        packets: {},
        repeat: {}
    };
};
