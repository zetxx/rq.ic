const package = require('./package.json');
const conf = require('rc')(package.name);
const Koa = require('koa');
const Router = require('@koa/router');
const websockify = require('koa-websocket');
const serve = require('koa-static');
const httpParser = require('./http-parser');

const lib = require('./lib');
const app = websockify(new Koa());

const wsRouter = Router();
const router = Router();

wsRouter.use((ctx, next) => {
    return next(ctx);
});

const toObj = ({
    server,
    client,
    idx = 'next'
}) => [
    idx,
    httpParser.parseRequest(server),
    httpParser.parseResponse(client)
];

const toStr = ({
    server,
    client,
    idx = 'next'
}) => {
    return JSON.stringify(toObj({
        server,
        client,
        idx
    }));
};

(async() => {
    const packets = await lib(conf.interceptor);
    wsRouter.get('/', async (ctx, next) => {
        try {
            packets.items().map(
                (item, idx) =>
                    ctx.websocket.send(toStr({...item, idx}))
            );
        } catch (e) {
            console.error(e);
        }
        packets.reg((p, idx) => {
            ctx.websocket.send(toStr({...p, idx}));
        });
        return next;
    });
    router.get('/queue/:id', (ctx, next) => {
        const id = parseInt(ctx.params.id);
        if (!isNaN(id) && packets.items()[id]) {
            ctx.body = toObj({...packets.items()[id], idx: id});
        } else {
            ctx.body = 'N/A';
        }
        return next;
    });
    router.get('/export/:from/:to', (ctx, next) => {
        ctx.body = packets
            .items()
            .slice(
                parseInt(ctx.params.from),
                parseInt(ctx.params.to)
            )
            .map(({client, server}) => ({
                client: client.toString('base64'),
                server: server.toString('base64')
            }));
        return next;
    });
    app.use(serve('html'));

    app.ws.use(
        wsRouter.routes()
    ).use(
        wsRouter.allowedMethods()
    );
    app.use(
        router.routes()
    ).use(
        router.allowedMethods()
    );

    app.listen(
        conf.frontend.listen,
        () => console.info(
            `Frontend is listening: ${conf.frontend.listen}`
        )
    );
})();