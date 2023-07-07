const config = require('rc')(require('./package.json').name);

const app = require('./lib/routes');
app({
    config
});
