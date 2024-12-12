import DB from './db.mjs';
import Whatsapp from "./whatsapp.mjs";

export default class User {
    instances = []
    tempId = +new Date()

    constructor(data, socket) {
        this.userdata = data
        this.socket = socket
        this.initTempInsanses()
        this.instanceList()
    }

    async instanceList() {
       const whatsapp =  global.instances.filter(instance => instance.user_id===this.userdata.id)||[]
        for (let i = 0; i < whatsapp.length; i++) {
            this.subscribeInstance(whatsapp[i].whatsapp)
        }
    }
    subscribeInstance(whatsapp){
        whatsapp.event.on('messages', (data) => {
            this.socket.emit('messages', data);
        })
        whatsapp.event.on('disconnected', async (data) => {
            await whatsapp.delinstance()
            this.socket.emit('deleteInstance', {id:whatsapp.id});
        })
        whatsapp.event.on('ready', (data) => {

        })

    }

    async initTempInsanses() {
        this.tempId = +new Date()
        let whatsapp = new Whatsapp({
            token: this.tempId,
            user_id: this.userdata.id,
            stateInstance: 'notAuthorized',
            options: {},
            id: null
        });
        this.socket.on('disconnect', () => {
            if (whatsapp.id==null){
                whatsapp.destroy()
                whatsapp.delCache()
            }
        });
        whatsapp.event.on('initialize', () => {
        })
        whatsapp.event.on('qr', (data) => {
            this.socket.emit('connectWhatsapp', data);
        })
        whatsapp.event.on('disconnected', (data) => {
            this.socket.emit('disconnected', data);
        })
        whatsapp.event.on('authenticated', async () => {
            const instance = await DB.query(`
                    INSERT INTO ${process.env.DB_SCHEMA}.instances (token, user_id, options, stateInstance)
                    VALUES ($1, $2, $3, $4)
                    RETURNING *;
                `, [this.tempId, this.userdata.id, JSON.stringify({}), 'authorized']);

           await whatsapp.destroy()
            const tws = {
                whatsapp:new Whatsapp(instance[0]),
                id:instance[0].id,
                user_id:[0].user_id,
            }
            this.socket.emit('whatsappReady', {success: true, instance: instance[0]});
            global.instances.push(tws);
            this.subscribeInstance(tws.whatsapp)
            this.initTempInsanses()
        });
        whatsapp.event.on('ready', async (data) => {

        })
    }

    async getData() {
        this.instances = await DB.query(`SELECT * FROM ${process.env.DB_SCHEMA}.instances WHERE user_id=$1`, [this.userdata.id])
        return {
            user: this.userdata,
            instances: this.instances,
        }
    }
}