# Request intercept - view

## Example config

```js
{
    "interceptor": {
        "listen": 8080,
        "destination": "http://example.com:80"
    },
    "frontend": {
        "listen": 3000
    }
}
```

since this module uses `rc` module for config parsing, all config variants are possible
