import pkg from 'whatsapp-web.js';
import DB from './db.mjs';
import EventEmitter from "node:events";
import QRCode from "qrcode";
import axios from "axios";
import fs from 'fs/promises';

const {Client, LocalAuth, MessageMedia} = pkg;

export default class Whatsapp {
    event = new EventEmitter();

    constructor({token, user_id, stateInstance, options, id = null}) {
        this.id = id
        this.token = +token
        this.user_id = user_id
        this.stateInstance = stateInstance
        this.options = options
        this.client = new Client({
            authStrategy: new LocalAuth({clientId: token}),
            puppeteer: {
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            }
        });
        this.events()
    }

    async events() {
        this.client.initialize().then(() => {
            this.event.emit('initialize');
        })
        this.client.on('qr', async (qr) => {
            const qrBase64 = await QRCode.toDataURL(qr);
            this.event.emit('qr', {qr: qrBase64});
        });
        this.client.on('ready', async (data) => {
            const userInfo = await this.client.info;
            await DB.query(`
                    UPDATE ${process.env.DB_SCHEMA}.instances SET options=$1 WHERE token=$2
                `, [JSON.stringify(userInfo), this.token]);
            this.event.emit('ready', {});
        })
        this.client.on('authenticated', async () => {
            this.event.emit('authenticated', {token: this.token});
        });
        this.client.on('disconnected', async (data) => {
            const inst = await DB.query(`
            SELECT * FROM ${process.env.DB_SCHEMA}.instances
            WHERE token = $1
        `, [this.token]);
            this.event.emit('disconnected', {id: inst[0].id});
            await this.destroy()
        });
        this.client.on('message', async (message) => {
            this.event.emit('message', message);
        })
    }

    async delCache() {
        try {
            const authFolderPath = `./.wwebjs_auth/session-${this.token}`;
            await fs.rm(authFolderPath, {recursive: true, force: true});
        } catch (e) {
            console.error("delCache", e);
        }
    }

    async delinstance() {

        await DB.query(`
            DELETE FROM ${process.env.DB_SCHEMA}.instances
            WHERE token = $1
        `, [this.token]);
        try {
            await this.client.logout()
        } catch (e) {
            console.error("delinstance", e);
        }

    }

    async destroy() {
        this.client.removeAllListeners();
        try {
            await this.client.destroy();
        } catch (e) {
            console.error("delinstance", e);
        }
    }

    async sendMessage(chatId, message) {
        try {
            return await this.client.sendMessage(chatId, message);
        } catch (error) {
            throw error;
        }
    }

    async sendFileByUrl(chatId, urlFile, fileName) {
        try {
            const response = await axios.get(urlFile, {
                responseType: 'arraybuffer',
            });

            const media = new MessageMedia(
                response.headers['content-type'],
                Buffer.from(response.data).toString('base64'),
                fileName
            );

            return await this.client.sendMessage(chatId, media);
        } catch (error) {
            throw error;
        }
    }

    async getContacts() {
        return await this.client.getContacts();
    }

    async getChatHistory({chatId, count}) {
        try {
            const chat = await this.client.getChatById(chatId);
            const messages = await chat.fetchMessages({limit: count});

            return messages.map(message => ({
                chatId: message.from || message.to,
                idMessage: message.id.id,
                isDeleted: message.isDeleted || false,
                sendByApi: message.fromMe || false,
                statusMessage: message.ack === 0 ? 'sent' : message.ack === 1 ? 'delivered' : 'read',
                textMessage: message.body,
                timestamp: message.timestamp,
                type: message.fromMe ? 'outgoing' : 'incoming',
                typeMessage: message.type
            }));
        } catch (error) {
            throw error;
        }
    }

}