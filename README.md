# Request intercept - view

## Example config, place file `.rq.icrc` in project dir, and put json object as follows.

```json
{
    "interceptors": [{
        "listen": 8080,
        "destination": {
            "url": "http://example.com:80",
            "headers": {
                "request": {
                    "host": "example.com"
                }
            }
        }
    }],
    "frontend": {
        "listen": 3000
    }
}
```

since this module uses `rc` module for config parsing, all config variants are possible
