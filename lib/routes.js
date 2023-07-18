const Koa = require('koa');
const Router = require('@koa/router');
const websockify = require('koa-websocket');
const serve = require('koa-static');

const listener = require('./listener');
const app = websockify(new Koa());

const wsRouter = Router();
const router = Router();

wsRouter.use((ctx, next) => {
    return next(ctx);
});

const toStr = ({
    request,
    response,
    ...rest
}) => {
    return JSON.stringify({
        request: request?.toString('base64'),
        response: response?.toString('base64'),
        ...rest
    });
};

module.exports = async({
    config
}) => {
    const communications = await listener(config.interceptors);
    wsRouter.get('/ws', async(ctx, next) => {
        communications.map(({communication}, comIdx) => {
            try {
                communication.pull().map(
                    (item, idx) =>
                        ctx.websocket.send(toStr({comIdx, idx, ...item}))
                );
            } catch (e) {
                console.error(e);
            }
            communication.whenArrived((idx) => {
                ctx.websocket.send(toStr({comIdx, idx, ...communication.pull(idx)}));
            });
        });
        return next;
    });

    router.get('/repeat/:comIdx/:idx', (ctx, next) => {
        const idx = parseInt(ctx.params.idx);
        const comIdx = parseInt(ctx.params.comIdx);
        if (communications[comIdx].communication.pull(idx)) {
            communications[comIdx].communication.repeat(idx);
            ctx.body = 'done';
        } else {
            ctx.body = 'N/A';
        }
        return next;
    });

    router.get('/reset/:comIdx', (ctx, next) => {
        const comIdx = parseInt(ctx.params.comIdx);
        ctx.body = communications[comIdx]
            .communication
            .reset();
        return next;
    });
    app
        .use(serve('html'));

    app
        .ws
        .use(
            wsRouter.routes()
        )
        .use(
            wsRouter.allowedMethods()
        );
    app
        .use(
            router.routes()
        )
        .use(
            router.allowedMethods()
        );

    app.listen(
        config.frontend.listen,
        () => console.info(
            `Frontend is listening: ${config.frontend.listen}`
        )
    );
};
