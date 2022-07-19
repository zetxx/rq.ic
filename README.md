# Request intercept - view

## Example config, place file `.rq.icrc` in project dir, and put json object as follows.

```json
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
