const Koa = require('koa');
const Router = require('@koa/router');
const websockify = require('koa-websocket');
const serve = require('koa-static');
const httpParser = require('./http-parser');

const lib = require('./lib');
const app = websockify(new Koa());

const wsRouter = Router();
const router = Router();

// Regular middleware
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
    const packets = await lib();
    // Using routes
    wsRouter.get('/', async (ctx, next) => {
        packets.items().map(
            (item, idx) =>
                ctx.websocket.send(toStr({...item, idx}))
        );
        packets.reg((p, idx) => {
            ctx.websocket.send(toStr({...p, idx}));
        });
        // ctx.websocket.on('message', (message) => {
             // do something with the message from client
        //     if (message.toString() === 'ping') {
        //         ctx.websocket.send('pong');
        //     }
        // });
        return next;
    });
    router.get('/queue/:id', (ctx, next) => {
        const id = parseInt(ctx.params.id);
        if (!isNaN(id) && packets.items()[id]) {
            ctx.body = toObj({...packets.items()[id], idx: id});
            // return toStr({...packets.items()[id], idx: id});
        } else {
            ctx.body = 'N/A';
        }
        return next;
    });
    app.use(serve('html'));

    // Attach both routers
    // Note it's app.ws.use for our ws router
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

    app.listen(3000);
})();