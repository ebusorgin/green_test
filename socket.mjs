import {Server} from 'socket.io';
import jwt from 'jsonwebtoken';
import User from "./user.mjs";

class Socket {
    USERS = {}

    constructor(server, db) {
        this.db = db
        this.io = new Server(server, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST'],
                allowedHeaders: ['Authorization', 'Content-Type'],
                credentials: true
            }
        });
        this.io.on('connection', this.initializeEvents.bind(this))
    }

    async initializeEvents(socket) {
        const token = socket.handshake.auth.token;
        if (token) {
            const user = await this.authUserByToken(token);
            if (user) {
                socket.user = new User(user, socket)
                this.USERS[user.id] = socket
                const userData = await socket.user.getData()
                socket.emit('auth', {success: true, data: userData});
            } else {
                socket.emit('auth', {success: false, message: "No user found"});
            }
        } else {
            socket.emit('auth', {success: false, message: "No token found "});
        }
        socket.on('auth', async (data, callback) => {
            const user = await this.authUserByLogin(data);
            socket.user = new User(user, socket)
            this.USERS[user.id] = socket
            const userData = await socket.user.getData()
            callback({success: true, data: userData});
        });
    }

    generateToken(login) {
        return jwt.sign({login}, process.env.JWT_SECRET);
    }

    async authUserByToken(token) {
        return (await this.db.query(`SELECT * FROM ${process.env.DB_SCHEMA}.users WHERE token = $1`, [token]))[0];
    }

    async authUserByLogin({login}) {
        const existingUser = await this.db.query(`SELECT * FROM ${process.env.DB_SCHEMA}.users WHERE login = $1`, [login]);

        if (existingUser.length > 0) {
            return existingUser[0];
        }

        const newUser = await this.db.query(`
        INSERT INTO ${process.env.DB_SCHEMA}.users (login,token)
        VALUES ($1,$2)
        RETURNING *;
    `, [login, this.generateToken(login)]);
        return newUser[0];
    }
}

export default Socket;
