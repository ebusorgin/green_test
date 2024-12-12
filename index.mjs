import dotenv from 'dotenv';
import DB from './db.mjs';
import http from 'http';
import express from 'express';
import Socket from './socket.mjs';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import Whatsapp from "./whatsapp.mjs";

global.instances = []
dotenv.config();

class Server {
  db = DB
  server = null;
  app = express();
  constructor(port=3000) {
    this.port = port
    this.initServer()
  }
  async initServer() {
    await this.db.init()
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.static(path.join(process.env.STATIC_PATH)));
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    }));
    this.app.get('/waInstance:instanceId/:method/:token', async (req, res) => {
      const { instanceId, method,token } = req.params;
        const instance = await this.db.query(
            `SELECT * FROM ${process.env.DB_SCHEMA}.instances WHERE id=$1`,
            [+instanceId]
        );
        if (method==='getSettings') {
          res.json({instance:instance[0].options});
        }
      if (method==='getStateInstance') {
        res.json({stateInstance:instance[0].stateinstance});
      }
    });
    this.app.post('/waInstance:instanceId/:method/:token', async (req, res) => {
      const { instanceId, method, token } = req.params;
      if (method==='sendMessage') {
        const { chatId, message } = req.body;
        const instance =  global.instances.find(instance => instance.id.toString() === instanceId.toString())
        const result = await instance.whatsapp.sendMessage(chatId, message);
        res.json({ result });
      }
      if (method==='deleteInstanceAccount') {
        const { id, token } = req.body;
        const index =  global.instances.findIndex(instance => instance.id.toString() === id.toString())
        await global.instances[index].whatsapp.destroy();
        await global.instances[index].whatsapp.delinstance();
        global.instances.splice(index, 1);
        res.json({ res:'ok' });
      }
      if (method==='sendFileByUrl') {
        const { chatId, urlFile, fileName } = req.body;
        const instance =  global.instances.find(instance => instance.id.toString() === instanceId.toString())
        const result = await instance.whatsapp.sendFileByUrl(chatId, urlFile, fileName);
        res.json({ result });
      }
      if (method === 'getContacts') {
        const instance = global.instances.find(instance => instance.id.toString() === instanceId.toString());
        if (!instance) {
          return res.status(404).json({ message: 'Инстанс не найден' });
        }
        const contacts = await instance.whatsapp.getContacts();
        const formattedContacts = contacts.map(contact => ({
          id: contact.id._serialized,
          contactName: contact.name || "",
          name: contact.pushname || "",
          type: contact.isGroup ? "group" : "user"
        }));
        res.json(formattedContacts);
      }
      if (method === 'getChatHistory') {
        const { chatId, count} = req.body;
        const instance = global.instances.find(instance => instance.id.toString() === instanceId.toString());

        if (!instance) {
          return res.status(404).json({ message: 'Инстанс не найден' });
        }
        const history = await instance.whatsapp.getChatHistory({chatId, count});
        res.json(history);
      }
    });
    this.server = http.createServer({
      key: fs.readFileSync(process.env.SSL_KEY_PATH),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH),
    }, this.app);

    this.server.listen(this.port, () => {
      console.log(`Сервер запущен на порту ${this.port}`);
    });

    this.socket = new Socket(this.server, this.db);
    const instances= await DB.query(`SELECT * FROM ${process.env.DB_SCHEMA}.instances WHERE stateInstance='authorized'`)
    for (let i = 0; i < instances.length; i++) {
      global.instances.push({
        whatsapp:new Whatsapp(instances[i]),
        id:instances[i].id,
        user_id:instances[i].user_id,
      });
    }
  }
}

(async () => {
  new Server(process.env.PORT)

})();

process.on('uncaughtException', function (err)
{
  console.log('<- UNCAUGHT ERROR START ------------------------------------------------------------------------------>');
  console.log(new Date());
  console.log(err.message);
  console.log(err.stack);
  console.log('<- UNCAUGHT ERROR END -------------------------------------------------------------------------------->');
});