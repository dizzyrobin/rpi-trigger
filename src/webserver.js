const fs = require('fs');
const express = require('express');
const basicAuth = require('express-basic-auth');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const config = require('../cfg.json');
const type = require('./type');

const webserverPort = config.net.port.webserver;
const triggerPort = config.net.port.trigger;

const app = express();

const CONFIG_FILE = './cfg.json';
const ENV_FILE = './.env';

const parseReceivers = receivers => {
  let tmp = receivers.split(';').map(e => e.trim().split(':').map(x => x.trim()));
  tmp = tmp.map(e => ({
    email: e[0],
    subject: e[1],
  }));

  for (const t of tmp) {
    const {email, subject} = t;
    // TODO: Email regex
    if (!(type.notEmptyString(email) && type.string(subject))) {
      return undefined;
    }
  }

  return tmp;
};

app.use(basicAuth({
  users: {
    admin: '1234',  // TODO: Move this to a config file
  },
  challenge: true,
}));

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.post('/set', (req, res) => {
  const {body} = req;

  const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE));
  cfg.sensor.lostTimeout = Number(body['sensor-lostTimeout']);
  cfg.temperature.ok = Number(body['temperature-ok']);
  cfg.temperature.warning = Number(body['temperature-warning']);
  cfg.temperature.danger = Number(body['temperature-danger']);
  cfg.email.provider = body['email-provider'];
  cfg.email.sender = body['email-sender'];
  cfg.email.port = Number(body['email-port']);
  cfg.email.secure = type.to.stringToBoolean(body['email-secure']);
  cfg.email.receivers = parseReceivers(body['email-receivers']);

  const password = body['email-password'];

  if (!(type.number(cfg.sensor.lostTimeout) &&
      type.number(cfg.temperature.ok) &&
      type.number(cfg.temperature.warning) &&
      type.number(cfg.temperature.danger) &&
      type.string(cfg.email.provider) &&
      type.string(cfg.email.sender) &&
      type.number(cfg.email.port) &&
      type.boolean(cfg.email.secure) &&
      type.array(cfg.email.receivers))) {
    res.send('Invalid parameters');
    return;
  }

  if (!type.null(password) && password !== '') {
    if (type.string(password)) {
      let env = String(fs.readFileSync(ENV_FILE));
      env = env.split('=', 1);
      env[1] = password;
      env = env.join('=');
      fs.writeFileSync(ENV_FILE, env);
    } else {
      res.send('Invalid email password. It must be a string');
      return;
    }
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg));
  fetch(`http://localhost:${triggerPort}/reload`, {method: 'POST'})
    .then(() => {
      res.redirect('/');
    }).catch(error => {
      console.error(error);
      res.send('Error 500: Couldn\'t reload trigger server');
    });
});

app.get('/cfg', (req, res) => {
  const cfg = fs.readFileSync(CONFIG_FILE);
  res.send(cfg);
});

app.get('/factory-reset', (req, res) => {
  res.redirect('/');
  // TODO
});

app.get('/sensors', (req, res) => {
  const sensorData = fs.readFileSync('./sensor-data.json');
  res.send(sensorData);
});

app.get('/log', (req, res) => {
  const log = fs.readFileSync('./sensor-data.log');
  res.send(log);
});

app.listen(webserverPort, () => {
  console.log(`WebServer listening on port ${webserverPort}`);
});
