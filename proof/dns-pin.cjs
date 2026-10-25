const dns = require("node:dns");
const { setGlobalDispatcher, Agent } = require(require.resolve("undici", { paths: [__dirname + "/../worker/node_modules"] }));
const pins = { "gleam-agents.coey.dev": process.env.GA_PIN_IP };
setGlobalDispatcher(new Agent({ connect: { lookup: (host, opts, cb) => (pins[host] ? (opts.all ? cb(null, [{ address: pins[host], family: 4 }]) : cb(null, pins[host], 4)) : dns.lookup(host, opts, cb)) } }));
