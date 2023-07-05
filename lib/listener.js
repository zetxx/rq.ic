const {createServer, createConnection} = require('net');
const {URL} = require('url');

const Destination = ({
    destination = 'http://localhost:80'
}) => {
    const {
        port,
        hostname: host
    } = new URL(destination);

    const client = createConnection({host, port}, () => {
        // 'connect' listener.
        console.log('connected to destination!');
      });

    const write = () => {};

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
        cc.on('data', (d) => {
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
        destination: destination.write
    });
    return {
        packets: {},
        repeat: {}
    };
};
